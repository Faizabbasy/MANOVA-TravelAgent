import { describe, it, expect } from 'vitest'
import {
  createProject, ensureProjectServiceForBudget, updateProjectServiceBudget,
  getProjectServices, createHotelBooking
} from './index'
import { getServiceTypeSpendBreakdown } from './finance-ext'

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

  it('booking sungguhan setelah budget dialokasikan menempel ke baris yang sama, bukan bikin baris baru', () => {
    const project = createProject({
      partyId: 'PTY-001',
      name: 'Test Trip Budget Lalu Booking',
      destination: 'Lombok, Indonesia',
      travelStartDate: '2027-02-10',
      travelEndDate: '2027-02-13',
      travelerCount: 8,
      serviceScope: ['hotel'],
      quotationAmountIdr: 200_000_000
    })
    if (!project) { throw new Error('project harus berhasil dibuat') }

    const placeholder = ensureProjectServiceForBudget(project.id, 'hotel', 'Hotel')
    updateProjectServiceBudget(placeholder.id, 80_000_000)

    // Client baru booking hotel sungguhan belakangan, tanpa memilih serviceId manapun (alur normal form booking).
    createHotelBooking({ projectId: project.id })

    const services = getProjectServices(project.id)
    expect(services).toHaveLength(1) // bukan 2 — placeholder di-reuse, bukan dibuat baris baru
    expect(services[0]!.id).toBe(placeholder.id)
    expect(services[0]!.status).toBe('pending-confirmation')
    expect(services[0]!.budgetIdr).toBe(80_000_000) // budget yang sudah diisi tetap menempel
  })
})
