import { describe, it, expect } from 'vitest'
import { PROJECT_MILESTONES } from './project-orders'
import { HISTORY_MILESTONES, HISTORY_PARTIES, HISTORY_PROJECTS, HISTORY_SERVICES } from './projects-history'
import { PARTIES, PROJECTS, PROJECT_SERVICES, VENDORS } from './index'

describe('Riwayat 1 tahun (projects-history)', () => {
  it('40 project baru ditambahkan setelah data demo lama, ID tetap unik', () => {
    expect(HISTORY_PROJECTS).toHaveLength(40)
    expect(PROJECTS[0]!.id).toBe('PRJ-101')
    expect(PROJECTS.slice(-40).map(p => p.id)).toEqual(HISTORY_PROJECTS.map(p => p.id))
    for (const list of [PROJECTS, PARTIES, PROJECT_SERVICES, PROJECT_MILESTONES]) {
      const ids = list.map(x => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('setiap project punya customer, vendor, layanan, dan milestone yang ada', () => {
    const partyIds = new Set(PARTIES.map(p => p.id))
    const vendorIds = new Set(VENDORS.map(v => v.id))
    for (const project of HISTORY_PROJECTS) {
      expect(partyIds.has(project.partyId), project.id).toBe(true)
      expect(HISTORY_SERVICES.filter(s => s.projectId === project.id).length, project.id).toBeGreaterThanOrEqual(2)
      expect(HISTORY_MILESTONES.filter(m => m.projectId === project.id), project.id).toHaveLength(4)
      expect(project.travelStartDate <= project.travelEndDate, project.id).toBe(true)
    }
    for (const service of HISTORY_SERVICES) { expect(vendorIds.has(service.vendorId!), service.id).toBe(true) }
    expect(HISTORY_PARTIES.every(p => p.lifecycleStatus === 'client')).toBe(true)
  })

  it('tidak memakai data yang dikunci test cakupan backend', () => {
    expect(HISTORY_PROJECTS.some(p => p.partyId === 'PTY-001' || p.partyId === 'PTY-005')).toBe(false)
    expect(HISTORY_PROJECTS.some(p => p.status === 'confirmed')).toBe(false)
    expect(HISTORY_SERVICES.some(s => s.vendorId === 'VND-006')).toBe(false)
  })

  it('keberangkatan tersebar Nov 2025 – Okt 2026 dengan musim ramai', () => {
    const perMonth: Record<string, number> = {}
    for (const p of HISTORY_PROJECTS) { perMonth[p.travelStartDate.slice(0, 7)] = (perMonth[p.travelStartDate.slice(0, 7)] ?? 0) + 1 }
    expect(perMonth).toEqual({
      '2025-11': 3,
      '2025-12': 6,
      '2026-01': 2,
      '2026-02': 5,
      '2026-03': 5,
      '2026-04': 2,
      '2026-05': 3,
      '2026-06': 5,
      '2026-07': 5,
      '2026-08': 2,
      '2026-09': 1,
      '2026-10': 1
    })
  })
})
