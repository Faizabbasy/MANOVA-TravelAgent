import { reactive } from 'vue'
import type { Lead, LeadActivity } from '~/types/lead'

/**
 * Lead fixture (Prompt 19 — Change Request), `reactive()` mengikuti pola Section 07 dst. — "Qualify &
 * Create Opportunity" dan "Archive" adalah mutasi runtime yang harus terlihat seketika di Table/Kanban/
 * Inbox tanpa reload. LED-005/LED-009 sengaja ditautkan retroaktif ke OPP-005/OPP-001 (data existing sejak
 * Section 08/06) untuk mendemonstrasikan traceability penuh Lead→Opportunity tanpa memfabrikasi Opportunity
 * baru yang tidak perlu — sesuai hard rule "gunakan fixture yang sama, bukan dataset terpisah".
 */
export const LEADS: Lead[] = reactive([
  {
    id: 'LED-001',
    name: 'CV Nirmala Eventama',
    companyName: 'CV Nirmala Eventama',
    source: 'website',
    stage: 'qualified',
    ownerId: 'USR-001',
    handedOverTo: 'USR-014',
    phone: '0815-7000-0001',
    email: 'contact@nirmala-eventama.example',
    qualificationNotes: 'Kebutuhan MICE tahunan ~150 peserta, budget terkonfirmasi, decision maker sudah dihubungi.',
    expectedCloseDate: '2026-09-15',
    createdAt: '2026-07-10',
    lastUpdatedAt: '2026-07-22',
    archived: false,
    // Qualification (Prompt 20) — sengaja LENGKAP (seluruh field wajib terisi): mendemokan Lead yang siap
    // "Qualify & Create Opportunity" dengan form Qualification penuh, gate terpenuhi, tombol aktif.
    serviceCategory: 'mice-event',
    destination: 'Yogyakarta, Indonesia',
    travelStartDate: '2026-09-20',
    travelEndDate: '2026-09-22',
    travelerEstimate: 150,
    serviceScope: ['mice', 'hotel', 'transportation'],
    requirementSummary: 'Corporate gathering tahunan, venue MICE + akomodasi untuk 150 peserta, butuh dukungan transportasi lokal.',
    budgetRange: 'Rp 800 juta - Rp 1 miliar',
    dateFlexible: false,
    decisionMaker: 'Direktur Operasional CV Nirmala Eventama',
    urgency: 'high',
    specialRequestNote: 'Butuh ruang meeting kapasitas besar dengan sistem AV lengkap.'
  },
  {
    id: 'LED-002',
    name: 'Rangga Wibowo',
    companyName: 'Toko Retail Wibowo',
    source: 'instagram',
    stage: 'new',
    ownerId: 'USR-001',
    phone: '0815-7000-0002',
    email: 'rangga.wibowo@example.com',
    createdAt: '2026-07-24',
    lastUpdatedAt: '2026-07-24',
    archived: false
  },
  {
    id: 'LED-003',
    name: 'Siska Amelinda',
    companyName: 'Siska Amelinda Consulting',
    source: 'tiktok',
    stage: 'new',
    ownerId: 'USR-001',
    phone: '0815-7000-0003',
    email: 'siska.amelinda@example.com',
    createdAt: '2026-07-25',
    lastUpdatedAt: '2026-07-25',
    archived: false
  },
  {
    id: 'LED-004',
    name: 'Doni Ferdian',
    companyName: 'PT Ferdian Karya Logistik',
    source: 'whatsapp',
    stage: 'contacted',
    ownerId: 'USR-001',
    phone: '0815-7000-0004',
    email: 'doni.ferdian@example.com',
    qualificationNotes: 'Menanyakan paket business trip ke Singapura untuk 10 pax, masih tahap awal.',
    createdAt: '2026-07-18',
    lastUpdatedAt: '2026-07-26',
    archived: false,
    // Qualification (Prompt 20) — sengaja SEBAGIAN: mendemokan draft form Qualification dengan warning
    // missing-field aktif (periode perjalanan, service scope, ringkasan kebutuhan, AE belum diisi).
    serviceCategory: 'corporate-travel',
    destination: 'Singapura',
    travelerEstimate: 10
  },
  {
    id: 'LED-005',
    name: 'Nadia Ramadhani',
    companyName: 'PT Melati Wisata Kreasi',
    source: 'referral',
    stage: 'qualified',
    ownerId: 'USR-001',
    handedOverTo: 'USR-014',
    phone: '0815-7000-0005',
    email: 'nadia.ramadhani@example.com',
    qualificationNotes: 'Referral dari client existing PTY-001, langsung diarahkan ke AE untuk Bali Team Building.',
    expectedCloseDate: '2026-08-03',
    createdAt: '2026-07-04',
    lastUpdatedAt: '2026-07-18',
    archived: false,
    partyId: 'PTY-004',
    opportunityId: 'OPP-005'
  },
  {
    id: 'LED-006',
    name: 'Wahyu Setiadi',
    companyName: 'CV Setiadi Jaya',
    source: 'event',
    stage: 'unqualified',
    ownerId: 'USR-001',
    qualificationNotes: 'Hanya menanyakan brosur saat pameran, tidak ada budget/timeline konkret.',
    createdAt: '2026-07-12',
    lastUpdatedAt: '2026-07-14',
    archived: false
  },
  {
    id: 'LED-007',
    name: 'Yuni Kartika',
    companyName: 'Yuni Kartika Personal',
    source: 'email',
    stage: 'new',
    ownerId: 'USR-001',
    email: 'yuni.kartika@example.com',
    createdAt: '2026-07-27',
    lastUpdatedAt: '2026-07-27',
    archived: false
  },
  {
    id: 'LED-008',
    name: 'Made Surya',
    companyName: 'PT Surya Perkasa',
    source: 'sales-outreach',
    stage: 'contacted',
    ownerId: 'USR-001',
    phone: '0815-7000-0008',
    qualificationNotes: 'Hasil cold outreach Sales, sudah dijadwalkan panggilan lanjutan.',
    createdAt: '2026-07-20',
    lastUpdatedAt: '2026-07-25',
    archived: false
  },
  {
    id: 'LED-009',
    name: 'Hendra Wijaya',
    companyName: 'PT Cipta Distribusi Nusantara',
    source: 'website',
    stage: 'qualified',
    ownerId: 'USR-001',
    handedOverTo: 'USR-014',
    createdAt: '2026-06-05',
    lastUpdatedAt: '2026-06-10',
    archived: false,
    partyId: 'PTY-001',
    opportunityId: 'OPP-001'
  },
  {
    id: 'LED-010',
    name: 'Toni Gunawan',
    companyName: 'UD Gunawan Sejahtera',
    source: 'other',
    stage: 'unqualified',
    ownerId: 'USR-001',
    qualificationNotes: 'Tidak responsif setelah 3x follow-up, diarsipkan.',
    createdAt: '2026-06-15',
    lastUpdatedAt: '2026-06-30',
    archived: true
  },
  /**
   * LED-011 (Section 04) — sengaja memakai email yang sama persis dengan LED-007 ("Yuni Kartika"),
   * mendemokan "duplicate suggestion"/"merge suggestion" (badge "Possible Duplicate" di Table view,
   * panel "Lead Serupa Terdeteksi" + aksi "Tandai sebagai Duplikat" di drawer Overview) tanpa mengubah
   * satu pun field LED-007 existing.
   */
  {
    id: 'LED-011',
    name: 'Yuni K. Kartika',
    companyName: 'Yuni Kartika Personal',
    source: 'referral',
    stage: 'new',
    ownerId: 'USR-001',
    email: 'yuni.kartika@example.com',
    qualificationNotes: 'Referral dari teman, kemungkinan sama dengan inbound email sebelumnya (LED-007).',
    createdAt: '2026-07-28',
    lastUpdatedAt: '2026-07-28',
    archived: false
  },
  /**
   * LED-012 (Client Experience — Repair Phase Section 1) — skenario demo "Bali MICE Event"
   * (`docs/client-mock-data-scenarios.md`): belum ada Quotation sama sekali, kebutuhan venue/event masih
   * belum lengkap. `TravelRequest` (`app/types/travel-request.ts`) belum punya mutator/halaman sendiri
   * (section "Request & Commercial") — untuk sementara skenario ini direpresentasikan lewat `Lead` existing.
   */
  {
    id: 'LED-012',
    name: 'Dimas Pratama',
    companyName: 'PT Java Bhakti Persada',
    source: 'client-portal',
    stage: 'contacted',
    ownerId: 'USR-001',
    email: 'dimas.pratama@java-bhakti.example',
    destination: 'Bali, Indonesia',
    serviceCategory: 'mice-event',
    qualificationNotes: 'Kebutuhan venue dan susunan acara MICE masih perlu klarifikasi lebih lanjut dari client sebelum quotation dapat disiapkan.',
    createdAt: '2026-07-27',
    lastUpdatedAt: '2026-07-29',
    archived: false
  }
])

