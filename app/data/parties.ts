import type { Party, ContactPerson } from '~/types/party'

/** docs/mockup-data-scenarios.md bagian 1-4. */
export const PARTIES: Party[] = [
  { id: 'PTY-001', name: 'PT Cipta Distribusi Nusantara', lifecycleStatus: 'client', createdAt: '2026-05-20' },
  { id: 'PTY-002', name: 'PT Alam Raya Group', lifecycleStatus: 'client', createdAt: '2026-05-10' },
  { id: 'PTY-003', name: 'PT Sinergi Korporindo', lifecycleStatus: 'client', createdAt: '2026-04-25' },
  { id: 'PTY-004', name: 'PT Melati Wisata Kreasi', lifecycleStatus: 'prospect', createdAt: '2026-06-10' },
]

export const CONTACTS: ContactPerson[] = [
  { id: 'CP-001', partyId: 'PTY-001', name: 'Hendra Wijaya', title: 'Operations Manager' },
  { id: 'CP-002', partyId: 'PTY-002', name: 'Sarah Amelia', title: 'HR Manager' },
  { id: 'CP-003', partyId: 'PTY-003', name: 'Michael Tanuwijaya', title: 'Event Coordinator' },
  { id: 'CP-004', partyId: 'PTY-004', name: 'Nadia Ramadhani', title: 'Procurement Officer' },
]
