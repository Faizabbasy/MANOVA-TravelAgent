import { describe, it, expect } from 'vitest'
import { NAV_ITEMS, HIDDEN_NAV_ROUTES, flattenNavItems, findNavItemForPath } from './navigation'
import { isKnownModuleKey, LEGACY_MODULE_ALIAS } from './modules'

/**
 * Penjaga integritas navigasi (Penyederhanaan 7-Role/Menu, Agustus 2026 — konsolidasi 92 → ±23 entri
 * internal via pola tab-container).
 *
 * `RoleMenuGrant` menempel pada `NavItem.key`, dan module key yang salah ketik akan membuat halaman
 * hilang DIAM-DIAM (karena `RANK[undefined] >= RANK.VIEW` bernilai `false`, bukan error). Kedua kelas bug
 * itu tidak akan pernah terlihat saat mengklik-klik UI, jadi dijaga di sini.
 */
describe('Navigasi', () => {
  const allItems = flattenNavItems()

  it('setiap entri punya key yang unik', () => {
    const seen = new Map<string, number>()
    for (const item of allItems) {
      seen.set(item.key, (seen.get(item.key) ?? 0) + 1)
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key)
    expect(duplicates).toEqual([])
  })

  it('setiap entri punya key, label, dan route yang terisi', () => {
    const invalid = allItems.filter(item => !item.key || !item.label || !item.to)
    expect(invalid.map(item => item.label)).toEqual([])
  })

  it('setiap moduleKey dikenal atau punya alias', () => {
    const unknown = allItems
      .filter(item => item.moduleKey)
      .filter(item => !isKnownModuleKey(item.moduleKey!) && !LEGACY_MODULE_ALIAS[item.moduleKey!])
      .map(item => `${item.key} → ${item.moduleKey}`)
    expect(unknown).toEqual([])
  })

  it('hanya mendukung satu level nesting (AppSidebar tidak merender lebih dalam)', () => {
    const tooDeep = NAV_ITEMS
      .flatMap(item => item.children ?? [])
      .filter(child => child.children?.length)
      .map(child => child.key)
    expect(tooDeep).toEqual([])
  })

  it('key anak diawali prefix key induknya agar mudah dibaca di builder role', () => {
    const mismatched: string[] = []
    for (const parent of NAV_ITEMS) {
      for (const child of parent.children ?? []) {
        const parentPrefix = parent.key.split('.')[0]
        if (!child.key.startsWith(`${parentPrefix}.`)) { mismatched.push(`${parent.key} → ${child.key}`) }
      }
    }
    expect(mismatched).toEqual([])
  })

  /**
   * `HIDDEN_NAV_ROUTES` (Penyederhanaan 7-Role/Menu) — route lama yang sudah tidak tampil di sidebar
   * (menu-nya dilebur jadi tab di menu lain) tapi tetap harus tergerbang lewat `findNavItemForPath`. Sama
   * seperti `NAV_ITEMS`, salah ketik `moduleKey` atau key bentrok di sini membuat gerbangnya diam-diam
   * tidak berfungsi.
   */
  describe('HIDDEN_NAV_ROUTES', () => {
    it('key tidak bentrok dengan NAV_ITEMS maupun sesamanya', () => {
      const navKeys = new Set(allItems.map(item => item.key))
      const seen = new Map<string, number>()
      for (const route of HIDDEN_NAV_ROUTES) {
        seen.set(route.key, (seen.get(route.key) ?? 0) + 1)
      }
      const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key)
      const collidesWithNav = HIDDEN_NAV_ROUTES.filter(route => navKeys.has(route.key)).map(route => route.key)
      expect(duplicates).toEqual([])
      expect(collidesWithNav).toEqual([])
    })

    it('setiap entri punya key, label, to, dan moduleKey yang terisi', () => {
      const invalid = HIDDEN_NAV_ROUTES.filter(route => !route.key || !route.label || !route.to || !route.moduleKey)
      expect(invalid.map(route => route.key)).toEqual([])
    })

    it('setiap moduleKey dikenal atau punya alias', () => {
      const unknown = HIDDEN_NAV_ROUTES
        .filter(route => !isKnownModuleKey(route.moduleKey!) && !LEGACY_MODULE_ALIAS[route.moduleKey!])
        .map(route => `${route.key} → ${route.moduleKey}`)
      expect(unknown).toEqual([])
    })
  })

  describe('findNavItemForPath', () => {
    it('mencocokkan rute detail ke entri induknya', () => {
      expect(findNavItemForPath('/project-orders/PRJ-101')?.key).toBe('operations')
      expect(findNavItemForPath('/supplier/rfq/RFQ-001')?.key).toBe('vendor-portal.rfq')
      expect(findNavItemForPath('/product-planning/PT-001')?.key).toBe('hidden.product-planning')
    })

    it('memilih kecocokan paling spesifik, bukan yang pertama ditemukan', () => {
      expect(findNavItemForPath('/finance/invoices')?.key).toBe('finance.invoices')
      expect(findNavItemForPath('/bookings/exceptions')?.key).toBe('hidden.booking-exceptions')
    })

    it('rute di luar navigasi tidak dicocokkan paksa (diserahkan ke guard halaman)', () => {
      expect(findNavItemForPath('/settings')).toBeUndefined()
      expect(findNavItemForPath('/login')).toBeUndefined()
    })

    it('root hanya cocok persis, tidak menangkap seluruh path', () => {
      expect(findNavItemForPath('/')?.key).toBe('dashboard')
      expect(findNavItemForPath('/finance')?.key).not.toBe('dashboard')
    })

    /**
     * Route lama yang menu-nya sudah dilebur (Penyederhanaan 7-Role/Menu) — tanpa `HIDDEN_NAV_ROUTES`,
     * `rbac.global.ts` akan menganggapnya "di luar navigasi" dan melewatkannya begitu saja ke guard
     * halaman, padahal sebagian route detail-nya (mis. `/client/quotations/[id]`) adalah halaman nyata,
     * bukan sekadar redirect stub.
     */
    it('route lama yang sudah dilebur tetap tergerbang lewat HIDDEN_NAV_ROUTES', () => {
      expect(findNavItemForPath('/projects/PRJ-101')?.key).toBe('hidden.projects-legacy')
      expect(findNavItemForPath('/crm/opportunities/OPP-001')?.key).toBe('hidden.opportunities')
      expect(findNavItemForPath('/ticketing/SVC-001')?.key).toBe('hidden.ticketing')
      expect(findNavItemForPath('/client/quotations/QUO-001')?.key).toBe('hidden.client-quotations')
      expect(findNavItemForPath('/client/quotations/QUO-001')?.moduleKey).toBe('client-portal')
      expect(findNavItemForPath('/supplier/commodity-orders/CO-001')?.key).toBe('hidden.supplier-commodity-orders')
    })
  })
})
