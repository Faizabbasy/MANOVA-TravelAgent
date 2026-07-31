import type { User } from '~/types/user'

/**
 * Master user demo — satu per role (docs/mockup-data-scenarios.md bagian 0.1). USR-014–016 ditambahkan
 * Prompt 19 (Change Request): Account Executive, dan 2 supplier user ter-isolasi masing-masing ke satu
 * vendor company (`vendorId`, lihat VND-006/VND-007 di `app/data/vendors.ts`).
 */
export const USERS: User[] = [
  { id: 'USR-001', name: 'Rani Kusuma', email: 'rani.kusuma@manova.id', role: 'sales' },
  { id: 'USR-002', name: 'Doni Saputra', email: 'doni.saputra@manova.id', role: 'project-manager' },
  { id: 'USR-013', name: 'Fitri Handayani', email: 'fitri.handayani@manova.id', role: 'project-manager' },
  { id: 'USR-003', name: 'Sari Wijaya', email: 'sari.wijaya@manova.id', role: 'management' },
  { id: 'USR-004', name: 'Andi Pratama', email: 'andi.pratama@manova.id', role: 'ticketing' },
  { id: 'USR-005', name: 'Maya Putri', email: 'maya.putri@manova.id', role: 'accommodation' },
  { id: 'USR-006', name: 'Rudi Hartono', email: 'rudi.hartono@manova.id', role: 'transportation' },
  { id: 'USR-007', name: 'Lina Marlina', email: 'lina.marlina@manova.id', role: 'mice' },
  { id: 'USR-008', name: 'Budi Santoso', email: 'budi.santoso@manova.id', role: 'finance' },
  { id: 'USR-009', name: 'Fajar Nugroho', email: 'fajar.nugroho@manova.id', role: 'operations' },
  { id: 'USR-010', name: 'Admin MANOVA', email: 'admin@manova.id', role: 'super-admin' },
  { id: 'USR-011', name: 'Dewi Anggraini', email: 'dewi.anggraini@manova.id', role: 'viewer' },
  { id: 'USR-014', name: 'Galih Ramadhan', email: 'galih.ramadhan@manova.id', role: 'account-executive' },
  { id: 'USR-015', name: 'Hasan Alfarizi', email: 'hasan.alfarizi@pt-abc.example', role: 'supplier', vendorId: 'VND-006' },
  { id: 'USR-016', name: 'Ika Puspitasari', email: 'ika.puspitasari@pt-efg.example', role: 'supplier', vendorId: 'VND-007' },
]
