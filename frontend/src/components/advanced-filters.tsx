'use client';

import * as Popover from '@radix-ui/react-popover';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Filters } from '@/lib/schemas';
import { advancedFilterCount } from '@/lib/filters';

export const AdvancedFilters = ({ filters, onChange }: {
  filters: Filters; onChange: (filters: Filters) => void;
}) => {
  const count = advancedFilterCount(filters);
  return <Popover.Root><Popover.Trigger className="button more-filters">
    <SlidersHorizontal size={14} />More filters{count > 0 && <span className="count">{count}</span>}
  </Popover.Trigger><Popover.Portal><Popover.Content className="chat-popover filter-popover" sideOffset={10} align="end">
    <div className="section-heading"><strong>Usage & spend</strong>
      <Popover.Close className="icon-button" aria-label="Close advanced filters"><X size={16} /></Popover.Close></div>
    <div className="filter-fields">{([
      ['min_users', 'Minimum users'], ['max_users', 'Maximum users'],
      ['min_spend', 'Minimum monthly spend'], ['max_spend', 'Maximum monthly spend'],
      ['min_savings', 'Minimum monthly savings'],
    ] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min="0"
      step={key.includes('users') ? '1' : '0.01'} placeholder="Any" value={filters[key] ?? ''}
      onChange={(event) => onChange({ ...filters, [key]: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })} />
    </label>)}
      <label>Currency<select value={filters.currency} onChange={(event) => onChange({
        ...filters, currency: event.target.value as Filters['currency'],
      })}><option>All</option><option>GBP</option><option>USD</option><option>EUR</option></select></label>
      <label>User data source<select value={filters.user_source} onChange={(event) => onChange({
        ...filters, user_source: event.target.value as Filters['user_source'],
      })}><option>All</option><option>SSO</option><option>Manual</option><option>Missing</option></select></label>
      <label className="filter-checkbox"><input type="checkbox" checked={filters.savings_only}
        onChange={(event) => onChange({ ...filters, savings_only: event.target.checked })} />Savings available</label>
    </div><p>Spend and savings are monthly amounts. Unknown values are excluded from numeric ranges.</p>
  </Popover.Content></Popover.Portal></Popover.Root>;
};
