# Backend HR (S11c) — desain

Tanggal: 13 Oktober 2026 · Branch: `production` · Status: disetujui (Finance & Super Admin pegang angka; Admin tidak melihat angka; payroll tanpa posting ledger; eksekusi native)

Bagian ketiga S11. Halaman Human Resource pindah ke server: karyawan, absensi, review kinerja, payroll, komisi dan
insentif.

## Keputusan pengguna

1. Angka gaji, tunjangan, potongan, komisi dan insentif **dipegang Finance dan Super Admin**.
2. **Admin tidak melihat angka** itu sama sekali (server tidak mengirimnya), sejalan dengan ADR-007.
3. Payroll **hanya menyimpan status** (draft → approved → paid); pembayaran gaji tetap dicatat Finance lewat alur kas
   yang ada. Posting otomatis ke ledger = tahap terpisah bila dibutuhkan.

## Masalah yang ditutup

1. Seluruh data HR hanya ada di memori browser.
2. `hr.manage-payroll` diberikan ke Admin, dan halaman menampilkan gaji ke siapa pun yang bisa membuka HR.
3. Baris payroll hanya bisa diubah saat run masih draft, tetapi UI tidak bisa membuat run baru.

## Keputusan desain

| Topik | Keputusan |
|---|---|
| Hak uang | `hr.manage-payroll` dipindah dari Admin ke **Finance** (Super Admin otomatis) di kedua matriks RBAC |
| Hak karyawan | `hr.manage-employee` (Admin) untuk field non-uang: nama, jabatan, departemen, tipe, status, tanggal masuk, kontak, user tertaut |
| Gaji karyawan | `baseSalaryMinor` dan `commissionRatePercent` hanya dikirim ke pemegang `hr.manage-payroll`; untuk peran lain `null`. Mengubahnya butuh `hr.manage-payroll` (403 bila tidak). Admin yang membuat karyawan tidak mengisi gaji (Finance mengisinya kemudian; default 0 = per proyek) |
| Absensi & review | Dibaca semua peran internal; tidak ada penulisan (UI memang hanya menampilkan) |
| Payroll | Hanya `hr.manage-payroll` (Admin 403 juga untuk baca). `POST /payroll-runs {period}` membuat run draft + baris untuk karyawan aktif bergaji (gaji pokok dari data karyawan, tunjangan & potongan 0); satu run per periode. Approve (draft→approved, catat penyetuju) dan Paid (approved→paid). Baris payroll hanya bisa diubah saat run draft |
| Komisi | Dihitung server dari project (`owner_user_id` → karyawan tertaut, `contract_value_minor` × tarif); status dari project (ditutup → paid, completed → approved, lainnya accrued). Tidak disimpan |
| Insentif | Disimpan (`INC-…`): karyawan, project, periode, nominal, catatan; status approved. Hanya `hr.manage-payroll` |
| Uang di wire | Desimal string minor (`baseSalaryMinor`, `allowanceMinor`, `deductionMinor`, `amountMinor`, `baseAmountMinor`) |
| Audit | Non-uang: `employee.created/updated`. Uang: `finance.employee_compensation.changed`, `finance.payroll.created/approved/paid`, `finance.payroll_line.updated`, `finance.incentive.created` — berawalan `finance.` sehingga Activity Center menyembunyikannya dari Admin (aturan S10a) dan angkanya boleh tercatat di before/after |
| Seed | Karyawan, absensi, payroll run & baris, review dari fixture; seed ulang tidak menimpa baris yang diubah API |

## Backend

- Migrasi `0038_hr`: `employees`, `attendance_records`, `performance_reviews`, `payroll_runs`, `payroll_lines`,
  `incentives`.
- `core/hr.ts` + `core/hr-routes.ts`: `GET/POST /employees`, `PATCH /employees/:id`, `GET /attendance`,
  `GET /performance-reviews`, `GET/POST /payroll-runs`, `POST /payroll-runs/:id/approve|pay`, `GET /payroll-lines`,
  `PATCH /payroll-lines/:id`, `GET /hr/commissions` (turunan + insentif), `POST /incentives`.

## Frontend

- Types/endpoints; `data/hr-sync.ts`: muat ke `EMPLOYEES`, `ATTENDANCE_RECORDS`, `PERFORMANCE_REVIEWS`, dan — hanya
  untuk pemegang `hr.manage-payroll` — `PAYROLL_RUNS`, `PAYROLL_LINES`, `COMMISSION_RECORDS`; aksi server-first.
- Halaman HR: tab Payroll & Komisi dan kolom/isian gaji hanya untuk `hr.manage-payroll`; tombol **Buat Payroll**;
  approve/paid, edit baris, insentif dan karyawan lewat server.
- Guard melarang `addEmployee(`, `updateEmployee(`, `addIncentive(`, `updatePayrollLine(`, `updatePayrollRunStatus(`.

## Testing

- Backend `test/hr.test.ts`: baca karyawan (Admin tanpa angka, Finance dengan angka, portal 403), buat/ubah karyawan
  (Admin non-uang; uang oleh Admin 403; Finance ubah gaji), payroll (Admin 403, buat run, run ganda 422, edit baris
  hanya draft, approve/pay berurutan), komisi turunan & insentif, audit tanpa angka.
- Frontend: tes `hr-sync`, guard, `pnpm test`, vue-tsc ≤ 1983, eslint vs HEAD, `pnpm build`.

## Deploy

Migrasi `0038` otomatis. Setelah push: `bun run db:seed:demo` sekali.
