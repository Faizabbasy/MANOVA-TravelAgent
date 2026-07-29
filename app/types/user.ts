import type { ID } from './common'

export type RoleId =
  | 'super-admin'
  | 'management'
  | 'sales'
  | 'project-manager'
  | 'operations'
  | 'ticketing'
  | 'accommodation'
  | 'transportation'
  | 'mice'
  | 'finance'
  | 'viewer'

export type PermissionLevel = 'NONE' | 'VIEW' | 'MANAGE' | 'APPROVE' | 'ADMIN'

export type ModuleKey =
  | 'crm'
  | 'project'
  | 'vendor'
  | 'finance'
  | 'reports'
  | 'administration'

export interface User {
  id: ID
  name: string
  email: string
  role: RoleId
}
