import { describe, it, expect } from 'vitest'
import {
  ensureProjectServiceForBudget, updateProjectServiceBudget,
  getProjectServices
} from './index'
import { getServiceTypeSpendBreakdown } from './finance-ext'
import { registerNewServerProject } from './projects-sync'
import { serverProjectDto } from './projects-sync.test-utils'
import type { Project } from '~/types/project'

/** Project baru seperti hasil `POST /projects` (S3a): dibuat lewat jalur server-merge yang sama dengan UI. */
let testProjectSeq = 800
function createProject (input: { partyId?: string; isGroupTrip?: boolean; name: string; destination: string; travelStartDate: string; travelEndDate: string; travelerCount: number; serviceScope: Project['serviceScope']; quotationAmountIdr: number }) {
  return registerNewServerProject(serverProjectDto({
    id: `PRJ-${++testProjectSeq}`,
    partyId: input.isGroupTrip ? 'PTY-009' : input.partyId!,
    isGroupTrip: !!input.isGroupTrip,
    name: input.name,
    destination: input.destination,
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    travelerCount: input.travelerCount,
    serviceScope: input.serviceScope,
    contractValueMinor: String(input.quotationAmountIdr)
  }))
}

/**
 * Regresi: "Edit Budget" (tab Finance, Project Order) sebelum perbaikan ini tidak bisa dipakai untuk project
 * baru — belum ada baris `ProjectService` sama sekali sebelum booking pertama, jadi form edit budget kosong
 * tanpa input. Skenario di sini mereplikasi alur nyata: buat project baru lewat "Buat Project" (`createProject`),
 * alokasikan budget ke tipe layanan yang BELUM pernah dibooking (`ensureProjectServiceForBudget`, dipanggil
 * `openEditServiceBudget` di UI), lalu simulasikan booking sungguhan masuk belakangan.
 */
describe('Alokasi budget layanan sebelum ada booking', () => {
  it('ensureProjectServiceForBudget membuat placeholder yang bisa langsung diisi budgetIdr', () => {
    const project = createProject({
      partyId: 'PTY-001',
      name: 'Test Trip Budget Awal',
      destination: 'Bali, Indonesia',
      travelStartDate: '2027-01-10',
      travelEndDate: '2027-01-13',
      travelerCount: 10,
      serviceScope: ['flight', 'hotel', 'transportation'],
      quotationAmountIdr: 500_000_000
    })
    expect(project).toBeDefined()
    if (!project) { throw new Error('project harus berhasil dibuat') }

    // Belum ada booking apa pun — tepat setelah project dibuat.
    expect(getProjectServices(project.id)).toHaveLength(0)

    // Klik "Edit Budget" pada baris Hotel (belum ada baris sama sekali untuk tipe ini).
    const hotelPlaceholder = ensureProjectServiceForBudget(project.id, 'hotel', 'Hotel')
    expect(hotelPlaceholder.status).toBe('not-started')
    expect(getProjectServices(project.id)).toHaveLength(1)

    // Isi nominal dan simpan, seperti submitServiceBudget().
    updateProjectServiceBudget(hotelPlaceholder.id, 100_000_000)

    const breakdown = getServiceTypeSpendBreakdown(project.id)
    const hotelRow = breakdown.find(row => row.type === 'hotel')
    expect(hotelRow?.budgetIdr).toBe(100_000_000)
    expect(hotelRow?.actualIdr).toBe(0)

    // Buka Edit Budget lagi untuk tipe yang sama — idempotent, tidak bikin baris duplikat.
    const again = ensureProjectServiceForBudget(project.id, 'hotel', 'Hotel')
    expect(again.id).toBe(hotelPlaceholder.id)
    expect(getProjectServices(project.id)).toHaveLength(1)
  })
})
