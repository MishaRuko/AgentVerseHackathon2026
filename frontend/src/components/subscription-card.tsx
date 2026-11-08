import { ArrowUpRight, Check, LoaderCircle, Users, KeyRound, CircleHelp } from 'lucide-react';
import type { Subscription } from '@/lib/schemas';

export const money = (value: number | null, currency = 'GBP') => value === null ? '—' :
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

export const statusLabels: Record<string, string> = {
  queued: 'In the queue', searching: 'Researching plans', suggestion: 'Suggestion ready',
  optimal: 'No action needed', needs_users: 'Needs user data', needs_review: 'Review needed',
  error: 'Attention needed',
};

export const Status = ({ status }: { status: string }) => (
  <span className={`status status-${status}`}>
    {['queued', 'searching'].includes(status) ? <LoaderCircle size={12} className="spin" /> :
      status === 'optimal' ? <Check size={12} /> : status === 'suggestion' ?
        <ArrowUpRight size={12} /> : <CircleHelp size={12} />}
    {statusLabels[status] ?? status}
  </span>
);

export const ServiceAvatar = ({ name, category }: { name: string; category: string }) => (
  <span className={`service-avatar avatar-${category.toLowerCase()}`} aria-hidden="true">
    {name.slice(0, 1).toUpperCase()}<span><ArrowUpRight size={11} strokeWidth={1.6} /></span>
  </span>
);

export const SubscriptionCard = ({ service, onOpen, onSso, disabled }: {
  service: Subscription; onOpen: () => void; onSso: () => void; disabled: boolean;
}) => (
  <article className={`subscription-card ${service.savings ? 'has-savings' : ''}`}>
    <button className="card-main" onClick={onOpen} aria-label={`View ${service.name} subscription`}>
      <div className="card-heading"><ServiceAvatar name={service.name} category={service.category} />
        <ArrowUpRight className="card-arrow" size={19} /></div>
      <h3>{service.name}</h3><span className="category-label">{service.category}</span>
      <div className="card-metrics"><div><span className="metric-label">ACTIVE USERS</span>
        <strong><Users size={14} />{service.users?.toLocaleString() ?? 'Not available'}</strong></div>
        <div><span className="metric-label">MONTHLY SPEND</span><strong>{money(service.spend, service.currency)}</strong></div></div>
      <div className="card-outcome"><Status status={service.status} />
        {service.savings !== null && service.savings > 0 && <span className="saving-mini">Save {money(service.savings, service.currency)}/mo</span>}
      </div>
    </button>
    {service.users === null && <button className="sso-card-button" onClick={onSso}
      disabled={disabled || ['queued', 'searching'].includes(service.status)}><KeyRound size={13} />Get with SSO</button>}
  </article>
);
