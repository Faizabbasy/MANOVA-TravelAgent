# Pengujian dan acceptance end-to-end

`frontend/package.json` sudah punya `lint`, `typecheck`, `test`, `build` (Vitest). `frontend/app/data/*test.ts` dan `app/constants/navigation.test.ts` adalah pola test lama. `backend/package.json` masih `test` placeholder yang gagal; Phase 1 wajib menyiapkan test backend. Jalankan checks setelah tiap fase dan laporkan hasil nyata, bukan klaim umum. Karena plugin client-only pernah lolos SSR tetapi gagal mount (`docs/frontend-known-issues.md`), cek interaksi browser, bukan hanya HTTP 200.

## Domain test utama

| Skenario | Bukti yang harus lulus |
|---|---|
| Issue invoice customer → AR | AR muncul satu kali, due/expected benar, belum ada statement cash movement. |
| Receipt DP parsial | Allocation tercatat, AR turun tepat nominal, statement + ledger account naik, booking/project context menaut source. |
| Vendor invoice approve → AP | AP muncul satu kali; approval tidak mengurangi cash. |
| Vendor payment parsial | AP turun sesuai allocation, statement − dan account ledger turun; duplicate request tidak menggandakan posting. |
| Transfer A→B dengan fee | Dua account legs dan fee tepat; company total hanya turun fee; rule B→A dapat berbeda. |
| Refund policy H-7 | Tier boundary benar, paid deposit basis, source payment dan snapshot tersimpan; approved refund tidak langsung mengurangi cash; settlement posting menguranginya tepat satu kali. |
| Cashflow 30d/3m/6m/12m | Monthly chain opening+in−out=closing, no double count setelah actual posting, overdue masuk first bucket, gap warning tepat. |
| Reversal | Original tetap terlihat, compensating movement mengembalikan saldo dan outstanding sesuai aturan. |
| RBAC | Finance/management/PM/client/supplier punya data/aksi tepat; akses URL langsung dan manipulasi ID body ditolak server. |
| Existing flows | Lead→Project Order, Project detail, booking flight/hotel/transport/MICE, vendor/service order, client billing masih bekerja setelah finance mock dibuang. |

## Uji kualitas dan UX

- Browser desktop 1440px, tablet 768px, mobile 375px; halaman utama dan form posting; keyboard-only dan screen reader smoke; kontras, fokus, label, validasi inline.
- Setiap halaman memiliki loading, no data, filter empty, error, success, dan stale data/409 state. Data sensitif tidak bocor di response client/supplier.
- Drilldown dari dashboard → AR/AP → invoice/payment → statement → rekening dan dari booking/vendor/project → record finance bekerja. Deep link finance lama masuk ke tujuan baru yang relevan.
- Data besar: paginate statement/AR/AP, index query, stable ordering; target performa ditetapkan setelah baseline lokal, jangan hardcode angka tanpa pengukuran.
- Exact numeric reconciliation: total current cash = jumlah saldo account, account closing = opening + posted in − posted out, AR/AP aggregate = jumlah row outstanding, cashflow subtotal = drilldown row yang ditampilkan.

## Acceptance fixture terkontrol

Siapkan fixture **baru yang eksplisit test-only**: 2 rekening, 2 project, customer A/B, vendor hotel/airline, DP partial, invoice pelunasan, 2 vendor invoices, 1 policy 4 tier, 1 refund, 1 transfer dengan fee directional. Jangan memakai demo fixture lama sebagai bukti transaksi kas nyata. Bandingkan expected totals dengan assertions deterministik, tidak snapshot UI saja.

## Gerbang tiap fase

Pada fase tanpa UI, backend typecheck/test/migration up/down atau forward+restore dan API smoke. Pada fase UI, tambah frontend lint/typecheck/test/build dan browser journey. Bila check gagal karena baseline yang sudah rusak, dokumentasikan error persis, dampak, dan apakah perubahan fase memperburuknya. DoD tidak boleh dicentang berdasarkan build saja; sertakan minimal satu uji perilaku tiap fitur yang baru disambung.
