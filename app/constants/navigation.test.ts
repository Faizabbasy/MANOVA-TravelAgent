import { describe, it, expect } from 'vitest'
import { NAV_ITEMS, flattenNavItems, findNavItemForPath } from './navigation'
import { isKnownModuleKey, LEGACY_MODULE_ALIAS } from './modules'

/**
 * Penjaga integritas navigasi (Revisi 9-Modul).
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

  describe('findNavItemForPath', () => {
    it('mencocokkan rute detail ke entri induknya', () => {
      expect(findNavItemForPath('/crm/opportunities/OPP-001')?.key).toBe('sales.opportunities')
      expect(findNavItemForPath('/project-orders/PRJ-101')?.key).toBe('operations.project-orders')
      expect(findNavItemForPath('/projects/PRJ-101')?.key).toBe('operations.projects-legacy')
      expect(findNavItemForPath('/supplier/rfq/RFQ-001')?.key).toBe('vendor-portal.rfq')
    })

    it('memilih kecocokan paling spesifik, bukan yang pertama ditemukan', () => {
      expect(findNavItemForPath('/finance/invoices')?.key).toBe('finance.invoices')
      expect(findNavItemForPath('/bookings/exceptions')?.key).toBe('operations.booking-exceptions')
    })

    it('rute di luar navigasi tidak dicocokkan paksa (diserahkan ke guard halaman)', () => {
      expect(findNavItemForPath('/settings')).toBeUndefined()
      expect(findNavItemForPath('/login')).toBeUndefined()
    })

    it('root hanya cocok persis, tidak menangkap seluruh path', () => {
      expect(findNavItemForPath('/')?.key).toBe('dashboard')
      expect(findNavItemForPath('/finance')?.key).not.toBe('dashboard')
    })
  })
})
