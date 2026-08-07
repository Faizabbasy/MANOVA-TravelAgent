import { reactive } from 'vue'
import type { Party, ContactPerson, PartyActivity } from '~/types/party'

/**
 * `reactive()` (Section 07) — sebelum ini PARTIES/CONTACTS adalah array biasa (read-only sepanjang
 * Section 05/06). Section 07 butuh "create/edit frontend mock" nyata (Prospect baru, Contact baru,
 * Activity baru) yang langsung terlihat di seluruh halaman tanpa reload — bukan dataset paralel,
 * hanya array yang sama dibungkus reaktif agar `.push()` dari halaman ter-propagate. Method baca
 * (`.filter/.find/.map`) tetap bekerja identik untuk consumer existing (Dashboard, CRM overview, dst.).
 */

/**
 * docs/mockup-data-scenarios.md bagian 1-4. `accountOwnerId`/`size`/`city`/`phone` (Prompt 19 — Change
 * Request) ditambahkan aditif — dipakai tampilan "Company" pada modul Customer Journey. Seluruh 4 party
 * existing di-backfill `accountOwnerId: 'USR-001'` (satu-satunya Account Executive demo) — bukan
 * perubahan kepemilikan Opportunity (`Opportunity.ownerId` tetap terpisah, historis tidak diubah).
 */
export const PARTIES: Party[] = reactive([
  { id: 'PTY-001', name: 'PT Cipta Distribusi Nusantara', lifecycleStatus: 'client', createdAt: '2026-05-20', accountOwnerId: 'USR-001', size: '201-500', city: 'Jakarta', phone: '021-5550-1001' },
  { id: 'PTY-002', name: 'PT Alam Raya Group', lifecycleStatus: 'client', createdAt: '2026-05-10', accountOwnerId: 'USR-001', size: '501-1000', city: 'Surabaya', phone: '031-5550-1002' },
  { id: 'PTY-003', name: 'PT Sinergi Korporindo', lifecycleStatus: 'client', createdAt: '2026-04-25', accountOwnerId: 'USR-001', size: '1000+', city: 'Jakarta', phone: '021-5550-1003' },
  { id: 'PTY-004', name: 'PT Melati Wisata Kreasi', lifecycleStatus: 'prospect', createdAt: '2026-06-10', accountOwnerId: 'USR-001', size: '51-200', city: 'Bandung', phone: '022-5550-1004' },
  /**
   * PTY-005 (Client Experience — Repair Phase Section 1) — company demo khusus untuk 5 skenario
   * `docs/client-mock-data-scenarios.md` (Korea/Abu Dhabi/Manila/Bali/Singapore), terpisah dari PTY-001-004
   * agar tidak mencampur data yang sudah dipakai section/audit lain. Field Company Profile (Repair Phase
   * Section 7) diisi lengkap sebagai skenario "View" — `pendingProfileChange` SENGAJA diisi (billing
   * address baru) untuk mendemokan "Verification state for sensitive changes" belum terverifikasi.
   */
  {
    id: 'PTY-005',
    name: 'PT Java Bhakti Persada',
    lifecycleStatus: 'client',
    createdAt: '2026-06-01',
    accountOwnerId: 'USR-001',
    size: '501-1000',
    city: 'Jakarta',
    phone: '021-5550-1005',
    companyType: 'private-company',
    industry: 'Manufaktur & Distribusi',
    address: 'Jl. Gatot Subroto Kav. 18, Menara Bhakti Lt. 12',
    province: 'DKI Jakarta',
    country: 'Indonesia',
    postalCode: '12930',
    website: 'https://javabhaktipersada.example',
    email: 'corporate@java-bhakti.example',
    registrationNumber: 'AHU-0012345.AH.01.01.2015',
    npwp: '01.234.567.8-901.000',
    billingName: 'PT Java Bhakti Persada',
    billingAddress: 'Jl. Gatot Subroto Kav. 18, Menara Bhakti Lt. 12, Jakarta 12930',
    paymentTerm: 'Net 30',
    preferredCurrency: 'IDR',
    poRequired: true,
    travelPreferences: 'Preferensi maskapai full-service, hotel bintang 4-5, kamar non-smoking.',
    pendingProfileChange: { billingAddress: 'Jl. Jenderal Sudirman Kav. 52-53, Menara Bhakti Baru Lt. 21, Jakarta 12190' },
    pendingProfileChangeSubmittedAt: '2026-07-27',
    pendingProfileChangeSubmittedBy: 'USR-021'
  }
])

export const CONTACTS: ContactPerson[] = reactive([
  { id: 'CP-001', partyId: 'PTY-001', name: 'Hendra Wijaya', title: 'Operations Manager' },
  { id: 'CP-002', partyId: 'PTY-002', name: 'Sarah Amelia', title: 'HR Manager' },
  { id: 'CP-005', partyId: 'PTY-005', name: 'Dimas Pratama', title: 'Corporate Travel Coordinator', email: 'dimas.pratama@java-bhakti.example', phone: '0815-5000-5001' },
  { id: 'CP-003', partyId: 'PTY-003', name: 'Michael Tanuwijaya', title: 'Event Coordinator' },
  { id: 'CP-004', partyId: 'PTY-004', name: 'Nadia Ramadhani', title: 'Procurement Officer' }
])

/**
 * Activity level-Party (Section 07, bagian 4a-lanjutan) — mengisi tab "Activities" Party Detail dan
 * widget Dashboard Sales "Follow-up Mendatang" (deferred di Section 06 karena model ini belum ada).
 * `ownerId` seluruhnya USR-001 (satu-satunya user role Sales di fixture demo).
 * `opportunityId` (Section 08) ditambahkan pada baris yang memang terkait satu opportunity spesifik —
 * backfill, bukan record baru — agar tampil juga di tab "Activity/Follow-up" Opportunity Detail.
 */
export const PARTY_ACTIVITIES: PartyActivity[] = reactive([
  { id: 'PACT-001', partyId: 'PTY-001', type: 'call', message: 'Follow-up kepuasan trip Manila Business Trip', ownerId: 'USR-001', createdAt: '2026-07-01' },
  { id: 'PACT-002', partyId: 'PTY-004', opportunityId: 'OPP-005', type: 'meeting', message: 'Diskusi kebutuhan awal Bali Team Building 2026', ownerId: 'USR-001', createdAt: '2026-07-04' },
  { id: 'PACT-003', partyId: 'PTY-004', opportunityId: 'OPP-005', type: 'email', message: 'Mengirimkan draft quotation Bali Team Building 2026', ownerId: 'USR-001', createdAt: '2026-07-18' },
  { id: 'PACT-004', partyId: 'PTY-004', opportunityId: 'OPP-005', type: 'follow-up', message: 'Follow-up keputusan quotation Bali Team Building 2026', ownerId: 'USR-001', createdAt: '2026-07-20', dueAt: '2026-08-03' },
  { id: 'PACT-005', partyId: 'PTY-001', opportunityId: 'OPP-006', type: 'follow-up', message: 'Follow-up peluang repeat business Manila Q4 2026', ownerId: 'USR-001', createdAt: '2026-07-16', dueAt: '2026-08-02' },
  { id: 'PACT-006', partyId: 'PTY-002', type: 'note', message: 'Catatan internal: client sensitif terhadap perubahan tanggal setelah reschedule hotel', ownerId: 'USR-001', createdAt: '2026-07-12' }
])
