import { hasModuleLevel, ROLE_DEFINITIONS, type Actor } from '../../auth/rbac'

/**
 * Which projects an actor may see. The single place that turns identity into row scope; every core and
 * (later) finance query that touches projects must go through `projectScopeSql`.
 *
 *  - client: projects of their own party (users.party_id)
 *  - vendor: projects where they hold a service (project_services.vendor_id) or a service order
 *  - internal: all projects when the role can view Operations — the frontend mock has no per-project
 *    scoping for internal roles either (project.ownerId / teamUserIds are "mine" filters, not access rules)
 */
export type ProjectScope =
  | { kind: 'all' }
  | { kind: 'party'; partyId: string }
  | { kind: 'vendor'; vendorId: string }
  | { kind: 'none' }

export function projectScopeOf(actor: Actor): ProjectScope {
  if (actor.role === 'client') return actor.partyId ? { kind: 'party', partyId: actor.partyId } : { kind: 'none' }
  if (actor.role === 'vendor') return actor.vendorId ? { kind: 'vendor', vendorId: actor.vendorId } : { kind: 'none' }
  return hasModuleLevel(actor.role, 'operations', 'VIEW') ? { kind: 'all' } : { kind: 'none' }
}

/** SQL predicate over alias `p` (projects). Appends its bind values to `params`. */
export function projectScopeSql(scope: ProjectScope, params: unknown[]): string {
  switch (scope.kind) {
    case 'all':
      return 'true'
    case 'none':
      return 'false'
    case 'party':
      params.push(scope.partyId)
      return `p.party_id = $${params.length}`
    case 'vendor':
      params.push(scope.vendorId)
      return `(exists (select 1 from project_services ps_scope where ps_scope.project_id = p.id and ps_scope.vendor_id = $${params.length})` +
        ` or exists (select 1 from service_orders so_scope where so_scope.project_id = p.id and so_scope.vendor_id = $${params.length}))`
  }
}

export const isPortalActor = (actor: Actor) => ROLE_DEFINITIONS[actor.role].kind === 'portal'

export function canListParties(actor: Actor): boolean {
  return !isPortalActor(actor) &&
    (hasModuleLevel(actor.role, 'crm', 'VIEW') || hasModuleLevel(actor.role, 'sales', 'VIEW') || hasModuleLevel(actor.role, 'finance-acc', 'VIEW'))
}

export function canListVendors(actor: Actor): boolean {
  return !isPortalActor(actor) &&
    (hasModuleLevel(actor.role, 'vendor-partner', 'VIEW') || hasModuleLevel(actor.role, 'finance-acc', 'VIEW'))
}
