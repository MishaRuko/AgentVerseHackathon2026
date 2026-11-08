import type { Filters, Subscription } from './schemas';

export const EMPTY_FILTERS: Filters = {
  query: '', category: 'All', status: 'All', savings_only: false,
  min_users: null, max_users: null, min_spend: null, max_spend: null,
  min_savings: null, user_source: 'All', currency: 'All',
};

const inRange = (value: number | null, min: number | null, max: number | null) =>
  (min === null || (value !== null && value >= min))
  && (max === null || (value !== null && value <= max));

export const matchesFilters = (service: Subscription, filters: Filters) =>
  (filters.category === 'All' || service.category === filters.category)
  && (filters.status === 'All' || service.status === filters.status)
  && (!filters.savings_only || (service.savings ?? 0) > 0)
  && inRange(service.users, filters.min_users, filters.max_users)
  && inRange(service.spend, filters.min_spend, filters.max_spend)
  && inRange(service.savings, filters.min_savings, null)
  && (filters.user_source === 'All'
    || (filters.user_source === 'Missing' ? service.users === null : service.user_source === filters.user_source))
  && (filters.currency === 'All' || service.currency === filters.currency);

export const advancedFilterCount = (filters: Filters) =>
  [filters.min_users, filters.max_users, filters.min_spend, filters.max_spend, filters.min_savings]
    .filter((value) => value !== null).length
  + Number(filters.user_source !== 'All') + Number(filters.currency !== 'All');
