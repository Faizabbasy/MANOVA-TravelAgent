import { reactive } from 'vue'
import type { User } from '~/types/user'

/**
 * Master user demo — minimal satu per role (docs/mockup-data-scenarios.md bagian 0.1).
 *
 * Re-role (Revisi 9-Modul) — role dipangkas 16 → 13, sehingga sebagian user berpindah mengikuti
 * `LEGACY_ROLE_ALIAS` (`app/data/rbac.ts`): `project-manager`/`ticketing`/`accommodation`/`transportation`/
 * `mice` → `operations`; `account-executive`/`product-planner` → `sales`; `procurement` → `vendor-partner`;
 * `viewer` → `management`; `supplier` → `vendor`. USR-022–025 ditambahkan sebagai perwakilan empat role
 * baru (`crm`, `hr`, `inventory`, `marketing`, `bi`) supaya role switcher demo tidak kosong.
 *
 * NAMA dan EMAIL user existing sengaja tidak diubah — hanya field `role` yang bergeser, agar seluruh
 * referensi `ownerId`/`assignedTo`/`recordedBy` di fixture lain tetap valid.
 *
 * Dua seed `suspended` dipertahankan agar UI Access Review (`/admin/users`) tidak kosong: `USR-011`
 * (cuti panjang) dan `USR-016` (vendor tidak aktif) — keduanya di luar alur demo aktif.
 */
export const USERS: User[] = reactive([
  { id: 'USR-001', name: 'Rani Kusuma', email: 'rani.kusuma@manova.id', role: 'sales', status: 'active' },
  { id: 'USR-002', name: 'Doni Saputra', email: 'doni.saputra@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-013', name: 'Fitri Handayani', email: 'fitri.handayani@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-003', name: 'Sari Wijaya', email: 'sari.wijaya@manova.id', role: 'management', status: 'active' },
  { id: 'USR-004', name: 'Andi Pratama', email: 'andi.pratama@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-005', name: 'Maya Putri', email: 'maya.putri@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-006', name: 'Rudi Hartono', email: 'rudi.hartono@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-007', name: 'Lina Marlina', email: 'lina.marlina@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-008', name: 'Budi Santoso', email: 'budi.santoso@manova.id', role: 'finance', status: 'active' },
  { id: 'USR-009', name: 'Fajar Nugroho', email: 'fajar.nugroho@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-010', name: 'Admin MANOVA', email: 'admin@manova.id', role: 'super-admin', status: 'active' },
  { id: 'USR-011', name: 'Dewi Anggraini', email: 'dewi.anggraini@manova.id', role: 'management', status: 'suspended', suspendedReason: 'Sedang cuti panjang, akses dinonaktifkan sementara.', suspendedAt: '2026-07-20' },
  { id: 'USR-014', name: 'Galih Ramadhan', email: 'galih.ramadhan@manova.id', role: 'sales', status: 'active' },
  { id: 'USR-015', name: 'Hasan Alfarizi', email: 'hasan.alfarizi@pt-abc.example', role: 'vendor', status: 'active', vendorId: 'VND-006' },
  { id: 'USR-016', name: 'Ika Puspitasari', email: 'ika.puspitasari@pt-efg.example', role: 'vendor', status: 'suspended', suspendedReason: 'Vendor PT EFG tidak aktif, menunggu proses re-registrasi.', suspendedAt: '2026-07-25', vendorId: 'VND-007' },
  { id: 'USR-017', name: 'Teguh Santosa', email: 'teguh.santosa@manova.id', role: 'sales', status: 'active' },
  { id: 'USR-018', name: 'Wulan Kartika', email: 'wulan.kartika@manova.id', role: 'vendor-partner', status: 'active' },
  { id: 'USR-019', name: 'Hendra Wijaya', email: 'hendra.wijaya@cipta-distribusi.example', role: 'client', status: 'active', clientPartyId: 'PTY-001' },
  { id: 'USR-020', name: 'Sarah Amelia', email: 'sarah.amelia@alam-raya.example', role: 'client', status: 'active', clientPartyId: 'PTY-002' },
  /** USR-021 (Client Experience — Repair Phase Section 1) — login demo untuk 5 skenario `docs/client-mock-data-scenarios.md` (PTY-005). */
  { id: 'USR-021', name: 'Dimas Pratama', email: 'dimas.pratama@java-bhakti.example', role: 'client', status: 'active', clientPartyId: 'PTY-005' },
  /** USR-022–026 (Revisi 9-Modul) — perwakilan lima role baru hasil restrukturisasi modul. */
  { id: 'USR-022', name: 'Nadia Safitri', email: 'nadia.safitri@manova.id', role: 'crm', status: 'active' },
  { id: 'USR-023', name: 'Bayu Aditama', email: 'bayu.aditama@manova.id', role: 'hr', status: 'active' },
  { id: 'USR-024', name: 'Reza Maulana', email: 'reza.maulana@manova.id', role: 'inventory', status: 'active' },
  { id: 'USR-025', name: 'Citra Ayu Lestari', email: 'citra.lestari@manova.id', role: 'marketing', status: 'active' },
  { id: 'USR-026', name: 'Arif Nugraha', email: 'arif.nugraha@manova.id', role: 'bi', status: 'active' }
])
