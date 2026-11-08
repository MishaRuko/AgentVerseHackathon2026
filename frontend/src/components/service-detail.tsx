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
  const [chosenPeriod, setChosenPeriod] = useState(service.suggested_billing_period ?? 'monthly');
  const periods = [...new Set(service.tiers.map((tier) => tier.billing_period))];
  const period = periods.includes(chosenPeriod) ? chosenPeriod : periods[0];
  const recommendation = service.recommendations.find((item) => item.billing_period === period);
  const annualSavings = recommendation ? recommendation.annual_savings ??
    (service.spend !== null ? Math.max(0, service.spend * 12 - recommendation.annual_cost) : null) : null;
  const savings = period === 'annual' ? annualSavings : recommendation?.monthly_savings;
  const planCost = (period === 'annual' ? recommendation?.annual_cost : recommendation?.monthly_cost) ?? null;
  const tiers = service.tiers.map((tier, index) => ({ ...tier, index }))
    .filter((tier) => tier.billing_period === period);
  const periodLabel = (value: string) => value === 'annual' ? 'Yearly' : value === 'monthly' ? 'Monthly' : 'Other billing';
  const events = service.events.filter((event) => !/Pricing search unavailable|Alternative pricing plans prepared/i.test(event));
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
      {service.description && <p className="service-description">{service.description}</p>}
      {service.tags.length > 0 && <div className="metadata-tags">{service.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {service.error && <div className="notice error" role="alert">{service.error}</div>}
      {periods.length > 1 ? <div className="billing-tabs" role="tablist" aria-label="Billing options">
        {periods.map((value) => <button key={value} role="tab" aria-selected={period === value}
          id={`billing-tab-${value}`} tabIndex={period === value ? 0 : -1}
          aria-controls="billing-plans" onClick={() => setChosenPeriod(value)} onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? periods.length - 1
              : (periods.indexOf(value) + (event.key === 'ArrowRight' ? 1 : -1) + periods.length) % periods.length;
            setChosenPeriod(periods[index]);
            document.getElementById(`billing-tab-${periods[index]}`)?.focus();
          }}>{periodLabel(value)}</button>)}
      </div> : periods.length === 1 && <p className="billing-label">{period === 'annual' ? 'Showing yearly plans · paid annually' : period === 'monthly' ? 'Showing monthly plans' : 'Billing commitment not specified'}</p>}
      {recommendation && <div className={`recommendation ${savings ? '' : 'neutral'}`}>
        <div className="recommendation-label"><ArrowDownRight size={18} />{periodLabel(period)} · {savings === 0 ? 'NO SAVINGS ON THIS BILLING OPTION' : savings ? 'POTENTIAL SAVINGS' : 'YOUR RIGHT-SIZED PLAN'}</div>
        <div className="recommendation-amount">{money(savings || planCost, service.currency)}<span> / {period === 'annual' ? 'year' : 'month'}{savings ? ' in potential savings' : ' plan cost'}</span></div>
        <p>{recommendation.tier_name} · {period === 'annual' ? `${money(recommendation.annual_cost, service.currency)} paid yearly` : period === 'monthly' ? `${money(recommendation.monthly_cost, service.currency)} paid monthly` : `${money(recommendation.monthly_cost, service.currency)}/month equivalent`}</p>
        {period !== 'annual' && Boolean(savings) && <p>{money(annualSavings, service.currency)} saved per year</p>}
      </div>}
      {period && !recommendation && service.users !== null && tiers.length > 0 && <p className="billing-label">No priced {periodLabel(period).toLowerCase()} option covers this user count.</p>}
      {service.recommendations.length > 1 && <div className="billing-comparisons">
        {service.recommendations.map((item) => <button key={item.billing_period}
          className={period === item.billing_period ? 'selected-comparison' : ''}
          onClick={() => setChosenPeriod(item.billing_period)}><span>{periodLabel(item.billing_period)}<small>{item.tier_name}</small></span>
          <span>{money(item.monthly_cost, service.currency)}/mo<small>{item.billing_period === 'annual' ? `${money(item.annual_cost, service.currency)}/year upfront` : item.billing_period === 'monthly' ? 'Rolling monthly billing' : 'Billing commitment unspecified'}</small></span>
        </button>)}
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
      <section className="detail-section" id="billing-plans" role={periods.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={periods.length > 1 ? `billing-tab-${period}` : undefined}><div className="section-heading"><h3>{period ? `${periodLabel(period)} plans` : 'Available plans'} <span className="count">{tiers.length}</span></h3>
        <button className="text-link" onClick={onRetry} disabled={working}>{working ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />}Re-analyse</button></div>
        {service.tiers.length === 0 ? <div className="empty-tiers">Available plans will appear here when research is complete.</div> :
          <div className="tier-list">{tiers.map((tier) => <details className={`tier-row ${tier.index === recommendation?.tier_index ? 'recommended-tier' : ''}`} key={`${tier.name}-${tier.index}`}>
            <summary><span><strong>{tier.name}</strong>{tier.index === recommendation?.tier_index && <span className="recommended-label">BEST FIT</span>}
              <small>{tier.min_users}–{tier.max_users?.toLocaleString() ?? 'unlimited'} users</small></span>
              <span className="tier-price">{tier.monthly_price === null ? 'Custom quote' : money(tier.monthly_price * (period === 'annual' ? 12 : 1), tier.currency)}
                {tier.monthly_price !== null && <small>/{tier.per_user ? 'user/' : ''}{period === 'annual' ? 'yr' : 'mo'}</small>}</span></summary>
            {tier.monthly_price !== null && period === 'annual' && <p>{money(tier.monthly_price, tier.currency)}/{tier.per_user ? 'user/' : ''}month equivalent, paid annually.</p>}
            <p>{tier.description}</p>{tier.minimum_seats > 1 && <p>Minimum purchase: {tier.minimum_seats} seats.</p>}
            {tier.source_url.startsWith('https://') && <a className="text-link" href={tier.source_url} target="_blank" rel="noopener noreferrer">View pricing source<ArrowUpRight size={13} /></a>}
          </details>)}</div>}
        {service.researched_at && <p className="fine-print">Researched {new Date(service.researched_at).toLocaleDateString('en-GB')}.</p>}
      </section>
      {events.length > 0 && <details className="activity"><summary>Agent activity · {events.length} events</summary>
        {events.map((event, index) => <p key={index}>{event}</p>)}</details>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
};
