import { reactive } from 'vue'
import type { TravelRequest, TravelRequestAttachment, TravelRequestActivity } from '~/types/travel-request'

/**
 * Travel Request (Repair Phase Section 3 — Request & Commercial, menggantikan Foundation Section 1 yang
 * sengaja kosong). `TR-001` merepresentasikan skenario demo "Bali MICE Event"
 * (`docs/client-mock-data-scenarios.md` Skenario D) SEBAGAI entitas `TravelRequest` sungguhan — dulu hanya
 * `Lead` LED-012 (`app/data/leads.ts`), kini ditautkan lewat `leadId: 'LED-012'` (TIDAK menggantikan Lead
 * itu, hanya menaut). Status `need-clarification` konsisten dengan narasi "kebutuhan venue/event masih
 * perlu klarifikasi" — `estimatedParticipants`/`estimatedBudgetIdr`/detail MICE sengaja belum lengkap,
 * persis alasan mock review (`getTravelRequestReviewGate`, `app/data/index.ts`) memintanya diklarifikasi.
 */
export const TRAVEL_REQUESTS: TravelRequest[] = reactive([
  {
    id: 'TR-001',
    clientPartyId: 'PTY-005',
    requestName: 'Bali MICE Event 2026',
    destination: 'Bali, Indonesia',
    dateFlexible: true,
    serviceScope: ['mice'],
    miceRequirement: { eventType: 'Conference', notes: 'Venue dan susunan acara masih perlu didiskusikan lebih lanjut.' },
    status: 'need-clarification',
    createdAt: '2026-07-27',
    updatedAt: '2026-07-28',
    leadId: 'LED-012'
  }
])

export const TRAVEL_REQUEST_ATTACHMENTS: TravelRequestAttachment[] = reactive([])

/** Activity timeline `TR-001` — pola sama `LEAD_ACTIVITIES`, `USR-021` (client) untuk aksi Client, `USR-001` (Account Owner PTY-005, `app/data/parties.ts`) untuk hasil mock review. */
export const TRAVEL_REQUEST_ACTIVITIES: TravelRequestActivity[] = reactive([
  { id: 'TRACT-001', travelRequestId: 'TR-001', type: 'note', message: 'Travel Request diajukan oleh Client.', ownerId: 'USR-021', createdAt: '2026-07-27' },
  { id: 'TRACT-002', travelRequestId: 'TR-001', type: 'note', message: 'Status berubah menjadi Under Review — tim kami mulai meninjau permintaan Anda.', ownerId: 'USR-001', createdAt: '2026-07-27' },
  { id: 'TRACT-003', travelRequestId: 'TR-001', type: 'note', message: 'Butuh klarifikasi: Estimasi jumlah peserta, Estimasi budget, Detail kebutuhan MICE belum lengkap.', ownerId: 'USR-001', createdAt: '2026-07-28' }
])
