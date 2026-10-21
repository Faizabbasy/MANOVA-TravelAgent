# MANOVA Travel Agent

Monorepo: Nuxt frontend (`pnpm`) dan Elysia/Bun backend (`bun`). Panduan repository: `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`.

## Demo perusahaan 12 bulan

Setelah memasang Node, pnpm dan Bun, dari root:

```powershell
npm run install:all
npm run demo:year
```

Biarkan terminal API tersebut terbuka. Di terminal kedua:

```powershell
npm run dev:frontend
```

Buka http://localhost:8080/login, pilih Super Admin atau Finance. Data fiktif November2025–Oktober2026 berisi 40 project, invoice customer/supplier, kas/bank, biaya, payroll, kasbon, aset, pinjaman, jurnal dan laporan yang dihasilkan dari transaksi sumber.

Demo memakai database khusus `backend/.data/owner-year-demo-v1/database`; input tetap ada setelah restart dan tidak di-seed ulang. DATABASE_URL aplikasi tidak dipakai oleh command demo. Database yang terisi data lain ditolak, tidak dihapus. Kode seed dapat dibagikan lewat repository; file database lokal tidak ikut Git. Command ditolak pada production; server hanya loopback.

Port3000 diperlukan untuk API dan8080 untuk frontend. Untuk alternatif port dan rentang laporan, lihat [panduan demo lengkap](docs/owner-accounting-implementation/15-DEMO-PERUSAHAAN-12-BULAN.md). Accounting demo adalah rehearsal dengan kebijakan TEST_ONLY; tidak mengaktifkan buku produksi.
