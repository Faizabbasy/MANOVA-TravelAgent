# RBAC, audit, dan validasi

Frontend sekarang memiliki `frontend/app/data/rbac.ts`, `app/constants/capabilities.ts`, `app/composables/usePermissions.ts`, dan `app/middleware/rbac.global.ts`. Itu pola UX yang perlu diadaptasi, **bukan** security boundary karena sumber role di `localStorage`. Backend baru wajib memverifikasi session dan scope pada setiap read/write; jangan mempercayai `recordedBy`, `vendorId`, `partyId`, atau `role` dari browser tanpa pemeriksaan.

## Matriks kemampuan awal

| Aksi | Finance | Management | Procurement | Operations/PM | Client | Supplier |
|---|---|---|---|---|---|---|
| Lihat company cash, statement, semua AR/AP | ya | ya/read | hanya AP yang relevan | ringkasan project sesuai scope | tidak | tidak |
| Kelola rekening/opening/fee | ya + approval terpisah untuk opening | approve bila kebijakan | tidak | tidak | tidak | tidak |
| Issue invoice customer, record receipt | ya | view/approve exception | tidak | lihat project | invoice/payment sendiri read-only | tidak |
| Review vendor invoice, record disbursement | ya | approval exception | submit/review sesuai existing role | lihat status project | tidak | submit invoice miliknya saja |
| Assign policy/cancel booking | view/finance settlement | approval exception | tidak | cancel operasi sesuai izin existing | request bila flow client existing | tidak |
| Approve refund, settle refund | maker/checker terpisah jika memungkinkan | approve besar/exception | tidak | view kasus project | status refund sendiri | tidak |
| Cashflow | ya | ya | tidak/default | project net flow bila diizinkan | tidak | tidak |

Rekonsiliasi dengan `ROLE_MODULE_ACCESS` dan `ROLE_CAPABILITIES` aktual; jangan membuat role baru jika role existing cukup. Tambahkan kemampuan granular seperti `finance.view-cash`, `finance.manage-bank-accounts`, `finance.post-cash`, `finance.approve-refund`, `finance.manage-policy`, `finance.view-project-finance`. Implementasi dan acceptance matriks final harus dicatat Phase 1. Frontend menyembunyikan/disable aksi untuk UX; backend tetap mengembalikan 403. Client dan Supplier hanya menerima DTO yang disanitasi, bukan DTO internal penuh yang disembunyikan oleh CSS.

## Audit wajib

Log append-only pada: publish policy, assign policy ke booking, issue/void invoice, perubahan expected date, approval/reject AP, receipt/disbursement, transfer, cancellation, credit note, refund approval, settlement, reversal, opening balance/cutover. Simpan actor server, timestamp, alasan, source ID, sebelum/sesudah field relevan, request ID, IP/user agent sesuai kebijakan privasi. Proof file punya hash dan kontrol akses. Tidak mencatat nomor rekening penuh atau data sensitif dalam log.

## Validasi lintas layer

- Server: uang > 0, currency/precision benar, date sah, due/expected semantik, FK/scope valid, status transition valid, allocation tidak overshoot, bank aktif dan currency cocok, fee rule cocok arah/waktu, policy tier lengkap, refund tidak melebihi eligible, duplicate source/idempotency.
- UI: pesan bahasa awam dan field error dekat input; preview dampak sebelum posting; disable submit ketika pending; error 409/422 ditampilkan dengan tindakan yang dapat diambil, bukan toast generik.
- DB: unique FK/check/index untuk invariant yang dapat ditegakkan; transaksi atomik saat posting.
- Upload: tipe MIME allowlist, batas ukuran, scan/isolasi bila platform mendukung, secure metadata, akses owner/scope, signed URL atau streaming otorisasi. Jangan simpan file bukti di `public/`.

## Risiko khusus repo

`frontend/app/middleware/auth.ts` berjalan di client dan demo session `localStorage`; jangan menganggap ini autentikasi produksi. `frontend/app/pages/client/project-orders/[id]/index.vue` dan Supplier Portal sudah berusaha menyaring data internal; saat API nyata ada, sanitasi server harus menjadi sumber kebenaran. Test user yang mengganti ID pada URL/body harus membuktikan tidak bisa membaca account/company lain atau menulis invoice vendor lain.
