import { reactive } from 'vue'
import type { Party, ContactPerson, PartyActivity } from '~/types/party'

/**
 * `reactive()` (Section 07) — sebelum ini PARTIES/CONTACTS adalah array biasa (read-only sepanjang
 * Section 05/06). Section 07 butuh "create/edit frontend mock" nyata (Prospect baru, Contact baru,
 * Activity baru) yang langsung terlihat di seluruh halaman tanpa reload — bukan dataset paralel,
 * hanya array yang sama dibungkus reaktif agar `.push()` dari halaman ter-propagate. Method baca
 * (`.filter/.find/.map`) tetap bekerja identik untuk consumer existing (Dashboard, CRM overview, dst.).
 */

/** docs/mockup-data-scenarios.md bagian 1-4. */
export const PARTIES: Party[] = reactive([
  { id: 'PTY-001', name: 'PT Cipta Distribusi Nusantara', lifecycleStatus: 'client', createdAt: '2026-05-20' },
  { id: 'PTY-002', name: 'PT Alam Raya Group', lifecycleStatus: 'client', createdAt: '2026-05-10' },
  { id: 'PTY-003', name: 'PT Sinergi Korporindo', lifecycleStatus: 'client', createdAt: '2026-04-25' },
  { id: 'PTY-004', name: 'PT Melati Wisata Kreasi', lifecycleStatus: 'prospect', createdAt: '2026-06-10' },
])

export const CONTACTS: ContactPerson[] = reactive([
  { id: 'CP-001', partyId: 'PTY-001', name: 'Hendra Wijaya', title: 'Operations Manager' },
  { id: 'CP-002', partyId: 'PTY-002', name: 'Sarah Amelia', title: 'HR Manager' },
  { id: 'CP-003', partyId: 'PTY-003', name: 'Michael Tanuwijaya', title: 'Event Coordinator' },
  { id: 'CP-004', partyId: 'PTY-004', name: 'Nadia Ramadhani', title: 'Procurement Officer' },
])

/**
 * Activity level-Party (Section 07, bagian 4a-lanjutan) — mengisi tab "Activities" Party Detail dan
 * widget Dashboard Sales "Follow-up Mendatang" (deferred di Section 06 karena model ini belum ada).
 * `ownerId` seluruhnya USR-001 (satu-satunya user role Sales di fixture demo).
 */
export const PARTY_ACTIVITIES: PartyActivity[] = reactive([
  { id: 'PACT-001', partyId: 'PTY-001', type: 'call', message: 'Follow-up kepuasan trip Manila Business Trip', ownerId: 'USR-001', createdAt: '2026-07-01' },
  { id: 'PACT-002', partyId: 'PTY-004', type: 'meeting', message: 'Diskusi kebutuhan awal Bali Team Building 2026', ownerId: 'USR-001', createdAt: '2026-07-04' },
  { id: 'PACT-003', partyId: 'PTY-004', type: 'email', message: 'Mengirimkan draft quotation Bali Team Building 2026', ownerId: 'USR-001', createdAt: '2026-07-18' },
  { id: 'PACT-004', partyId: 'PTY-004', type: 'follow-up', message: 'Follow-up keputusan quotation Bali Team Building 2026', ownerId: 'USR-001', createdAt: '2026-07-20', dueAt: '2026-08-03' },
  { id: 'PACT-005', partyId: 'PTY-001', type: 'follow-up', message: 'Follow-up peluang repeat business Manila Q4 2026', ownerId: 'USR-001', createdAt: '2026-07-16', dueAt: '2026-08-02' },
  { id: 'PACT-006', partyId: 'PTY-002', type: 'note', message: 'Catatan internal: client sensitif terhadap perubahan tanggal setelah reschedule hotel', ownerId: 'USR-001', createdAt: '2026-07-12' },
])
