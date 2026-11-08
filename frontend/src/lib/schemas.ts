import { z } from 'zod';

export const tierSchema = z.object({
  name: z.string(), min_users: z.number(), max_users: z.number().nullable(),
  monthly_price: z.number().nullable(), per_user: z.boolean(), minimum_seats: z.number(),
  currency: z.string(), description: z.string(), source_url: z.string(),
});
export const subscriptionSchema = z.object({
  id: z.string(), name: z.string(), users: z.number().nullable(),
  user_source: z.enum(['Manual', 'SSO']).nullable(), spend: z.number().nullable(),
  currency: z.string(), category: z.string(), status: z.string(),
  tiers: z.array(tierSchema), suggested_tier: z.string().nullable(),
  optimal_spend: z.number().nullable(), savings: z.number().nullable(),
  explanation: z.string(), error: z.string().nullable(), demo: z.boolean(),
  researched_at: z.string().nullable(), sso_checked_at: z.string().nullable(),
  events: z.array(z.string()),
});
export const workspaceInfoSchema = z.object({ id: z.string(), name: z.string() });
export const workspaceSchema = z.object({
  id: z.string(), workspaces: z.array(workspaceInfoSchema),
  services: z.array(subscriptionSchema), pending_jobs: z.number(),
  ai_configured: z.boolean(), sso_mode: z.string(),
});
export const filterSchema = z.object({
  query: z.string(), category: z.string(), status: z.string(), savings_only: z.boolean(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Filters = z.infer<typeof filterSchema>;
