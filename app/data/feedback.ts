import { reactive } from 'vue'
import type { Feedback } from '~/types/feedback'

/**
 * Feedback (Client Experience — Repair Phase Section 1, Foundation).
 *
 * Seed ditambahkan pada Revisi 9-Modul untuk menopang "Review & Feedback Management" (`/crm/feedback`) —
 * sebelumnya array ini kosong sehingga halaman review internal tidak punya apa pun untuk ditampilkan.
 * Sengaja bervariasi: satu sudah di-acknowledge, satu berskor rendah dan menunggu tindak lanjut, satu baru
 * submitted — supaya antrean kerja tim CRM langsung terlihat hidup tanpa perlu mengarang data saat demo.
 */
export const FEEDBACK_RECORDS: Feedback[] = reactive([
  {
    id: 'FBK-001',
    projectId: 'PRJ-101',
    clientPartyId: 'PTY-001',
    submittedBy: 'USR-019',
    status: 'acknowledged',
    overallExperience: 5,
    salesResponsiveness: 5,
    proposalQuality: 4,
    itineraryQuality: 5,
    hotelRating: 5,
    transportationRating: 4,
    tourLeaderRating: 5,
    operationSupportRating: 5,
    reservationHandlingRating: 4,
    communicationRating: 5,
    issueResolutionRating: 4,
    valueForMoneyRating: 4,
    recommendationScore: 9,
    comment: 'Koordinasi tim lapangan sangat rapi. Tour leader responsif dan itinerary berjalan sesuai rencana.',
    improvementSuggestion: 'Pilihan kendaraan antar-jemput bandara bisa diperbanyak.',
    testimonialConsent: true,
    createdAt: '2026-07-10',
    submittedAt: '2026-07-12',
    acknowledgedAt: '2026-07-14',
    acknowledgedBy: 'USR-014'
  },
  {
    id: 'FBK-002',
    projectId: 'PRJ-102',
    clientPartyId: 'PTY-002',
    submittedBy: 'USR-020',
    status: 'follow-up-required',
    overallExperience: 2,
    salesResponsiveness: 3,
    proposalQuality: 2,
    itineraryQuality: 2,
    hotelRating: 3,
    transportationRating: 2,
    tourLeaderRating: 3,
    operationSupportRating: 2,
    reservationHandlingRating: 2,
    communicationRating: 2,
    issueResolutionRating: 2,
    valueForMoneyRating: 3,
    recommendationScore: 4,
    comment: 'Perubahan venue mendadak tidak dikomunikasikan lebih awal sehingga jadwal internal kami terganggu.',
    improvementSuggestion: 'Perlu pemberitahuan minimal H-7 untuk setiap perubahan venue atau jadwal.',
    testimonialConsent: false,
    createdAt: '2026-07-18',
    submittedAt: '2026-07-20'
  },
  {
    id: 'FBK-003',
    projectId: 'PRJ-103',
    clientPartyId: 'PTY-005',
    submittedBy: 'USR-021',
    status: 'submitted',
    overallExperience: 4,
    salesResponsiveness: 4,
    proposalQuality: 4,
    itineraryQuality: 4,
    hotelRating: 4,
    transportationRating: 3,
    tourLeaderRating: 4,
    operationSupportRating: 4,
    reservationHandlingRating: 4,
    communicationRating: 4,
    issueResolutionRating: 3,
    valueForMoneyRating: 4,
    recommendationScore: 8,
    comment: 'Secara keseluruhan memuaskan. Rundown acara tertata dan panitia terbantu.',
    improvementSuggestion: 'Shuttle antar sesi sempat menunggu cukup lama.',
    testimonialConsent: true,
    createdAt: '2026-07-24',
    submittedAt: '2026-07-26'
  }
])
