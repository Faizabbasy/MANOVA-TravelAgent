import { resolveRoleId } from './rbac'
import type { RoleId } from '~/types/user'

/**
 * Which server data the dashboard layout loads for a role (S12a). Internal roles load every module. A portal user
 * loads only what its portal may read: the other lists answer 403 for it, and loading them would raise a permanent
 * "not synced" banner or overwrite the portal's local data with the reduced portal view.
 */
export type SyncKey =
  | 'projects' | 'customers' | 'vendors' | 'bookings' | 'procurement' | 'leads' | 'salesOrders' | 'travelers' | 'itinerary'
  | 'workItems' | 'activity' | 'changes' | 'documents' | 'notifications' | 'users' | 'masterData' | 'inventory' | 'marketing' | 'hr'
  | 'clientCommerce' | 'vendorPortal'

const INTERNAL: SyncKey[] = [
  'projects', 'customers', 'vendors', 'bookings', 'procurement', 'leads', 'salesOrders', 'travelers', 'itinerary', 'workItems',
  'activity', 'changes', 'documents', 'notifications', 'users', 'masterData', 'inventory', 'marketing', 'hr'
]
/** S12a: the client reads its own projects, participants, itinerary, changes, documents & messages, notifications; S12a-2: its sent quotations, reservations and invoices. */
const CLIENT: SyncKey[] = ['projects', 'travelers', 'itinerary', 'changes', 'documents', 'notifications', 'clientCommerce']
/** S12d: the vendor reads its projects, notifications, own service orders & quotations (procurement), services & bookings, and its profile & products. */
const VENDOR: SyncKey[] = ['projects', 'notifications', 'procurement', 'bookings', 'vendorPortal']

export function syncPlanFor (role: RoleId): SyncKey[] {
  const resolved = resolveRoleId(role)
  if (resolved === 'client') { return [...CLIENT] }
  if (resolved === 'vendor') { return [...VENDOR] }
  return [...INTERNAL]
}
