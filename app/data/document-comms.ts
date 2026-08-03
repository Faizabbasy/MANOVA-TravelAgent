import { reactive } from 'vue'
import type { Document, Message, Notification, DocumentComment } from '~/types/document-comms'

/**
 * Fixture Documents, Communication dan Notifications (Section 21, D-078). `reactive()` (pola sama seluruh
 * fixture mutable lain) — `createDocument`/`sendMessage`/`pushNotification` dkk. (`app/data/index.ts`)
 * memerlukan array reaktif. Dokumen `sourceType: 'generated'` menautkan `previewRoute` HANYA ke 9 route
 * preview yang SUDAH ADA di codebase (Section 05/09/13-16) — diverifikasi manual terhadap file route aktual,
 * bukan ditebak.
 */
export const DOCUMENT_RECORDS: Document[] = reactive([
  { id: 'DOC-C001', entityType: 'project', entityId: 'PRJ-101', projectId: 'PRJ-101', name: 'Kontrak Kerjasama PRJ-101.pdf', category: 'Contract', version: 1, uploadedAt: '2026-06-20', accessLevel: 'internal', sourceType: 'uploaded', uploadedBy: 'USR-002' },
  { id: 'DOC-C002', entityType: 'quotation', entityId: 'QUO-001', projectId: 'PRJ-101', name: 'Quotation QUO-001 (Preview)', category: 'Quotation', version: 1, generatedAt: '2026-06-25', accessLevel: 'client', sourceType: 'generated', previewRoute: '/crm/opportunities/OPP-001/quotation-preview' },
  { id: 'DOC-C003', entityType: 'flight', entityId: 'FLT-1011', projectId: 'PRJ-101', name: 'E-Ticket FLT-1011', category: 'Travel Document', version: 1, generatedAt: '2026-06-26', accessLevel: 'client', sourceType: 'generated', previewRoute: '/ticketing/FLT-1011/eticket-preview' },
  { id: 'DOC-C004', entityType: 'hotel', entityId: 'HTL-1033', projectId: 'PRJ-103', name: 'Voucher Hotel HTL-1033', category: 'Travel Document', version: 1, generatedAt: '2026-07-16', accessLevel: 'client', sourceType: 'generated', previewRoute: '/accommodation/HTL-1033/voucher-preview' },
  { id: 'DOC-C005', entityType: 'transport', entityId: 'TRN-1034', projectId: 'PRJ-103', name: 'Service Order TRN-1034', category: 'Travel Document', version: 1, generatedAt: '2026-07-18', accessLevel: 'client', sourceType: 'generated', previewRoute: '/transportation/TRN-1034/service-order-preview' },
  { id: 'DOC-C006', entityType: 'transport', entityId: 'TRN-1034', projectId: 'PRJ-103', name: 'Driver Sheet TRN-1034', category: 'Operational', version: 1, generatedAt: '2026-07-18', accessLevel: 'internal', sourceType: 'generated', previewRoute: '/transportation/TRN-1034/driver-sheet-preview' },
  { id: 'DOC-C007', entityType: 'mice', entityId: 'MICE-1035', projectId: 'PRJ-103', name: 'Rundown Acara MICE-1035', category: 'Event Document', version: 2, generatedAt: '2026-07-20', accessLevel: 'client', sourceType: 'generated', previewRoute: '/mice/MICE-1035/rundown-preview' },
  { id: 'DOC-C008', entityType: 'mice', entityId: 'MICE-1035', projectId: 'PRJ-103', name: 'BOQ MICE-1035', category: 'Budget', version: 2, generatedAt: '2026-07-20', accessLevel: 'internal', sourceType: 'generated', previewRoute: '/mice/MICE-1035/boq-preview' },
  { id: 'DOC-C009', entityType: 'project', entityId: 'PRJ-103', projectId: 'PRJ-103', name: 'Run Sheet PRJ-103', category: 'Operational', version: 1, generatedAt: '2026-07-22', accessLevel: 'internal', sourceType: 'generated', previewRoute: '/projects/PRJ-103/run-sheet-preview' },
  { id: 'DOC-C010', entityType: 'project', entityId: 'PRJ-103', projectId: 'PRJ-103', name: 'Manifest PRJ-103', category: 'Travel Document', version: 1, generatedAt: '2026-07-22', accessLevel: 'client', sourceType: 'generated', previewRoute: '/projects/PRJ-103/manifest-preview' },
  // Vendor document (Section 17 punya VendorDocument sendiri — DOC-C011 SENGAJA berbeda entitas/tujuan, mendemokan cakupan cross-domain modul ini, bukan duplikasi VendorDocument). Kedaluwarsa (EXPIRED, > DEMO_REFERENCE_DATE 2026-07-29).
  { id: 'DOC-C011', entityType: 'vendor', entityId: 'VND-006', name: 'Kontrak Vendor PT ABC.pdf', category: 'Contract', version: 1, uploadedAt: '2026-01-10', expiresAt: '2026-07-01', accessLevel: 'supplier', sourceType: 'uploaded', uploadedBy: 'USR-015' },
  // Upcoming-soon expiry (dalam 30 hari sejak DEMO_REFERENCE_DATE).
  { id: 'DOC-C012', entityType: 'party', entityId: 'PTY-001', name: 'NPWP PT Cipta Distribusi Nusantara.pdf', category: 'Legal', version: 1, uploadedAt: '2026-05-01', expiresAt: '2026-08-10', accessLevel: 'client', sourceType: 'uploaded', uploadedBy: 'USR-019', verified: true, verifiedBy: 'USR-002', verifiedAt: '2026-05-05' },
  /**
   * DOC-C017–019 (Repair Phase Section 5 — Execution & Changes) — dokumen client-visible pertama untuk
   * `PTY-005` (skenario Client Experience), lintas 3 dari 5 kategori Master Prompt bagian C ("Commercial"
   * via entityType `quotation`, "Travel" via entityType `flight`, "Closing" via entityType `project`
   * run-sheet-equivalent). Mendemokan version history (`DOC-C019` men-supersede `DOC-C018`).
   */
  { id: 'DOC-C017', entityType: 'quotation', entityId: 'QUO-201', projectId: 'PRJ-201', name: 'Quotation Korea Incentive Trip 2026.pdf', category: 'Quotation', version: 1, uploadedAt: '2026-07-15', accessLevel: 'client', sourceType: 'uploaded', uploadedBy: 'USR-002', verified: true, verifiedBy: 'USR-002', verifiedAt: '2026-07-15' },
  { id: 'DOC-C018', entityType: 'traveler', entityId: 'TRV-2021', projectId: 'PRJ-202', name: 'Manifest Peserta Abu Dhabi Business Delegation.pdf', category: 'Participant', version: 1, uploadedAt: '2026-07-12', accessLevel: 'client', sourceType: 'uploaded', uploadedBy: 'USR-002' },
  { id: 'DOC-C019', entityType: 'traveler', entityId: 'TRV-2021', projectId: 'PRJ-202', name: 'Manifest Peserta Abu Dhabi Business Delegation.pdf', category: 'Participant', version: 2, uploadedAt: '2026-07-24', accessLevel: 'client', sourceType: 'uploaded', uploadedBy: 'USR-002', supersedesId: 'DOC-C018', verified: true, verifiedBy: 'USR-002', verifiedAt: '2026-07-24' },
  { id: 'DOC-C013', entityType: 'invoice', entityId: 'INV-1011', projectId: 'PRJ-101', name: 'Bukti Transfer INV-1011.pdf', category: 'Finance', version: 1, uploadedAt: '2026-07-10', accessLevel: 'internal', sourceType: 'uploaded', uploadedBy: 'USR-008' },
  { id: 'DOC-C014', entityType: 'traveler', entityId: 'TRV-1021', projectId: 'PRJ-102', name: 'Scan Visa TRV-1021.pdf', category: 'Travel Document', version: 1, uploadedAt: '2026-07-05', expiresAt: '2027-06-30', accessLevel: 'internal', sourceType: 'uploaded', uploadedBy: 'USR-013' },
  { id: 'DOC-C015', entityType: 'change-request', entityId: 'CR-004', projectId: 'PRJ-103', name: 'Dokumentasi Perubahan Armada CR-004.pdf', category: 'Change Documentation', version: 1, uploadedAt: '2026-07-18', accessLevel: 'internal', sourceType: 'uploaded', uploadedBy: 'USR-009' },
  { id: 'DOC-C016', entityType: 'incident', entityId: 'INC-001', projectId: 'PRJ-103', name: 'Laporan Insiden INC-001.pdf', category: 'Incident Report', version: 1, uploadedAt: '2026-07-19', accessLevel: 'internal', sourceType: 'uploaded', uploadedBy: 'USR-009' }
])

