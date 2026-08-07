import { reactive } from 'vue'
import type { User } from '~/types/user'

/**
 * Master user demo — TEPAT satu akun per role (Penyederhanaan 7-Role, menggantikan seed 25-akun/13-role
 * lama). Role switcher sekarang pendek dan tidak membingungkan saat demo.
 *
 * Re-role (13 → 7, `LEGACY_ROLE_ALIAS` di `app/data/rbac.ts`): `crm`/`marketing` → `sales`; `bi`/`hr` →
 * `management`; `vendor-partner`/`inventory` → `operations`. Akun-akun lama yang dihapus (USR-004–007,
 * 009, 011, 013, 014, 016–020, 022–026) di-remap ke salah satu dari 7 akun di bawah — SELURUH referensi
 * `ownerId`/`assignedTo`/`recordedBy`/`actorId`/`submittedBy`/`approvedBy`/dst. di fixture lain (~400
 * referensi lintas `app/data/**`/`app/pages/**`) disapu mengikuti peta yang sama, bukan dibiarkan dangling:
 *
 *   USR-004,005,006,007,009,013,018,024 → USR-002 (operations)
 *   USR-014,017,022,025                → USR-001 (sales)
 *   USR-011,023,026                    → USR-003 (management)
 *   USR-016                            → USR-015 (vendor)
 *   USR-019,020                        → USR-021 (client)
 *
 * NAMA dan EMAIL 7 user yang bertahan sengaja tidak diubah dari seed asalnya.
 *
 * Kedua seed `suspended` lama (USR-011, USR-016) ikut terhapus bersama user-nya — tab Access Review
 * (`/admin/users`) sekarang kosong di kondisi seed; suspend/reactivate tetap bisa didemokan LIVE dengan
 * men-suspend salah satu dari 7 akun ini. `ensureClientLoginAccount` (`app/data/index.ts`) tetap bisa
 * menambah akun `client` baru saat Opportunity di-Won — "1 akun per role" berlaku untuk SEED, bukan
 * larangan terhadap penambahan akun saat runtime.
 */
export const USERS: User[] = reactive([
  { id: 'USR-001', name: 'Rani Kusuma', email: 'rani.kusuma@manova.id', role: 'sales', status: 'active' },
  { id: 'USR-002', name: 'Doni Saputra', email: 'doni.saputra@manova.id', role: 'operations', status: 'active' },
  { id: 'USR-003', name: 'Sari Wijaya', email: 'sari.wijaya@manova.id', role: 'management', status: 'active' },
  { id: 'USR-008', name: 'Budi Santoso', email: 'budi.santoso@manova.id', role: 'finance', status: 'active' },
  { id: 'USR-010', name: 'Admin MANOVA', email: 'admin@manova.id', role: 'super-admin', status: 'active' },
  { id: 'USR-015', name: 'Hasan Alfarizi', email: 'hasan.alfarizi@pt-abc.example', role: 'vendor', status: 'active', vendorId: 'VND-006' },
  /** USR-021 (Client Experience — Repair Phase Section 1) — login demo untuk 5 skenario `docs/client-mock-data-scenarios.md` (PTY-005). */
  { id: 'USR-021', name: 'Dimas Pratama', email: 'dimas.pratama@java-bhakti.example', role: 'client', status: 'active', clientPartyId: 'PTY-005' }
])