/** Activities dan Follow-ups (Prompt 19) — satu entitas, follow-up = activity dengan `dueAt` terisi (pola `PartyActivity`, Section 07). */
export const LEAD_ACTIVITIES: LeadActivity[] = reactive([
  { id: 'LACT-001', leadId: 'LED-001', type: 'call', message: 'Kontak awal, menjelaskan kebutuhan MICE tahunan ~150 peserta', ownerId: 'USR-001', createdAt: '2026-07-11' },
  { id: 'LACT-002', leadId: 'LED-001', type: 'meeting', message: 'Meeting discovery dengan CV Nirmala Eventama', ownerId: 'USR-001', createdAt: '2026-07-18' },
  { id: 'LACT-003', leadId: 'LED-001', type: 'follow-up', message: 'Follow-up keputusan qualifikasi dari Account Executive', ownerId: 'USR-014', createdAt: '2026-07-22', dueAt: '2026-08-05' },
  { id: 'LACT-004', leadId: 'LED-004', type: 'call', message: 'Follow-up awal atas inbound WhatsApp', ownerId: 'USR-001', createdAt: '2026-07-18' },
  { id: 'LACT-005', leadId: 'LED-004', type: 'follow-up', message: 'Follow-up detail kebutuhan business trip Singapura', ownerId: 'USR-001', createdAt: '2026-07-26', dueAt: '2026-08-08' },
  { id: 'LACT-006', leadId: 'LED-008', type: 'call', message: 'Cold call awal hasil sales outreach', ownerId: 'USR-001', createdAt: '2026-07-20' },
  { id: 'LACT-007', leadId: 'LED-005', type: 'note', message: 'Lead diserahkan ke Account Executive untuk pembuatan Opportunity Bali Team Building', ownerId: 'USR-001', createdAt: '2026-07-18' }
])