/**
 * Fixture Message — 3 channel (`internal-note`/`client-message`/`supplier-message`), mix `deliveryStatus`
 * termasuk `failed`, minimal satu `mentions`. `deliveryStatus`/`deliveryChannel` label mock murni (D-006) —
 * TIDAK ADA integrasi email/WhatsApp nyata.
 */
export const MESSAGE_RECORDS: Message[] = reactive([
  { id: 'MSG-001', entityType: 'project', entityId: 'PRJ-101', projectId: 'PRJ-101', channel: 'internal-note', senderId: 'USR-002', body: 'Reminder: konfirmasi manifest final sebelum keberangkatan H-3.', mentions: ['USR-004'], sentAt: '2026-07-20', deliveryStatus: 'sent' },
  { id: 'MSG-002', entityType: 'project', entityId: 'PRJ-102', projectId: 'PRJ-102', channel: 'client-message', senderId: 'USR-013', body: 'Update: jadwal reschedule sudah dikonfirmasi ke 22–26 Sep 2026, revised itinerary terlampir.', sentAt: '2026-07-09', deliveryStatus: 'delivered', deliveryChannel: 'email' },
  { id: 'MSG-003', entityType: 'project', entityId: 'PRJ-102', projectId: 'PRJ-102', channel: 'client-message', senderId: 'USR-013', body: 'Menginformasikan upgrade kamar ke Suite, mohon konfirmasi approval tambahan biaya.', sentAt: '2026-07-12', deliveryStatus: 'failed', deliveryChannel: 'whatsapp' },
  { id: 'MSG-004', entityType: 'vendor', entityId: 'VND-006', projectId: 'PRJ-103', channel: 'supplier-message', senderId: 'USR-009', body: 'Mohon update status ketersediaan kamar Suite untuk Group C.', sentAt: '2026-07-14', deliveryStatus: 'sent', deliveryChannel: 'email' },
  { id: 'MSG-005', entityType: 'vendor', entityId: 'VND-006', projectId: 'PRJ-103', channel: 'supplier-message', senderId: 'USR-015', body: 'Kamar Suite tersedia, konfirmasi tertulis kami kirim dalam 1x24 jam.', sentAt: '2026-07-15', deliveryStatus: 'delivered', deliveryChannel: 'email' },
  { id: 'MSG-006', entityType: 'incident', entityId: 'INC-001', projectId: 'PRJ-103', channel: 'internal-note', senderId: 'USR-006', body: 'Update lapangan: unit cadangan sudah tiba, seluruh traveler kembali on schedule.', mentions: ['USR-009'], sentAt: '2026-07-19', deliveryStatus: 'sent' },
  { id: 'MSG-007', entityType: 'change-request', entityId: 'CR-002', projectId: 'PRJ-102', channel: 'client-message', senderId: 'USR-020', body: 'Konfirmasi permintaan upgrade kamar dari kami, mohon info tambahan biaya yang perlu dibayar.', sentAt: '2026-07-12', deliveryStatus: 'delivered', deliveryChannel: 'whatsapp' },
  { id: 'MSG-008', entityType: 'project', entityId: 'PRJ-104', projectId: 'PRJ-104', channel: 'internal-note', senderId: 'USR-002', body: 'Project baru PRJ-104 dibuat dari Opportunity OPP-008, mohon Ticketing mulai proses awal.', mentions: ['USR-004'], sentAt: '2026-07-24', deliveryStatus: 'queued' },
  /**
   * MSG-009–011 (Repair Phase Section 6 — Finance & Collaboration) — conversation client-facing pertama
   * untuk `PTY-005`/`USR-021` (PRJ-202, Abu Dhabi Business Delegation). `readBy` seed manual (bukan lewat
   * `sendMessage`) — MSG-010 SENGAJA belum dibaca `USR-021` untuk mendemokan "Unread state".
   */
  { id: 'MSG-009', entityType: 'project', entityId: 'PRJ-202', projectId: 'PRJ-202', channel: 'client-message', senderId: 'USR-002', body: 'Selamat datang di Abu Dhabi! Tim kami siap membantu selama delegasi berlangsung. Jangan ragu menghubungi kami di sini bila ada kebutuhan mendadak.', sentAt: '2026-07-25', deliveryStatus: 'delivered', deliveryChannel: 'email', readBy: ['USR-002', 'USR-021'] },
  { id: 'MSG-010', entityType: 'project', entityId: 'PRJ-202', projectId: 'PRJ-202', channel: 'client-message', senderId: 'USR-002', body: 'Update: driver dan armada untuk hari ke-2 sudah kami konfirmasi ulang, siap standby pukul 08:00 di lobi hotel.', sentAt: '2026-07-27', deliveryStatus: 'delivered', deliveryChannel: 'email', readBy: ['USR-002'] },
  { id: 'MSG-011', entityType: 'project', entityId: 'PRJ-202', projectId: 'PRJ-202', channel: 'client-message', senderId: 'USR-021', body: 'Terima kasih infonya, kami tunggu di lobi.', sentAt: '2026-07-27', deliveryStatus: 'delivered', deliveryChannel: 'email', readBy: ['USR-021', 'USR-002'] }
])

