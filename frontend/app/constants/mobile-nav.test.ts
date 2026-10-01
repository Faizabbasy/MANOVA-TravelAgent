import { describe, expect, it } from 'vitest'
import { INTERNAL_MOBILE_TABS } from './mobile-nav'
import { NAV_ITEMS, findNavItemForPath, flattenNavItems } from './navigation'
import { getMenuLevel, RANK, matchesAnyRole } from '~/data/rbac'
import type { RoleId } from '~/types/user'
import { getVisibleNavItems } from '~/utils/nav-visibility'

/** The server-backed finance screens; the old mock finance routes must never be linked again. */
const FINANCE_ROUTES = ['/finance', '/finance/statement', '/finance/accounts', '/finance/receivables', '/finance/payables', '/finance/cash-flow']

function gatesFor (role: RoleId) {
  return {
    isRole: (...roles: string[]) => matchesAnyRole(role, roles as RoleId[]),
    canViewMenu: (menuKey: string, moduleKey?: string) => RANK[getMenuLevel(role, menuKey, moduleKey as never)] >= RANK.VIEW
  }
}

const routesOf = (items: ReturnType<typeof getVisibleNavItems>) => flattenNavItems(items).map(item => item.to.split('?')[0]!)

describe('mobile nav (V2 shell on the monorepo RBAC)', () => {
  it('bottom tabs are not role-filtered, so every internal role must be allowed to open each one', () => {
    for (const role of ['super-admin', 'admin', 'finance'] as RoleId[]) {
      for (const tab of INTERNAL_MOBILE_TABS.filter(t => t.to !== '/')) {
        const item = findNavItemForPath(tab.to)
        expect(item?.moduleKey, tab.to).toBeDefined()
        expect(gatesFor(role).canViewMenu(item!.key, item!.moduleKey), `${role} ${tab.to}`).toBe(true)
      }
    }
  })

  it('links only the server-backed finance routes', () => {
    const finance = flattenNavItems(NAV_ITEMS).map(item => item.to.split('?')[0]!).filter(to => to.startsWith('/finance'))
    for (const to of finance) { expect(FINANCE_ROUTES).toContain(to) }
  })

  it('admin sees no finance entry in the Menu Lainnya sheet; finance does', () => {
    expect(routesOf(getVisibleNavItems(NAV_ITEMS, gatesFor('admin'))).filter(to => to.startsWith('/finance'))).toEqual([])
    expect(routesOf(getVisibleNavItems(NAV_ITEMS, gatesFor('finance')))).toContain('/finance')
  })
})
