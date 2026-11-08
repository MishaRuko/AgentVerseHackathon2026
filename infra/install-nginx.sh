#!/usr/bin/env bash
set -euo pipefail

# Run interactively with sudo. Public mode is an explicit choice, not the default.
if [[ ${EUID} -ne 0 ]]; then
  echo "Run: sudo bash $0 [--public]" >&2
  exit 1
fi
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PUBLIC=false
if [[ ${1:-} == --public ]]; then PUBLIC=true; fi
SITE=/etc/nginx/sites-available/byebye.fyi
ENABLED=/etc/nginx/sites-enabled/byebye.fyi
BACKUP="${SITE}.backup.$(date +%Y%m%d%H%M%S)"

if [[ -L "$ENABLED" && $(readlink -f "$ENABLED") != "$SITE" ]]; then
  echo "An unexpected byebye.fyi configuration is already enabled; inspect it first." >&2
  exit 1
fi
if [[ -e "$ENABLED" && ! -L "$ENABLED" ]]; then
  echo "$ENABLED is not a symlink; inspect it first." >&2
  exit 1
fi
if [[ -f "$SITE" ]]; then cp -p "$SITE" "$BACKUP"; fi

if ! command -v certbot >/dev/null || ! command -v htpasswd >/dev/null; then
  apt-get update
  apt-get install -y certbot apache2-utils
fi
install -d -m 755 /var/www/byebye

# Keep the API token on the server side of nginx, never in a browser build.
python3 - "$ROOT" <<'PY'
import pathlib, sys
root = pathlib.Path(sys.argv[1])
values = {}
for line in (root / '.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"\'')
token = values.get('APP_TOKEN', '')
port = values.get('FRONTEND_PORT', '3100')
if not token or not all(c.isalnum() or c in '-_' for c in token):
    raise SystemExit('APP_TOKEN must be a nonempty URL-safe token.')
if not port.isdigit():
    raise SystemExit('Invalid FRONTEND_PORT.')
text = f'''proxy_pass http://127.0.0.1:{port};
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Authorization "Bearer {token}";
proxy_connect_timeout 10s;
proxy_read_timeout 120s;
proxy_send_timeout 120s;
'''
path = pathlib.Path('/etc/nginx/snippets/byebye-proxy.conf')
path.write_text(text)
path.chmod(0o600)
PY

if [[ "$PUBLIC" == false && ! -f /etc/nginx/byebye.htpasswd ]]; then
  echo "Choose the HTTP access password for username 'byebye':"
  htpasswd -c /etc/nginx/byebye.htpasswd byebye
  chmod 640 /etc/nginx/byebye.htpasswd
  chgrp www-data /etc/nginx/byebye.htpasswd
fi

# Bootstrap both schemes so Cloudflare HTTPS redirects do not break HTTP-01.
# This reuses the certificate already serving this hostname through nginx's default
# site, without modifying that certificate or any other site's configuration.
if [[ ! -f /etc/letsencrypt/live/byebye.fyi/fullchain.pem ]]; then
  cat > "$SITE" <<'NGINX'
server {
    listen 80;
    server_name byebye.fyi;
    location ^~ /.well-known/acme-challenge/ { root /var/www/byebye; }
    location / { include /etc/nginx/snippets/byebye-proxy.conf; }
}
server {
    listen 443 ssl http2;
    server_name byebye.fyi;
    ssl_certificate /etc/ssl/cloudflare/misharuko.com.pem;
    ssl_certificate_key /etc/ssl/cloudflare/misharuko.com.key;
    location ^~ /.well-known/acme-challenge/ { root /var/www/byebye; }
    location / { include /etc/nginx/snippets/byebye-proxy.conf; }
}
NGINX
  if [[ "$PUBLIC" == false ]]; then
    python3 - "$SITE" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
path.write_text(path.read_text().replace('location / { include',
    'location / { auth_basic "byebye.fyi"; auth_basic_user_file /etc/nginx/byebye.htpasswd; include'))
PY
  fi
  if [[ ! -e "$ENABLED" ]]; then ln -s "$SITE" "$ENABLED"; fi
  nginx -t
  systemctl reload nginx
  certbot certonly --webroot -w /var/www/byebye -d byebye.fyi \
    --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
fi

python3 - "$ROOT" "$PUBLIC" <<'PY'
import pathlib, sys
root = pathlib.Path(sys.argv[1])
text = (root / 'infra/nginx/byebye.fyi.conf').read_text()
auth = '' if sys.argv[2] == 'true' else 'auth_basic "byebye.fyi";\n    auth_basic_user_file /etc/nginx/byebye.htpasswd;'
pathlib.Path('/etc/nginx/sites-available/byebye.fyi').write_text(text.replace('# BYEBYE_AUTH', auth))
PY
if [[ ! -e "$ENABLED" ]]; then ln -s "$SITE" "$ENABLED"; fi
nginx -t
systemctl reload nginx
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/byebye-nginx.sh <<'HOOK'
#!/bin/sh
nginx -t && systemctl reload nginx
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/byebye-nginx.sh
echo "Nginx and HTTPS configured for https://byebye.fyi"
