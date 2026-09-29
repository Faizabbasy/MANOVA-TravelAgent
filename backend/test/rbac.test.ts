import { describe, expect, test } from 'bun:test'
import {
  canRoleSignIn,
  CAPABILITY_KEYS,
  hasCapability,
  hasModuleLevel,
  moduleLevel,
  MODULE_KEYS,
  permissionsOf,
  ROLE_IDS,
  type RoleId
} from '../src/auth/rbac'

const INTERNAL: RoleId[] = ['admin', 'finance']

describe('server RBAC matrix (3 roles)', () => {
  test('role keys match the frontend ROLE_DEFINITIONS', () => {
    expect([...ROLE_IDS]).toEqual(['super-admin', 'admin', 'finance', 'client', 'vendor'])
  })

  test('only super-admin, admin and finance may sign in; portals only when PORTAL_LOGIN is on', () => {
    expect(ROLE_IDS.filter(r => canRoleSignIn(r, false))).toEqual(['super-admin', 'admin', 'finance'])
    expect(ROLE_IDS.filter(r => canRoleSignIn(r, true))).toEqual(['super-admin', 'admin', 'finance', 'client', 'vendor'])
  })

  test('admin manages every business module except Finance', () => {
    expect(moduleLevel('admin', 'finance-acc')).toBe('NONE')
    for (const m of ['sales', 'crm', 'operations'] as const) expect(moduleLevel('admin', m)).toBe('APPROVE')
    for (const m of ['vendor-partner', 'inventory', 'marketing', 'hr', 'bi', 'administration', 'documents'] as const) {
      expect(moduleLevel('admin', m)).toBe('MANAGE')
    }
    expect(moduleLevel('admin', 'client-portal')).toBe('NONE')
    expect(moduleLevel('admin', 'vendor-portal')).toBe('NONE')
  })

  test('finance owns finance-acc and only views the rest', () => {
    expect(moduleLevel('finance', 'finance-acc')).toBe('MANAGE')
    for (const m of MODULE_KEYS) {
      if (m === 'finance-acc') continue
      expect(hasModuleLevel('finance', m, 'MANAGE'), m).toBe(false)
    }
    expect(moduleLevel('finance', 'operations')).toBe('VIEW')
  })

  test('super-admin can do both: every module at ADMIN, every capability', () => {
    for (const m of MODULE_KEYS) expect(moduleLevel('super-admin', m)).toBe('ADMIN')
    for (const c of CAPABILITY_KEYS) expect(hasCapability('super-admin', c)).toBe(true)
  })

  test('portal roles have no internal module access and no capabilities', () => {
    for (const role of ['client', 'vendor'] as RoleId[]) {
      for (const m of ['sales', 'finance-acc', 'crm', 'operations', 'vendor-partner'] as const) {
        expect(hasModuleLevel(role, m, 'VIEW')).toBe(false)
      }
      for (const c of CAPABILITY_KEYS) expect(hasCapability(role, c)).toBe(false)
    }
  })

  test('admin holds no finance.* capability; every finance.* capability is finance-only (or super-admin only)', () => {
    const financeCaps = CAPABILITY_KEYS.filter(c => c.startsWith('finance.'))
    expect(financeCaps.filter(c => hasCapability('admin', c))).toEqual([])
    for (const c of financeCaps) {
      expect(INTERNAL.filter(r => hasCapability(r, c)), c).toEqual(c === 'finance.approve-opening-balance' ? [] : ['finance'])
    }
  })

  test('opening balance stays maker/checker: finance makes, only super-admin approves', () => {
    expect(hasCapability('finance', 'finance.manage-bank-accounts')).toBe(true)
    expect(hasCapability('finance', 'finance.approve-opening-balance')).toBe(false)
    expect(hasCapability('super-admin', 'finance.approve-opening-balance')).toBe(true)
  })

  test('users and roles stay super-admin only, so admin cannot grant itself Finance', () => {
    for (const r of INTERNAL) {
      expect(hasCapability(r, 'admin.manage-users')).toBe(false)
      expect(hasCapability(r, 'admin.manage-roles')).toBe(false)
    }
    expect(hasCapability('admin', 'admin.manage-master-data')).toBe(true)
  })

  test('operational capabilities belong to admin; margin is visible to admin and finance', () => {
    for (const c of ['project-order.close', 'sales.approve-quotation', 'crm.manage-party', 'hr.manage-payroll', 'inventory.manage-asset'] as const) {
      expect(INTERNAL.filter(r => hasCapability(r, c)), c).toEqual(['admin'])
    }
    expect(INTERNAL.filter(r => hasCapability(r, 'project-order.view-margin'))).toEqual(['admin', 'finance'])
  })

  test('permissionsOf lists every module and only granted capabilities', () => {
    const p = permissionsOf('admin')
    expect(Object.keys(p.modules)).toHaveLength(13)
    expect(p.capabilities).toContain('project-order.close')
    expect(p.capabilities).not.toContain('finance.post-cash')
  })
})
