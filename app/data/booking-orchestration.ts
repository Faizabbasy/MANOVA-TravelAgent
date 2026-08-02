import { reactive } from 'vue'
import type { BookingOrchestrationRecord } from '~/types/booking-orchestration'

/**
 * `reactive()` (Section 18 — roadmap Section 00–24 baru) — melanjutkan pola Section 07 dst.
 *
 * Satu record per SETIAP fixture Flight/Hotel/Transport/MICE existing (Section 13-16) — 18 booking total
 * (6 flight + 6 hotel + 5 transport + 1 mice), tidak ada yang terlewat (lihat `docs/mockup-data-scenarios.md`
 * bagian baru Section 18 untuk enumerasi silang). Narasi diseed SENGAJA menautkan ke booking yang sudah ada
 * (bukan skenario lepas konteks):
 *
 * - **Dependency chain nyata**: `TRN-1035` (Transport, Sales Team GRP-002, `confirmed`) `dependsOn` `HTL-1034`
 *   (Hotel, Sales Team GRP-002 juga, masih `quoted` — BELUM confirmed) — mendemokan "blocked dependency"
 *   exception karena transfer darat rombongan yang sama seharusnya menunggu hotel dikonfirmasi dulu.
 * - **Payment gate states**: `cleared` (FLT-1011, FLT-1031, HTL-1033, TRN-1036 — booking yang sudah
 *   issued/confirmed/completed penuh), `pending` (FLT-1021, HTL-1022, HTL-1035, TRN-1034, TRN-1035, MICE-1035
 *   — sudah confirmed-equivalent tapi belum ditandai lunas), `not-required` (booking yang masih di tahap
 *   awal/hold/quoted/cancelled — belum relevan untuk gate finansial).
 * - **Failure → retry → manual fallback**: `FLT-1021` (Abu Dhabi, `reissued`, sudah punya `hasScheduleChange`
 *   sejak Section 13) — percobaan reissue otomatis pertama gagal (timeout GDS mock), diikuti fallback manual
 *   oleh tim Ticketing lewat kontak langsung ke counter airline. Menautkan ke narasi `scheduleChangeNote`
 *   existing, bukan detail baru yang tidak berhubungan.
 * - **Duplicate flag**: `HTL-1036` (Hotel, PRJ-102, `requested`) — permintaan kamar overflow untuk traveler
 *   yang menyusul belakangan pada project yang SUDAH punya Hotel Booking aktif (`HTL-1022`) — ditandai
 *   `flaggedDuplicate: true` sebagai contoh booking yang SENGAJA dibuat sebagai duplicate (dikonfirmasi
 *   eksplisit), bukan kesalahan input.
 */
export const BOOKING_ORCHESTRATION_RECORDS: BookingOrchestrationRecord[] = reactive([
  // --- Flight (Section 13) ---
  { id: 'BKO-001', bookingType: 'flight', bookingId: 'FLT-1011', projectId: 'PRJ-101', paymentGateStatus: 'cleared', attemptLog: [] },
  {
    id: 'BKO-002',
    bookingType: 'flight',
    bookingId: 'FLT-1021',
    projectId: 'PRJ-102',
    paymentGateStatus: 'pending',
    attemptLog: [
      { id: 'BKO-002-ATT-1', at: '2026-07-05T09:00', outcome: 'failed', note: 'Percobaan reissue otomatis ke sistem airline gagal — response timeout dari GDS mock saat menyesuaikan jadwal baru (lihat CHG-1021).' },
      { id: 'BKO-002-ATT-2', at: '2026-07-05T10:30', outcome: 'manual-fallback', note: 'Reissue berhasil diproses manual oleh tim Ticketing lewat kontak langsung ke counter airline — tiket terbit dengan jadwal baru 22–26 Sep 2026.' }
    ]
  },
  { id: 'BKO-003', bookingType: 'flight', bookingId: 'FLT-1031', projectId: 'PRJ-103', paymentGateStatus: 'cleared', attemptLog: [] },
  { id: 'BKO-004', bookingType: 'flight', bookingId: 'FLT-1032', projectId: 'PRJ-103', paymentGateStatus: 'not-required', attemptLog: [] },
  { id: 'BKO-005', bookingType: 'flight', bookingId: 'FLT-1023', projectId: 'PRJ-102', paymentGateStatus: 'not-required', attemptLog: [] },
  { id: 'BKO-006', bookingType: 'flight', bookingId: 'FLT-1033', projectId: 'PRJ-103', paymentGateStatus: 'not-required', attemptLog: [] },

  // --- Hotel (Section 14) ---
  { id: 'BKO-007', bookingType: 'hotel', bookingId: 'HTL-1022', projectId: 'PRJ-102', paymentGateStatus: 'pending', attemptLog: [] },
  { id: 'BKO-008', bookingType: 'hotel', bookingId: 'HTL-1023', projectId: 'PRJ-102', paymentGateStatus: 'not-required', attemptLog: [] },
  { id: 'BKO-009', bookingType: 'hotel', bookingId: 'HTL-1033', projectId: 'PRJ-103', paymentGateStatus: 'cleared', attemptLog: [] },
  { id: 'BKO-010', bookingType: 'hotel', bookingId: 'HTL-1034', projectId: 'PRJ-103', paymentGateStatus: 'not-required', attemptLog: [] },
  { id: 'BKO-011', bookingType: 'hotel', bookingId: 'HTL-1035', projectId: 'PRJ-103', paymentGateStatus: 'pending', attemptLog: [] },
  {
    id: 'BKO-012',
    bookingType: 'hotel',
    bookingId: 'HTL-1036',
    projectId: 'PRJ-102',
    paymentGateStatus: 'not-required',
    attemptLog: [],
    flaggedDuplicate: true
  },

  // --- Transport (Section 15) ---
  { id: 'BKO-013', bookingType: 'transport', bookingId: 'TRN-1034', projectId: 'PRJ-103', paymentGateStatus: 'pending', attemptLog: [] },
  {
    id: 'BKO-014',
    bookingType: 'transport',
    bookingId: 'TRN-1035',
    projectId: 'PRJ-103',
    paymentGateStatus: 'pending',
    attemptLog: [],
    dependsOn: [{ bookingType: 'hotel', bookingId: 'HTL-1034' }]
  },
  { id: 'BKO-015', bookingType: 'transport', bookingId: 'TRN-1036', projectId: 'PRJ-103', paymentGateStatus: 'cleared', attemptLog: [] },
  { id: 'BKO-016', bookingType: 'transport', bookingId: 'TRN-1037', projectId: 'PRJ-103', paymentGateStatus: 'not-required', attemptLog: [] },
  { id: 'BKO-017', bookingType: 'transport', bookingId: 'TRN-1038', projectId: 'PRJ-103', paymentGateStatus: 'not-required', attemptLog: [] },

  // --- MICE (Section 16) ---
  { id: 'BKO-018', bookingType: 'mice', bookingId: 'MICE-1035', projectId: 'PRJ-103', paymentGateStatus: 'pending', attemptLog: [] }
])
