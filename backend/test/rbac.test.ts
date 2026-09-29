import { describe, expect, test } from 'bun:test'
import { CAPABILITY_KEYS, hasCapability, hasModuleLevel, moduleLevel, permissionsOf, ROLE_IDS, type RoleId } from '../src/auth/rbac'

const INTERNAL: RoleId[] = ['management', 'sales', 'finance', 'operations']

describe('server RBAC matrix', () => {
  test('role keys match the frontend ROLE_DEFINITIONS', () => {
    expect([...ROLE_IDS]).toEqual(['super-admin', 'management', 'sales', 'finance', 'operations', 'client', 'vendor'])
  })

  test('module levels mirror the frontend seed', () => {
    expect(moduleLevel('finance', 'finance-acc')).toBe('MANAGE')
    expect(moduleLevel('management', 'finance-acc')).toBe('APPROVE')
    expect(moduleLevel('operations', 'finance-acc')).toBe('VIEW')
    expect(moduleLevel('sales', 'finance-acc')).toBe('NONE')
    expect(moduleLevel('operations', 'operations')).toBe('MANAGE')
    expect(moduleLevel('client', 'client-portal')).toBe('MANAGE')
    expect(moduleLevel('vendor', 'vendor-portal')).toBe('MANAGE')
    expect(moduleLevel('super-admin', 'administration')).toBe('ADMIN')
  })

  test('portal roles have no internal module access', () => {
    for (const role of ['client', 'vendor'] as RoleId[]) {
      for (const m of ['sales', 'finance-acc', 'crm', 'operations', 'vendor-partner'] as const) {
        expect(hasModuleLevel(role, m, 'VIEW')).toBe(false)
      }
    }
  })

  test('super-admin holds every capability; portal roles hold none', () => {
    for (const c of CAPABILITY_KEYS) {
      expect(hasCapability('super-admin', c)).toBe(true)
      expect(hasCapability('client', c)).toBe(false)
      expect(hasCapability('vendor', c)).toBe(false)
    }
  })

  test('only finance posts cash, manages accounts, receivables, payables and policy', () => {
    for (const c of ['finance.post-cash', 'finance.manage-bank-accounts', 'finance.manage-receivables', 'finance.manage-payables', 'finance.manage-policy', 'finance.settle-refund'] as const) {
      expect(INTERNAL.filter(r => hasCapability(r, c))).toEqual(['finance'])
    }
  })

  test('opening balance is maker/checker: no internal role can both manage accounts and approve openings', () => {
    for (const r of INTERNAL) {
      expect(hasCapability(r, 'finance.manage-bank-accounts') && hasCapability(r, 'finance.approve-opening-balance')).toBe(false)
    }
    expect(INTERNAL.filter(r => hasCapability(r, 'finance.approve-opening-balance'))).toEqual(['management'])
  })

  test('company cash and cash flow are limited to finance and management', () => {
    for (const c of ['finance.view-cash', 'finance.view-cash-flow'] as const) {
      expect(INTERNAL.filter(r => hasCapability(r, c))).toEqual(['management', 'finance'])
    }
    expect(INTERNAL.filter(r => hasCapability(r, 'finance.view-project-finance'))).toEqual(['management', 'finance', 'operations'])
  })

  test('pre-existing frontend finance capabilities keep their grants', () => {
    expect(INTERNAL.filter(r => hasCapability(r, 'finance.record-payment'))).toEqual(['finance'])
    expect(INTERNAL.filter(r => hasCapability(r, 'finance.close-period'))).toEqual(['management', 'finance'])
  })

  test('permissionsOf lists every module and only granted capabilities', () => {
    const p = permissionsOf('operations')
    expect(Object.keys(p.modules)).toHaveLength(13)
    expect(p.capabilities).toContain('project-order.close')
    expect(p.capabilities).not.toContain('finance.post-cash')
  })
})
