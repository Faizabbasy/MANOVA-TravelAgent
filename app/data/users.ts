import { reactive } from 'vue'
import type { User } from '~/types/user'

/**
 * Master user demo — satu per role (docs/mockup-data-scenarios.md bagian 0.1). USR-014–016 ditambahkan
 * Prompt 19 (Change Request): Account Executive, dan 2 supplier user ter-isolasi masing-masing ke satu
 * vendor company (`vendorId`, lihat VND-006/VND-007 di `app/data/vendors.ts`). USR-017–020 ditambahkan
 * Section 02 (roadmap Section 00–24 baru): Product Planner, Procurement, dan 2 Client user ter-isolasi
 * masing-masing ke satu company (`clientPartyId`, lihat PTY-001/PTY-002 di `app/data/parties.ts` — keduanya
 * sudah `lifecycleStatus: 'client'`, mendemokan isolasi "Client A tidak melihat Client B").
 *
 * `reactive()` + `status` (Section 23 — Administration, Master Data dan Audit, roadmap Section 00–24 baru,
 * D-080) — sebelumnya array statis (tidak pernah dimutasi, tidak ada `createUser`); kini reactive agar
 * `suspendUser`/`reactivateUser` (`app/data/index.ts`) dapat memutasinya. Seluruh user `status: 'active'`
 * KECUALI 2 seed demo `suspended` (satu internal, satu external) agar UI Access Review (`/admin/users`)
 * tidak kosong secara default: `USR-011` (Viewer, cuti panjang) dan `USR-016` (Supplier PT EFG, vendor
 * tidak aktif menunggu re-registrasi) — dipilih karena keduanya TIDAK berada di tengah skenario demo aktif
 * manapun (Viewer read-only, VND-007 tidak dipakai project apa pun saat ini), sehingga suspend tidak
 * merusak alur demo section lain.
 */
export const USERS: User[] = reactive([
  { id: 'USR-001', name: 'Rani Kusuma', email: 'rani.kusuma@manova.id', role: 'sales', status: 'active' },
  { id: 'USR-002', name: 'Doni Saputra', email: 'doni.saputra@manova.id', role: 'project-manager', status: 'active' },
  { id: 'USR-013', name: 'Fitri Handayani', email: 'fitri.handayani@manova.id', role: 'project-manager', status: 'active' },
  { id: 'USR-003', name: 'Sari Wijaya', email: 'sari.wijaya@manova.id', role: 'management', status: 'active' },
  { id: 'USR-004', name: 'Andi Pratama', email: 'andi.pratama@manova.id', role: 'ticketing', status: 'active' },
  { id: 'USR-005', name: 'Maya Putri', email: 'maya.putri@manova.id', role: 'accommodation', status: 'active' },
  { id: 'USR-006', name: 'Rudi Hartono', email: 'rudi.hartono@manova.id', role: 'transportation', status: 'active' },
  { id: 'USR-007', name: 'Lina Marlina', email: 'lina.marlina@manova.id', role: 'mice', status: 'active' },
  { id: 'USR-008', name: 'Budi Santoso', email: 'budi.santoso@manova.id', role: 'finance', status: 'active' },
  { id: 'USR-009', name: 'Fajar Nugroho', email: 'fajar.nugroho@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-010', name: 'Admin MANOVA', email: 'admin@manova.id', role: 'super-admin', status: 'active' },
  { id: 'USR-011', name: 'Dewi Anggraini', email: 'dewi.anggraini@manova.id', role: 'viewer', status: 'suspended', suspendedReason: 'Sedang cuti panjang, akses dinonaktifkan sementara.', suspendedAt: '2026-07-20' },
  { id: 'USR-014', name: 'Galih Ramadhan', email: 'galih.ramadhan@manova.id', role: 'account-executive', status: 'active' },
  { id: 'USR-015', name: 'Hasan Alfarizi', email: 'hasan.alfarizi@pt-abc.example', role: 'supplier', status: 'active', vendorId: 'VND-006' },
  { id: 'USR-016', name: 'Ika Puspitasari', email: 'ika.puspitasari@pt-efg.example', role: 'supplier', status: 'suspended', suspendedReason: 'Vendor PT EFG tidak aktif, menunggu proses re-registrasi.', suspendedAt: '2026-07-25', vendorId: 'VND-007' },
  { id: 'USR-017', name: 'Teguh Santosa', email: 'teguh.santosa@manova.id', role: 'product-planner', status: 'active' },
  { id: 'USR-018', name: 'Wulan Kartika', email: 'wulan.kartika@manova.id', role: 'procurement', status: 'active' },
  { id: 'USR-019', name: 'Hendra Wijaya', email: 'hendra.wijaya@cipta-distribusi.example', role: 'client', status: 'active', clientPartyId: 'PTY-001' },
  { id: 'USR-020', name: 'Sarah Amelia', email: 'sarah.amelia@alam-raya.example', role: 'client', status: 'active', clientPartyId: 'PTY-002' },
  /** USR-021 (Client Experience — Repair Phase Section 1) — login demo untuk 5 skenario `docs/client-mock-data-scenarios.md` (PTY-005). */
  { id: 'USR-021', name: 'Dimas Pratama', email: 'dimas.pratama@java-bhakti.example', role: 'client', status: 'active', clientPartyId: 'PTY-005' }
])
