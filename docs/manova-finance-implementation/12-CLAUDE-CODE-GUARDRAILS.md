# Guardrails eksekusi

1. **Baca status Git dan instruksi lokal lebih dulu.** Checkout berubah saat paket dibuat: dari ratusan file `D` menjadi branch `monorepo`/HEAD `64339d0`, dengan root guides/scripts masih punya perubahan lokal. Jangan `git reset --hard`, `git clean`, rekonstruksi root lama, atau menimpa kerja user. Catat baseline terbaru sebelum edit.
1a. **Ikuti aturan package manager repo.** `frontend/` memakai pnpm, `backend/` memakai Bun; root `CLAUDE.md` menyediakan scripts orchestrator dan meminta perubahan API/UI lintas package dalam satu commit/PR. Baca file instruksi terbaru sebelum bekerja.
2. **Hapus dan bangun ulang UI finance lama.** Izin pengguna eksplisit. Audit import/deep link sebelum delete, lalu migrasikan consumer dan redirect. Jangan mempertahankan layar finance lama hanya karena ada dokumen historis yang pernah menandainya `LOCKED`.
3. **Jaga domain non-finance.** Project, 4 tipe booking, vendor/procurement, client portal, dashboard app, RBAC global, dan shell tetap berfungsi. Ubah mereka secara aditif/seperlunya untuk membaca finance baru; jangan rewrite massal `frontend/app/data/index.ts`.
4. **Satu source of truth.** Jangan membangun backend model finance dan frontend array reactive baru yang sama-sama menerima write. Vue memakai API untuk finance nyata; demo seed terpisah.
5. **Backend dulu untuk business rule.** Browser tidak menentukan saldo, outstanding, tier DP, fee, cashflow, atau izin final. UI hanya preview/format.
6. **Posting uang immutable dan atomik.** Jangan mengedit/hapus actual movement; reversal dengan alasan. Unique idempotency key dan transaksi DB wajib.
7. **Migration aman.** Tidak menghapus histori/kolom lama sampai cutover dan backup. Rehearsal fresh DB + restore/rollback. No destructive seed di produksi.
8. **No fake completion.** `GET /` backend, fixture mock, HTTP 200, atau chart yang mirip cash flow bukan bukti fitur finansial aktif. Laporkan batas demo/produksi jelas.
9. **Tidak overbuild.** ML/history predictive dan what-if simulation future only. General Ledger penuh, pajak kompleks, payment gateway/bank API, dan multi-currency treasury hanya bila benar-benar diperlukan oleh acceptance v1 dan infrastruktur.
10. **UI serius tetapi mudah dipakai.** Enam menu primer, istilah jelas, satu CTA utama, progressive disclosure, input minimal, state lengkap, responsive/accessibility. Style konsisten dengan shell MANOVA, tanpa menyalin layout finance mock lama.
11. **Permission backend.** `localStorage` frontend bukan otoritas; scope Client/Supplier diperiksa di query/command. DTO eksternal disanitasi sebelum dikirim.
12. **Dokumentasi tiap fase.** Catat ADR bila menyimpang dari rancangan, update consumer map dan checklist, uji lint/typecheck/test/build serta browser untuk UI. Jangan lanjut fase berikutnya dengan invariant uang yang gagal.
