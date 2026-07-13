import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  organizationId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();
