import { describe, it, expect } from 'vitest'
import { allocateServiceBudgetOnServer } from './bookings-sync'
import { getServiceTypeSpendBreakdown } from './finance-ext'
import { registerNewServerProject } from './projects-sync'
import { serverProjectDto } from './projects-sync.test-utils'
import { getProjectServices } from './index'
import type { Project } from '~/types/project'
import type { ProjectServiceDto, ServiceCreateInput, ServicePatchInput } from '~/types/api'

/** Fake core API that answers like the S4a service endpoints (one counter for new service ids). */
function fakeServiceApi () {
  let seq = 9500
  const rows = new Map<string, ProjectServiceDto>()
  return {
    core: {
      createProjectService: (projectId: string, input: ServiceCreateInput) => {
        const row: ProjectServiceDto = { id: `SVC-${++seq}`, projectId, type: input.type, label: input.label, status: 'not-started', vendorId: null, bookingReference: null, budgetMinor: input.budgetMinor ?? null, hasBookings: false, provenance: 'manual' }
        rows.set(row.id, row)
        return Promise.resolve({ data: row })
      },
      updateProjectService: (id: string, input: ServicePatchInput) => {
        const row = { ...rows.get(id)!, ...input }
        rows.set(id, row)
        return Promise.resolve({ data: row })
      }
    }
  } as never
}

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
 * alokasikan budget ke tipe layanan yang BELUM pernah dibooking — sejak S4a lewat server
 * (`allocateServiceBudgetOnServer`); reuse placeholder saat booking masuk diuji di backend.
 */
describe('Alokasi budget layanan sebelum ada booking', () => {
  it('alokasi budget membuat baris layanan yang langsung terbaca di rincian budget', async () => {
    const api = fakeServiceApi()
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
    const hotelPlaceholder = await allocateServiceBudgetOnServer(api, project.id, 'hotel', 'Hotel', 100_000_000)
    expect(hotelPlaceholder.status).toBe('not-started')
    expect(getProjectServices(project.id)).toHaveLength(1)

    const breakdown = getServiceTypeSpendBreakdown(project.id)
    const hotelRow = breakdown.find(row => row.type === 'hotel')
    expect(hotelRow?.budgetIdr).toBe(100_000_000)
    expect(hotelRow?.actualIdr).toBe(0)

    // Alokasi lagi untuk tipe yang sama mengubah baris yang sama, tidak bikin baris duplikat.
    const again = await allocateServiceBudgetOnServer(api, project.id, 'hotel', 'Hotel', 120_000_000)
    expect(again.id).toBe(hotelPlaceholder.id)
    expect(again.budgetIdr).toBe(120_000_000)
    expect(getProjectServices(project.id)).toHaveLength(1)
  })
})
