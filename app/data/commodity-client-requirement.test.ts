import { describe, it, expect } from 'vitest'
import {
  createCommodityRequirement, getCommodityRequirementsByProject, getCommodityRequirementById,
  updateCommodityRequirementStatus, updateCommodityRequirement, deleteCommodityRequirement,
  isCommodityRequirementEditable, isCommodityRequirementDeletable
} from './index'

describe('Commodity domain — Phase 3 (Client Requirement CRUD, project isolation)', () => {
  describe('Project ownership isolation', () => {
    it('getCommodityRequirementsByProject tidak membocorkan requirement project lain', () => {
      createCommodityRequirement({ projectId: 'PRJ-ISO-A', clientPartyId: 'PTY-001', category: 'hotel', title: 'Milik Project A', quantity: 1 })
      createCommodityRequirement({ projectId: 'PRJ-ISO-B', clientPartyId: 'PTY-002', category: 'hotel', title: 'Milik Project B', quantity: 1 })

      const projectAList = getCommodityRequirementsByProject('PRJ-ISO-A')
      const projectBList = getCommodityRequirementsByProject('PRJ-ISO-B')

      expect(projectAList.every(r => r.projectId === 'PRJ-ISO-A')).toBe(true)
      expect(projectBList.every(r => r.projectId === 'PRJ-ISO-B')).toBe(true)
      expect(projectAList.some(r => r.title === 'Milik Project B')).toBe(false)
      expect(projectBList.some(r => r.title === 'Milik Project A')).toBe(false)
    })

    it('requirement seed CRQ-001 (PRJ-101) tidak muncul saat query project lain', () => {
      const otherProjectList = getCommodityRequirementsByProject('PRJ-102')
      expect(otherProjectList.some(r => r.id === 'CRQ-001')).toBe(false)
    })
  })

  describe('Full CRUD lifecycle dalam satu project', () => {
    it('create -> edit (draft) -> transisi ke open -> edit ditolak -> delete (open) berhasil', () => {
      const requirement = createCommodityRequirement({
        projectId: 'PRJ-101',
        clientPartyId: 'PTY-001',
        category: 'hotel',
        title: 'Lifecycle Test Requirement',
        quantity: 3,
        detail: { category: 'hotel', checkInDate: '2026-09-01', checkOutDate: '2026-09-05', roomCount: 3 }
      })
      expect(requirement.status).toBe('draft')
      expect(isCommodityRequirementEditable(requirement.status)).toBe(true)

      const edited = updateCommodityRequirement(requirement.id, { title: 'Lifecycle Test Requirement (edited)' })
      expect(edited?.title).toBe('Lifecycle Test Requirement (edited)')

      const opened = updateCommodityRequirementStatus(requirement.id, 'open')
      expect(opened?.status).toBe('open')

      expect(isCommodityRequirementEditable('open')).toBe(false)
      expect(updateCommodityRequirement(requirement.id, { title: 'Harus Gagal' })).toBeUndefined()
      expect(getCommodityRequirementById(requirement.id)?.title).toBe('Lifecycle Test Requirement (edited)')

      expect(isCommodityRequirementDeletable('open')).toBe(true)
      expect(deleteCommodityRequirement(requirement.id)).toBe(true)
      expect(getCommodityRequirementById(requirement.id)).toBeUndefined()
    })

    it('requirement yang sudah masuk matching/selection tidak dapat diedit maupun dihapus langsung ("confirmed")', () => {
      const requirement = createCommodityRequirement({ projectId: 'PRJ-101', clientPartyId: 'PTY-001', category: 'mice', title: 'Matching Requirement', quantity: 1 })
      updateCommodityRequirementStatus(requirement.id, 'open')
      updateCommodityRequirementStatus(requirement.id, 'matching')

      expect(isCommodityRequirementEditable('matching')).toBe(false)
      expect(isCommodityRequirementDeletable('matching')).toBe(false)
      expect(updateCommodityRequirement(requirement.id, { title: 'Tidak boleh' })).toBeUndefined()
      expect(deleteCommodityRequirement(requirement.id)).toBe(false)
    })
  })

  describe('Category-specific detail tersimpan dan terbaca utuh', () => {
    it('detail flight tersimpan sesuai kategori', () => {
      const requirement = createCommodityRequirement({
        projectId: 'PRJ-101',
        clientPartyId: 'PTY-001',
        category: 'flight',
        title: 'Flight Requirement',
        quantity: 2,
        detail: { category: 'flight', origin: 'Jakarta', destination: 'Bali', departureDate: '2026-10-01' }
      })
      const found = getCommodityRequirementById(requirement.id)
      expect(found?.detail).toEqual({ category: 'flight', origin: 'Jakarta', destination: 'Bali', departureDate: '2026-10-01' })
    })
  })
})