/**
 * Fixture Notification — lintas beberapa user, mixed read/unread, seluruh 8 `NotificationType`. Dipicu dari
 * 4 hook point kurasi (`sendMessage`/`escalateIncident`/`approveChangeRequest`+`rejectChangeRequest`/
 * `updateProjectTask`) — lihat `docs/mockup-change-impact-log.md` CI-051. Fixture ini adalah SEED historis
 * (dibuat sebelum hook berjalan), bukan hasil hook — konsisten pola seed section lain (mis. `ACTIVITIES`).
 */
export const NOTIFICATION_RECORDS: Notification[] = reactive([
  { id: 'NOT-001', userId: 'USR-004', type: 'mention', title: 'Anda disebut dalam catatan project PRJ-101', body: 'Doni Saputra menyebut Anda: "Reminder: konfirmasi manifest final sebelum keberangkatan H-3."', entityType: 'project', entityId: 'PRJ-101', createdAt: '2026-07-20', read: false },
  { id: 'NOT-002', userId: 'USR-009', type: 'escalation', title: 'Incident INC-001 dieskalasi kepada Anda', body: 'Insiden armada mogok (TRN-1034) dieskalasi ke Anda oleh Rudi Hartono.', entityType: 'incident', entityId: 'INC-001', createdAt: '2026-07-19', read: true },
  { id: 'NOT-003', userId: 'USR-003', type: 'change', title: 'Change Request CR-004 menunggu review Anda', body: 'Change Request CR-004 (upgrade armada) diajukan oleh Hasan Alfarizi, menunggu review/approval.', entityType: 'change-request', entityId: 'CR-004', createdAt: '2026-07-18', read: false },
  { id: 'NOT-004', userId: 'USR-004', type: 'assignment', title: 'Anda ditugaskan pada task baru', body: 'Task "Konfirmasi manifest penumpang" ditugaskan kepada Anda di PRJ-101.', entityType: 'project', entityId: 'PRJ-101', createdAt: '2026-06-24', read: true },
  { id: 'NOT-005', userId: 'USR-009', type: 'mention', title: 'Anda disebut dalam catatan insiden INC-001', body: 'Rudi Hartono menyebut Anda dalam catatan lapangan insiden.', entityType: 'incident', entityId: 'INC-001', createdAt: '2026-07-19', read: false },
  { id: 'NOT-006', userId: 'USR-002', type: 'reminder', title: 'Follow-up pembayaran termin tambahan', body: 'Task follow-up pembayaran termin tambahan ke client PRJ-102 jatuh tempo 2026-08-01.', entityType: 'project', entityId: 'PRJ-102', createdAt: '2026-07-25', read: false },
  { id: 'NOT-007', userId: 'USR-003', type: 'document', title: 'Dokumen NPWP PT Cipta Distribusi akan kedaluwarsa', body: 'Dokumen NPWP PTY-001 akan kedaluwarsa pada 2026-08-10.', entityType: 'party', entityId: 'PTY-001', createdAt: '2026-07-29', read: false },
  { id: 'NOT-008', userId: 'USR-004', type: 'message', title: 'Pesan baru pada project PRJ-104', body: 'Doni Saputra mengirim catatan internal baru pada PRJ-104.', entityType: 'project', entityId: 'PRJ-104', createdAt: '2026-07-24', read: false },
  { id: 'NOT-009', userId: 'USR-006', type: 'incident', title: 'Incident baru tercatat pada booking TRN-1034', body: 'Incident INC-001 (armada mogok) tercatat pada booking Anda.', entityType: 'incident', entityId: 'INC-001', createdAt: '2026-07-19', read: true },
  /**
   * NOT-010–017 (Repair Phase Section 2 — Home, Notifications) — notifikasi client-facing pertama untuk
   * `USR-021` (PTY-005, `docs/client-mock-data-scenarios.md`), seluruhnya derivasi jujur dari data yang
   * sudah ada (`app/data/projects.ts`/`finance.ts`) — TIDAK ada nominal/cost internal (`commercialImpactIdr`
   * dkk tetap disembunyikan, sesuai `app/types/change-incident.ts`). `category` diisi (9 kategori Master
   * Prompt bagian G.2); `type` tetap salah satu dari 8 `NotificationType` existing (Section 21, LOCKED)
   * agar `NotificationPanel.vue`/tab Notifications `/documents` tidak perlu berubah.
   */
  { id: 'NOT-010', userId: 'USR-021', type: 'document', category: 'participant', title: 'Dokumen traveler belum lengkap', body: 'Melisa Tanto (TRV-2012) pada Korea Incentive Trip 2026 belum melengkapi nomor paspor.', entityType: 'traveler', entityId: 'TRV-2012', createdAt: '2026-07-26', read: false },
  { id: 'NOT-011', userId: 'USR-021', type: 'document', category: 'participant', title: 'Dokumen traveler belum lengkap', body: 'Yoga Pranata (TRV-2042) pada Singapore Conference 2026 belum melengkapi nomor paspor.', entityType: 'traveler', entityId: 'TRV-2042', createdAt: '2026-07-19', read: false },
  { id: 'NOT-012', userId: 'USR-021', type: 'reminder', category: 'payment', title: 'Invoice Korea Incentive Trip belum lunas', body: 'Invoice Korea Incentive Trip (Termin Awal) masih memiliki sisa tagihan Rp245.000.000, jatuh tempo 15 Agu 2026.', entityType: 'invoice', entityId: 'INV-2011', createdAt: '2026-08-01', read: false },
  { id: 'NOT-013', userId: 'USR-021', type: 'reminder', category: 'payment', title: 'Invoice Singapore Conference akan jatuh tempo', body: 'Invoice Singapore Conference (Termin Awal) jatuh tempo 5 Agu 2026, sisa tagihan Rp75.000.000.', entityType: 'invoice', entityId: 'INV-2041', createdAt: '2026-07-20', read: false },
  { id: 'NOT-014', userId: 'USR-021', type: 'reminder', category: 'trip', title: 'Trip Abu Dhabi Business Delegation sedang berlangsung', body: 'Delegasi bisnis Anda sedang berjalan hingga 2 Agustus 2026 — pantau jadwal dan reservasi pada halaman Project Order.', entityType: 'project', entityId: 'PRJ-202', createdAt: '2026-07-25', read: true },
  { id: 'NOT-015', userId: 'USR-021', type: 'reminder', category: 'payment', title: 'Invoice Abu Dhabi Business Delegation telah lunas', body: 'Pembayaran penuh untuk Invoice Abu Dhabi Business Delegation telah kami terima. Terima kasih.', entityType: 'invoice', entityId: 'INV-2021', createdAt: '2026-07-18', read: true },
  { id: 'NOT-016', userId: 'USR-021', type: 'reminder', category: 'project', title: 'Manila Corporate Meeting 2026 telah selesai', body: 'Trip Manila Corporate Meeting 2026 Anda telah selesai — invoice final telah lunas.', entityType: 'project', entityId: 'PRJ-203', createdAt: '2026-06-13', read: true },
  { id: 'NOT-017', userId: 'USR-021', type: 'change', category: 'reservation', title: 'Perubahan reservasi hotel pada Singapore Conference 2026', body: 'Hotel Singapura mengalami perubahan status reservasi — detail tersedia pada halaman Project Order Anda.', entityType: 'project', entityId: 'PRJ-204', createdAt: '2026-07-24', read: false }
])

/** `DOCUMENT_COMMENTS` (Repair Phase Section 5, Wajib "Comment") — kosong, diisi lewat `addDocumentComment`. */
export const DOCUMENT_COMMENTS: DocumentComment[] = reactive([])
