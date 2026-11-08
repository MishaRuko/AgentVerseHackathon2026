'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, KeyRound, LoaderCircle, RefreshCw, Save, X } from 'lucide-react';
import type { Subscription } from '@/lib/schemas';
import { money, ServiceAvatar, Status } from './subscription-card';

export const ServiceDetail = ({ service, open, onClose, onEdit, onSso, onRetry, busy }: {
  service: Subscription; open: boolean; onClose: () => void;
  onEdit: (users: number | null, spend: number | null) => Promise<void>;
  onSso: () => void; onRetry: () => void; busy: boolean;
}) => {
  const [users, setUsers] = useState(service.users?.toString() ?? '');
  const [spend, setSpend] = useState(service.spend?.toString() ?? '');
  const working = busy || ['queued', 'searching'].includes(service.status);
  const dirty = (users === '' ? null : Number(users)) !== service.users
    || (spend === '' ? null : Number(spend)) !== service.spend;
  return <Dialog.Root modal={false} open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
    <Dialog.Portal><Dialog.Content className="detail-panel" onInteractOutside={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}>
      <Dialog.Close className="icon-button dialog-close" aria-label="Close subscription details"><X size={19} /></Dialog.Close>
      <div className="detail-title"><ServiceAvatar name={service.name} category={service.category} /><div>
        <span className="eyebrow">{service.category}</span>
        <Dialog.Title>{service.name}</Dialog.Title></div></div>
      <Dialog.Description className="sr-only">Subscription details, usage and available plans.</Dialog.Description>
      <div className="detail-status"><Status status={service.status} /></div>
      {service.error && <div className="notice error" role="alert">{service.error}</div>}
      {service.suggested_tier && <div className={`recommendation ${service.savings ? '' : 'neutral'}`}>
        <div className="recommendation-label"><ArrowDownRight size={18} />{service.savings ? 'A LITTLE SWITCH. A BIG DIFFERENCE.' : 'YOUR RIGHT-SIZED PLAN'}</div>
        <div className="recommendation-amount">{service.savings ? money(service.savings, service.currency) : money(service.optimal_spend, service.currency)}<span> / month{service.savings ? ' in potential savings' : ' estimated cost'}</span></div>
        <p>{service.suggested_tier}{service.savings ? ` · ${money(service.savings * 12, service.currency)} saved per year` : ' · based on active users'}</p>
      </div>}
      <form className="detail-data" onSubmit={async (event) => {
        event.preventDefault(); if (dirty) await onEdit(users === '' ? null : Number(users), spend === '' ? null : Number(spend));
      }}>
        <label><span>Active users <span className="source-tag">{service.user_source ?? 'Missing'}</span></span>
          <input type="number" min="0" max="10000000" step="1" value={users} disabled={working}
            placeholder="Add user count" onChange={(event) => setUsers(event.target.value)} />
          <small>{service.user_source === 'SSO' ? 'Distinct SSO users · last 3 months' : 'Count people, not purchased seats'}</small></label>
        <label><span>Monthly spend <span className="source-tag">{service.currency}</span></span>
          <input type="number" min="0" step="0.01" value={spend} disabled={working}
            placeholder="Not available" onChange={(event) => setSpend(event.target.value)} /><small>Annual costs are normalised to monthly</small></label>
        <div className="detail-data-actions"><button className="button small" type="button" onClick={onSso} disabled={working}><KeyRound size={14} />Get with SSO</button>
          <button className="button small" type="submit" disabled={working || !dirty}><Save size={14} />Save & analyse</button></div>
      </form>
      <section className="detail-section"><h3>The recommendation</h3>
        <p className="explanation">{service.explanation || 'Our agent is looking for the right fit. Research continues even if you close this tab.'}</p></section>
      <section className="detail-section"><div className="section-heading"><h3>Available plans <span className="count">{service.tiers.length}</span></h3>
        <button className="text-link" onClick={onRetry} disabled={working}>{working ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />}Re-analyse</button></div>
        {service.tiers.length === 0 ? <div className="empty-tiers">Available plans will appear here when research is complete.</div> :
          <div className="tier-list">{service.tiers.map((tier, index) => <details className={`tier-row ${tier.name === service.suggested_tier ? 'recommended-tier' : ''}`} key={`${tier.name}-${index}`}>
            <summary><span><strong>{tier.name}</strong>{tier.name === service.suggested_tier && <span className="recommended-label">BEST FIT</span>}
              <small>{tier.min_users}–{tier.max_users?.toLocaleString() ?? 'unlimited'} users</small></span>
              <span className="tier-price">{tier.monthly_price === null ? 'Custom quote' : money(tier.monthly_price, tier.currency)}
                {tier.monthly_price !== null && <small>/{tier.per_user ? 'user/' : ''}mo</small>}</span></summary>
            <p>{tier.description}</p>{tier.minimum_seats > 1 && <p>Minimum purchase: {tier.minimum_seats} seats.</p>}
            {tier.source_url.startsWith('https://') && <a className="text-link" href={tier.source_url} target="_blank" rel="noopener noreferrer">View pricing source<ArrowUpRight size={13} /></a>}
          </details>)}</div>}
        {service.researched_at && <p className="fine-print">Researched {new Date(service.researched_at).toLocaleDateString('en-GB')}.</p>}
      </section>
      {service.events.length > 0 && <details className="activity"><summary>Agent activity · {service.events.length} events</summary>
        {service.events.map((event, index) => <p key={index}>{event}</p>)}</details>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
};
