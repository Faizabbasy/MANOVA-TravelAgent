# UI V2 di atas Backend Monorepo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project Detail, Dashboard, dan menu Operasional memakai UI branch `V2-client-revision`, sementara semua data dan aksi keuangan memakai server monorepo — tanpa satu pun angka atau aksi keuangan mock dari V2.

**Architecture:** Branch kerja `feat/v2-ui-on-monorepo` dibuat dari `monorepo`, lalu `V2-client-revision` di-merge (git mendeteksi pindah folder `app/` → `frontend/app/`). Merge commit hanya menyatukan kode (V2 menang untuk UI operasional, monorepo menang untuk Finance/role/login/backend). Task berikutnya mengganti setiap bagian keuangan mock di UI V2 dengan data server satu per satu, menambah dua fitur server baru (DP per peserta Group Trip, Debit Note), lalu menghapus fungsi keuangan mock dan memasang tes penjaga agar tidak kembali.

**Tech Stack:** Nuxt 4 + Vue 3 + TypeScript (pnpm, Vitest) di `frontend/`; Elysia di Bun + PostgreSQL/PGlite (bun test) di `backend/`.

**Spec:** Keputusan user di sesi 2026-10-01 (audit "UI V2 → sumber data"):
1. Lingkup 1 — semua keuangan dari server; data operasional (milestone, task, traveler, itinerary, dokumen, diskusi, seat) tetap data frontend seperti monorepo saat ini.
2. Budget per milestone / per layanan, "Budget Terpakai", dan peringatan budget overrun **disembunyikan**.
3. Pengeluaran project dicatat **hanya oleh Finance (dan Super Admin)**.
4. DP per peserta Group Trip **dibangun** di server.
5. Debit Note **dibangun** di server.

## Global Constraints

- Package manager tetap: **pnpm** di `frontend/`, **bun** di `backend/`. Jangan menambah lockfile lain.
- Frontend port 8080, backend port 3000. Frontend memanggil backend lewat `/api/v1/**` (`frontend/app/composables/useApi.ts`).
- Mengubah bentuk response API → perbarui semua consumer frontend di commit yang sama.
- Role aktif hanya `super-admin`, `admin`, `finance`. Admin **tidak pernah** melihat nominal keuangan (server mengirim `view: 'status'`). `frontend/app/data/rbac.ts` dan `backend/src/auth/rbac.ts` harus tetap sinkron.
- Uang di API = string minor unit (`MoneyMinor`), IDR 0 desimal. Posting uang wajib header `Idempotency-Key`.
- Migrasi baru wajib punya file `.up.sql` dan `.down.sql`; nomor lanjut dari `0013`.
- Teks UI berbahasa Indonesia, mengikuti gaya label yang sudah ada di `frontend/app/lib/finance/labels.ts`.
- Jangan commit `.env`.
- Setiap task diakhiri: `npm run typecheck`, `npm run test`, `npm run lint` (frontend) dan/atau `npm run typecheck:backend`, `npm run test:backend` (backend) — semua dari root — hijau, lalu commit.

## Review Focus

1. **Admin membuka Project Detail / Dashboard project yang punya invoice** → tidak ada satu pun nominal keuangan (hero, tab Finance, Pengeluaran, Vendors, Bookings Group Trip, Dashboard); hanya label status. Tes: Task 4 (`project-hero.test.ts` kasus `view: 'status'`), Task 8 (`dashboard-finance.test.ts` kasus admin).
2. **Project/sales order ada di fixture V2 tapi belum ada di server** (seed belum di-reset) → kartu keuangan menampilkan "Data keuangan belum tersedia", halaman tidak blank/crash. Tes: Task 4 (`heroFigures(null)`), Task 10 (frontend: `groupTripOrderFigures` dengan summary 404 → `unavailable`).
3. **Konfirmasi DP Group Trip diklik dua kali / di-retry** → tepat satu invoice dan satu penerimaan. Tes: Task 9 (`same idempotency key replays` + `second confirm on same order is rejected`).
4. **DP di bawah 30% atau melebihi harga** → ditolak dengan pesan jelas; DP = harga penuh → invoice langsung lunas. Tes: Task 9 (tiga kasus batas).
5. **Debit note untuk invoice draft/void, atau void debit note yang sudah dibayar** → ditolak. Tes: Task 11 (`rejects draft/void origin, short reason, and admin`, `cannot void a paid debit note`).

---

## File Structure

**Backend (baru/ubah)**
- `backend/migrations/0014_group_trip_sales_orders.{up,down}.sql` — tabel referensi `sales_order_refs`, kolom `customer_invoices.sales_order_id`.
- `backend/migrations/0015_finance_debit_notes.{up,down}.sql` — tipe invoice `debit_note`, kolom `adjusts_invoice_id`, sequence nomor `DN-`.
- `backend/migrations/0016_project_expense_categories.{up,down}.sql` — hanya bila kategori disimpan dengan CHECK constraint (lihat Task 6 Step 1).
- `backend/src/modules/finance/group-trip.ts` — konfirmasi DP per sales order + ringkasan per sales order.
- `backend/src/modules/finance/debit-notes.ts` — terbitkan debit note.
- `backend/src/modules/finance/receivables.ts` — invoice/receipt menerima pihak dari sales order.
- `backend/src/modules/finance/reports.ts` — laporan bulanan menerima `from`/`to`.
- `backend/src/modules/finance/common.ts` — kategori pengeluaran project.
- `backend/src/modules/finance/routes-ar-ap.ts` — route baru.
- `backend/src/db/seed-demo.ts`, `backend/scripts/extract-demo-core.ts`, `backend/src/db/seeds/demo-core.json` — sales order + data V2 baru.
- `backend/test/finance-group-trip.test.ts`, `backend/test/finance-debit-notes.test.ts`, tambahan di `finance-arap.test.ts`, `finance-overview.test.ts`.

**Frontend (baru/ubah)**
- `frontend/app/lib/finance/project-hero.ts` (+test) — angka hero Project Detail dari ringkasan server.
- `frontend/app/lib/finance/dashboard-finance.ts` (+test) — angka widget Dashboard V2 dari server.
- `frontend/app/lib/finance/group-trip.ts` (+test) — angka per sales order.
- `frontend/app/components/finance/FinanceGroupTripDpDialog.vue`, `FinanceDebitNoteDialog.vue`, `FinanceProjectExpenses.vue`.
- `frontend/app/pages/project-orders/[id]/index.vue`, `frontend/app/pages/index.vue`, komponen `project-order/*`, `dashboard/*` — UI V2 disambung ke server.
- `frontend/app/no-mock-finance.test.ts` — tes penjaga.

---

## Phase A — Gabungkan UI V2 ke monorepo

### Task 1: Branch kerja dan merge V2

**Files:** seluruh repo (merge). Tidak ada file baru.

**Interfaces:**
- Produces: branch `feat/v2-ui-on-monorepo` yang build & test hijau, UI V2 tampil, Finance monorepo utuh. Bagian keuangan di halaman V2 **sementara** masih mock (diganti Task 3–8).

- [ ] **Step 1: Buat branch dan mulai merge tanpa commit**

```bash
git switch monorepo
git switch -c feat/v2-ui-on-monorepo
git merge --no-commit --no-ff V2-client-revision
git status --short | grep -E '^(UU|AA|DU|UD|AU|UA|DD) ' > /tmp/conflicts.txt; wc -l /tmp/conflicts.txt
```

Expected: merge berhenti dengan konflik; git mendeteksi rename `app/` → `frontend/app/` (file V2 masuk ke `frontend/app/`). Jika ada file V2 yang mendarat di `app/` (root), pindahkan: `git mv app/<path> frontend/app/<path>`.

- [ ] **Step 2: Selesaikan konflik — aturan "monorepo menang"** (Finance, role, login, server)

```bash
for f in \
  frontend/app/pages/finance frontend/app/pages/login.vue frontend/app/data/rbac.ts frontend/app/data/users.ts \
  frontend/app/middleware frontend/app/composables/useCurrentUser.ts frontend/app/composables/useApi.ts \
  frontend/app/lib frontend/app/types/api.ts frontend/app/plugins/rbac-denied-notice.client.ts backend; do
  git checkout --ours -- "$f" 2>/dev/null; git add -- "$f" 2>/dev/null
done
# Panel Finance lama yang sudah dihapus monorepo tetap dihapus:
git rm -q --ignore-unmatch frontend/app/components/finance/{CreditDebitNotesPanel,InvoiceListPanel,LedgerPanel,OpexPanel,PayablesPanel,PaymentsPanel,ReceivablesPanel,ReconciliationPanel,TaxCurrencyPanel,BillingPanel,PurchasesPanel}.vue
git rm -q --ignore-unmatch frontend/app/components/project-order/ProjectOrderInvoicesCard.vue
```

- [ ] **Step 3: Selesaikan konflik — aturan "V2 menang"** (UI operasional, Project Detail, Dashboard)

```bash
for f in \
  "frontend/app/pages/project-orders/[id]/index.vue" frontend/app/pages/project-orders/index.vue frontend/app/pages/index.vue \
  "frontend/app/pages/accommodation/[id]/index.vue" "frontend/app/pages/mice/[id]/index.vue" "frontend/app/pages/ticketing/[id]/index.vue" \
  "frontend/app/pages/transportation/[id]/index.vue" "frontend/app/pages/vendors/[id]/index.vue" "frontend/app/pages/crm/parties/[id]/index.vue" \
  frontend/app/pages/customer-journey/customers/index.vue frontend/app/pages/changes frontend/app/pages/admin/master-data.vue \
  frontend/app/components/reports frontend/app/components/admin/UsersDirectoryPanel.vue frontend/app/components/sales/SalesFunnelPanel.vue \
  frontend/app/components/dashboard frontend/app/composables/useCountUp.ts frontend/app/utils/sparkline.ts; do
  git checkout --theirs -- "$f" 2>/dev/null; git add -- "$f" 2>/dev/null
done
```

Catat apa yang hilang dari versi monorepo di halaman-halaman ini (dipasang ulang di Task 4–8):

```bash
for f in "frontend/app/pages/project-orders/[id]/index.vue" frontend/app/pages/index.vue "frontend/app/pages/accommodation/[id]/index.vue" \
  "frontend/app/pages/mice/[id]/index.vue" "frontend/app/pages/ticketing/[id]/index.vue" "frontend/app/pages/transportation/[id]/index.vue" \
  "frontend/app/pages/vendors/[id]/index.vue" "frontend/app/pages/crm/parties/[id]/index.vue" frontend/app/pages/changes/index.vue; do
  echo "== $f"; git show "monorepo:$f" | grep -o -E '<Finance[A-Za-z]+|<DashboardFinanceSummary|getProjectFinanceFacts|setProjectFinanceFacts|useFinance[A-Za-z]+|api\.finance\.[A-Za-z]+' | sort -u
done > docs/superpowers/plans/2026-10-01-finance-hooks-to-restore.txt
```

- [ ] **Step 4: Gabung manual file campuran**

Untuk setiap file berikut, buka penanda konflik dan gabungkan sesuai aturan:

| File | Aturan |
|---|---|
| `constants/navigation.ts` | Grup **Operasional** (Milestones, Tugas, Dokumen, Kalender, Perencanaan Project, Catatan/Aktivitas) dari V2. Grup **Finance & ACC** dari monorepo (Ringkasan, Mutasi Rekening, Rekening & Saldo, Piutang Customer, Utang Vendor, Cash Flow + hidden `/finance/refunds`). Hidden routes lama Finance V2 (`/finance/ledger`, `/finance/opex`, `/finance/tax`, `/finance/notes`, `/finance/reconciliation`, `/finance/invoices`, `/finance/payments`) mengikuti monorepo (redirect ke halaman baru). |
| `constants/navigation.test.ts` | Gabungkan kedua sisi; tes monorepo tetap. |
| `constants/mobile-nav.ts` (V2) | Entri Finance diarahkan ke route monorepo di atas. |
| `components/layout/AppSidebar.vue`, `TopHeader.vue`, `layouts/dashboard.vue` | Struktur/mobile dari V2; logout server, skip link, `aria-*`, focus ring dari monorepo. |
| `components/ui/tabs/TabsList.vue` | Pakai `max-w-full` (monorepo) + perubahan V2. |
| `data/index.ts` | Ambil semua fungsi baru V2. Pertahankan perubahan monorepo (refund mock dihapus, `finance-facts`). Fungsi keuangan mock V2 dibiarkan dulu (dihapus Task 12). |
| `data/project-order-workflow.ts` (+test) | Gate DP dari `finance-facts` (monorepo) + perubahan langkah V2. |
| `types/user.ts`, `pages/settings.vue`, `pages/admin/index.vue` | Tipe role 3-role monorepo + tambahan field V2. |

- [ ] **Step 5: Pastikan pemakaian role V2 lolos di model 3 role**

```bash
cd frontend && grep -rn -E "isRole\('(management|sales|operations|bi|crm|marketing|hr)'" app/pages app/components | grep -v test
```

Setiap hit di-resolve oleh `LEGACY_ROLE_ALIAS` (`app/data/rbac.ts`) menjadi `admin`. Halaman `pages/leader-dashboard/index.vue` memakai `canView('management')`/`canView('bi')`: ubah ke `canView('reports')` bila modul `management`/`bi` tidak ada di `MODULE_KEYS` (cek `app/constants/modules.ts`).

- [ ] **Step 6: Verifikasi dan commit merge**

```bash
cd frontend && pnpm install && pnpm typecheck && pnpm test && pnpm lint
cd ../backend && bun run typecheck && bun test
cd .. && git commit -m "merge: V2 client revision UI onto monorepo (finance still to be wired)"
```

Expected: semua hijau. Jumlah problem lint tidak boleh naik dibanding `monorepo` (`git stash; pnpm lint | tail -1` untuk baseline bila perlu).

---

### Task 2: Shell & navigasi — Admin tidak pernah melihat Finance di menu V2

**Files:**
- Modify: `frontend/app/constants/mobile-nav.ts`, `frontend/app/utils/nav-visibility.ts`
- Test: `frontend/app/constants/mobile-nav.test.ts` (baru)

**Interfaces:**
- Consumes: `canViewMenu(menuKey, moduleKey)` dari `usePermissions`, `findNavItemForPath` dari `constants/navigation.ts`.
- Produces: menu mobile mengikuti gerbang RBAC yang sama dengan sidebar.

- [ ] **Step 1: Tulis tes gagal**

```ts
// frontend/app/constants/mobile-nav.test.ts
import { describe, expect, it } from 'vitest'
import { MOBILE_PRIMARY_TABS, MOBILE_MORE_GROUPS } from './mobile-nav'
import { findNavItemForPath } from './navigation'

const allMobileRoutes = () => [
  ...MOBILE_PRIMARY_TABS.map(t => t.to),
  ...MOBILE_MORE_GROUPS.flatMap(g => g.items.map(i => i.to))
]

describe('mobile nav', () => {
  it('every mobile entry maps to a gated nav item', () => {
    for (const to of allMobileRoutes()) {
      const item = findNavItemForPath(to.split('?')[0]!)
      expect(item, to).toBeDefined()
      expect(item!.moduleKey, to).toBeDefined()
    }
  })

  it('finance entries use the new finance routes only', () => {
    const finance = allMobileRoutes().filter(to => to.startsWith('/finance'))
    const allowed = ['/finance', '/finance/statement', '/finance/accounts', '/finance/receivables', '/finance/payables', '/finance/cash-flow']
    for (const to of finance) { expect(allowed).toContain(to.split('?')[0]) }
  })
})
```

Catatan: sesuaikan nama ekspor (`MOBILE_PRIMARY_TABS`, `MOBILE_MORE_GROUPS`) dengan yang benar-benar diekspor `mobile-nav.ts` di V2 — baca file dulu, lalu pakai nama aslinya di tes.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd frontend && pnpm vitest run app/constants/mobile-nav.test.ts`
Expected: FAIL (entri finance lama V2 seperti `/finance/ledger`).

- [ ] **Step 3: Perbaiki `mobile-nav.ts`** — ganti entri finance lama dengan enam route baru; pastikan `nav-visibility.ts` memfilter dengan `canViewMenu` (sama seperti sidebar).

- [ ] **Step 4: Jalankan tes, pastikan lulus** — `pnpm vitest run app/constants/mobile-nav.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/constants/mobile-nav.ts frontend/app/constants/mobile-nav.test.ts frontend/app/utils/nav-visibility.ts
git commit -m "fix(nav): mobile menu uses the server-backed finance routes and RBAC gate"
```

---

### Task 3: Laporan bulanan server menerima rentang tanggal (untuk filter periode Dashboard V2)

**Files:**
- Modify: `backend/src/modules/finance/reports.ts`, route `GET /finance/reports/monthly` (cari di `backend/src/modules/finance/routes*.ts`)
- Modify: `frontend/app/lib/api/endpoints.ts`, `frontend/app/types/api.ts` (query `from`/`to`)
- Test: `backend/test/finance-overview.test.ts` (tambah describe)

**Interfaces:**
- Produces: `GET /api/v1/finance/reports/monthly?from=YYYY-MM-DD&to=YYYY-MM-DD` → `MonthlyReportDto` berisi bulan-bulan yang beririsan dengan rentang; `months` lama tetap berfungsi. `from`/`to` tidak boleh bersama `months`; rentang maksimal 24 bulan; `from <= to`.
- Frontend: `api.finance.monthlyReport({ from?, to?, months? })`.

- [ ] **Step 1: Tes gagal**

```ts
describe('monthly report by date range', () => {
  test('from/to returns exactly the months in range', async () => {
    const r = await get('finance', '/finance/reports/monthly?from=2026-07-15&to=2026-09-10')
    expect(r.status).toBe(200)
    expect(r.json.data.months.map((m: { month: string }) => m.month)).toEqual(['2026-07', '2026-08', '2026-09'])
  })
  test('rejects from after to, months together with from, and ranges over 24 months', async () => {
    expect((await get('finance', '/finance/reports/monthly?from=2026-09-01&to=2026-08-01')).status).toBe(422)
    expect((await get('finance', '/finance/reports/monthly?months=3&from=2026-09-01&to=2026-09-30')).status).toBe(422)
    expect((await get('finance', '/finance/reports/monthly?from=2024-01-01&to=2026-09-30')).status).toBe(422)
  })
  test('admin is refused', async () => {
    expect((await get('admin', '/finance/reports/monthly?from=2026-09-01&to=2026-09-30')).status).toBe(403)
  })
})
```

- [ ] **Step 2: Jalankan** — `cd backend && bun test test/finance-overview.test.ts` → FAIL.

- [ ] **Step 3: Implementasi** di `reports.ts`:

```ts
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.slice(0, 7).split('-').map(Number) as [number, number]
  const [ty, tm] = to.slice(0, 7).split('-').map(Number) as [number, number]
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1; if (m === 13) { m = 1; y += 1 }
  }
  return out
}

export async function monthlyReport(db: Db, query: { months?: string; from?: string; to?: string }) {
  let months: string[]
  if (query.from !== undefined || query.to !== undefined) {
    if (query.months !== undefined) throw errors.validation({ months: ['Pakai months ATAU from/to, bukan keduanya.'] })
    const from = requireDate(query.from, 'from')
    const to = requireDate(query.to, 'to')
    if (from > to) throw errors.validation({ to: ['Tanggal akhir sebelum tanggal awal.'] })
    months = monthsBetween(from, to)
    if (months.length > 24) throw errors.validation({ from: ['Rentang maksimal 24 bulan.'] })
  } else {
    const count = query.months === undefined ? 6 : Number(query.months)
    if (!Number.isInteger(count) || count < 1 || count > 24) throw errors.validation({ months: ['Jumlah bulan 1–24.'] })
    months = monthsBack(todayBusinessDate(), count)
  }
  // …lanjutkan perhitungan lama memakai `months` (hapus deklarasi months lama).
}
```

`requireDate` diimpor dari `./common` (dipakai juga di `receivables.ts`). Tambahkan `from`/`to` ke skema query route.

- [ ] **Step 4: Tes lulus** — `bun test test/finance-overview.test.ts` → PASS; `bun run typecheck`.

- [ ] **Step 5: Frontend client + commit**

Tambah `from?: IsoDate; to?: IsoDate` pada query `monthlyReport` di `types/api.ts` dan `endpoints.ts`.

```bash
git add backend/src/modules/finance backend/test/finance-overview.test.ts frontend/app/lib/api/endpoints.ts frontend/app/types/api.ts
git commit -m "feat(finance): monthly report accepts a date range"
```

---

### Task 4: Project Detail — header & Overview dari server

**Files:**
- Create: `frontend/app/lib/finance/project-hero.ts`, `frontend/app/lib/finance/project-hero.test.ts`
- Modify: `frontend/app/components/project-order/ProjectCommercialHero.vue`, `frontend/app/pages/project-orders/[id]/index.vue` (Overview)

**Interfaces:**
- Consumes: `api.finance.projectSummary(projectId)` → `ProjectFinanceSummaryDto` (`view: 'full' | 'status'`).
- Produces:

```ts
export type ProjectHeroFigures =
  | { kind: 'unavailable' }
  | { kind: 'status'; paymentLabel: string; hasOverdue: boolean }
  | { kind: 'full'; contractMinor: string | null; receivedMinor: string; outstandingMinor: string; paymentLabel: string; hasOverdue: boolean }
export function heroFigures(summary: ProjectFinanceSummaryDto | null): ProjectHeroFigures
```

- [ ] **Step 1: Tes gagal**

```ts
// frontend/app/lib/finance/project-hero.test.ts
import { describe, expect, it } from 'vitest'
import { heroFigures } from './project-hero'

const status = { view: 'status', projectId: 'PRJ-1', paymentStatus: 'dp_received', label: 'DP diterima', hasOverdue: false, cancellation: null } as any
const full = {
  view: 'full', projectId: 'PRJ-1', paymentStatus: 'partial', label: 'Dibayar sebagian', hasOverdue: true, currency: 'IDR',
  contractValueMinor: '1000000', receivable: { receivedMinor: '300000', outstandingMinor: '700000' }
} as any

describe('heroFigures', () => {
  it('no summary (server down / project unknown) is unavailable, never zero', () => {
    expect(heroFigures(null)).toEqual({ kind: 'unavailable' })
  })
  it('admin status view carries no amounts', () => {
    const f = heroFigures(status)
    expect(f).toEqual({ kind: 'status', paymentLabel: 'DP diterima', hasOverdue: false })
    expect(JSON.stringify(f)).not.toMatch(/Minor/)
  })
  it('finance view maps contract, received and outstanding', () => {
    expect(heroFigures(full)).toEqual({ kind: 'full', contractMinor: '1000000', receivedMinor: '300000', outstandingMinor: '700000', paymentLabel: 'Dibayar sebagian', hasOverdue: true })
  })
})
```

Sebelum menulis implementasi, cek nama field asli `PaymentStatusView` dan `ReceivableTotals` di `frontend/app/types/api.ts` (`label`, `hasOverdue`, `receivedMinor`, `outstandingMinor`) dan sesuaikan tes bila berbeda.

- [ ] **Step 2: Jalankan** — `pnpm vitest run app/lib/finance/project-hero.test.ts` → FAIL.

- [ ] **Step 3: Implementasi**

```ts
// frontend/app/lib/finance/project-hero.ts
import type { ProjectFinanceSummaryDto } from '~/types/api'

export type ProjectHeroFigures =
  | { kind: 'unavailable' }
  | { kind: 'status'; paymentLabel: string; hasOverdue: boolean }
  | { kind: 'full'; contractMinor: string | null; receivedMinor: string; outstandingMinor: string; paymentLabel: string; hasOverdue: boolean }

export function heroFigures (summary: ProjectFinanceSummaryDto | null): ProjectHeroFigures {
  if (!summary) { return { kind: 'unavailable' } }
  if (summary.view === 'status') { return { kind: 'status', paymentLabel: summary.label, hasOverdue: summary.hasOverdue } }
  return {
    kind: 'full',
    contractMinor: summary.contractValueMinor,
    receivedMinor: summary.receivable.receivedMinor,
    outstandingMinor: summary.receivable.outstandingMinor,
    paymentLabel: summary.label,
    hasOverdue: summary.hasOverdue
  }
}
```

- [ ] **Step 4: Sambungkan UI**
  - `ProjectCommercialHero.vue`: ganti props angka mock (`quotationIdr`, `collectedIdr`, `outstandingIdr`, `budget*`) dengan satu prop `figures: ProjectHeroFigures`. `full` → `FinanceAmount` untuk Nilai Kontrak / Terkumpul / Outstanding; `status` → `FinancePaymentStatus` label saja; `unavailable` → teks "Data keuangan belum tersedia".
  - Hapus kartu **"Budget Terpakai"** dan item Budget di Overview (keputusan #2).
  - Di halaman: `const summary = useFinanceQuery(async () => (await api.finance.projectSummary(id)).data)`; error 404/offline → `null`.
  - Pasang ulang `<FinancePaymentStatus>` dan `<FinanceCancellationDialog>` (daftar dari `2026-10-01-finance-hooks-to-restore.txt`).

- [ ] **Step 5: Tes lulus, verifikasi, commit**

```bash
cd frontend && pnpm vitest run app/lib/finance/project-hero.test.ts && pnpm typecheck && pnpm test
git add frontend/app/lib/finance/project-hero.* frontend/app/components/project-order/ProjectCommercialHero.vue "frontend/app/pages/project-orders/[id]/index.vue"
git commit -m "feat(project-detail): V2 hero and overview read finance from the server; budget hidden"
```

---

### Task 5: Project Detail — tab Finance V2 dari server

**Files:**
- Modify: `frontend/app/pages/project-orders/[id]/index.vue` (TabsContent `finance`), `frontend/app/components/project-order/ProjectInvoicesPanel.vue` (hapus atau ganti), `frontend/app/components/finance/FinanceProjectPanel.vue`

**Interfaces:**
- Consumes: `FinanceProjectPanel` (monorepo) yang sudah membaca `projectSummary` dan berisi daftar invoice, invoice vendor, rencana tagihan, Close Finance, profitabilitas.
- Produces: tab Finance bergaya V2 tanpa sumber mock.

- [ ] **Step 1: Petakan bagian V2 → pengganti**

| Bagian V2 (mock) | Pengganti |
|---|---|
| Project Value / Outstanding / Project Margin / Actual Cost (StatsCard) | `summary.profitability` + `summary.receivable` (StatsCard V2, nilai dari server; Admin: kartu disembunyikan) |
| `ProjectInvoicesPanel` + template termin (`INVOICE_MILESTONE_TEMPLATES`) | Daftar invoice + rencana tagihan di `FinanceProjectPanel`; tombol "Pakai template termin" membuat beberapa `billing schedule` lewat `api.finance.createSchedule` |
| Credit / Debit Notes | Credit note dari detail invoice server; **Debit note: sembunyikan sampai Task 11** |
| Supplier Invoice (AP Summary) | `summary.vendorInvoices` |
| Close Finance | Penghalang dari server (sudah di `FinanceProjectPanel`) |
| Ringkasan Budget per Milestone, Pengeluaran per Layanan | **Hapus dari tampilan** (keputusan #2) |
| `ProjectPricingBreakdownCard` | Tetap (domain Sales/quotation, bukan pembukuan) |

- [ ] **Step 2: Implementasi** — susun ulang `TabsContent value="finance"` memakai layout `SectionCard`/`StatsCard` V2 yang membungkus bagian-bagian `FinanceProjectPanel` (pecah `FinanceProjectPanel` menjadi slot/section bila perlu, jangan menduplikasi logika fetch). Hapus import `getInvoicesByProject`, `getPaymentsByInvoice`, `getProjectOutstandingIdr`, `getProjectCollectedIdr`, `getInvoiceOutstandingIdr`, `getInvoiceMilestone*`, `createInvoice`, `recordPayment`, `getCreditNotesByProject`, `getDebitNotesByProject`, `getSupplierInvoicesByProject`, `evaluateFinanceClosureGate`, `closeProjectFinance`, `getProjectActualCostIdr`, `getServiceTypeSpendBreakdown`, `updateProjectServiceBudget`, `ensureProjectServiceForBudget`, `updateMilestoneBudget`, `getProjectMilestoneBudgetSummary` dari halaman ini.

- [ ] **Step 3: Verifikasi** — `pnpm typecheck && pnpm test && pnpm lint`; buka `http://localhost:8080/project-orders/PRJ-201?tab=finance` sebagai Finance (angka = Finance → Piutang untuk PRJ-201) dan sebagai Admin (tidak ada nominal).

- [ ] **Step 4: Commit**

```bash
git add frontend/app
git commit -m "feat(project-detail): V2 finance tab on the server project panel; budget sections hidden"
```

---

### Task 6: Project Detail — tab Pengeluaran di server (Finance & Super Admin saja)

**Files:**
- Modify: `backend/src/modules/finance/common.ts` (kategori), `backend/test/finance-money.test.ts`
- Create: `frontend/app/components/finance/FinanceProjectExpenses.vue`
- Modify: `frontend/app/lib/finance/labels.ts`, `frontend/app/pages/project-orders/[id]/index.vue` (TabsContent `expenses`)

**Interfaces:**
- Consumes: `POST /finance/transactions` (`kind: 'expense'`, `projectId`, `category`) via `FinanceManualTransactionDialog`; `GET /finance/statement?projectId=&kind=expense`.
- Produces: `EXPENSE_CATEGORIES` menyertakan `transportation`, `meals`, `supplies`, `accommodation`, `emergency` (selain yang lama).

- [ ] **Step 1: Cek penyimpanan kategori**

```bash
grep -rn "category" backend/migrations/*.up.sql | grep -i check
```

Bila ada CHECK constraint pada `financial_transactions.category`, buat `0016_project_expense_categories.up.sql` yang mengganti constraint dengan daftar baru, dan `.down.sql` yang mengembalikan daftar lama (gagal bila ada baris dengan kategori baru — tulis `update … set category = 'other'` lebih dulu di down).

- [ ] **Step 2: Tes gagal** (tambah di `finance-money.test.ts`)

```ts
test('project expense with a project category is posted against the project', async () => {
  const r = await money('finance', '/finance/transactions', {
    kind: 'expense', bankAccountId: bank, amountMinor: '250000', effectiveDate: TODAY, category: 'meals', projectId: 'PRJ-201', memo: 'Konsumsi briefing'
  })
  expect(r.status).toBe(201)
  const list = await get('finance', `/finance/statement?projectId=PRJ-201&kind=expense`)
  expect(list.json.data.some((m: { id: string }) => m.id === r.json.data.transactionId)).toBe(true)
})
test('admin cannot post or read project expenses', async () => {
  expect((await money('admin', '/finance/transactions', { kind: 'expense', bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, category: 'meals', projectId: 'PRJ-201' })).status).toBe(403)
  expect((await get('admin', '/finance/statement?projectId=PRJ-201&kind=expense')).status).toBe(403)
})
test('super admin can post a project expense', async () => {
  expect((await money('superAdmin', '/finance/transactions', { kind: 'expense', bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, category: 'supplies', projectId: 'PRJ-201' })).status).toBe(201)
})
```

Sesuaikan helper (`money`, `get`, `bank`, `TODAY`) dengan yang sudah ada di file tersebut, dan path statement/response sesuai `StatementList` (baca bentuknya dulu).

- [ ] **Step 3: Jalankan** — `bun test test/finance-money.test.ts` → FAIL (kategori `meals` ditolak).

- [ ] **Step 4: Implementasi**

```ts
// backend/src/modules/finance/common.ts
export const EXPENSE_CATEGORIES = [
  'payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax',
  'transportation', 'meals', 'supplies', 'accommodation', 'emergency', 'other'
] as const
```

Frontend `labels.ts`: tambah label `transportation: 'Transportasi'`, `meals: 'Konsumsi'`, `supplies: 'Perlengkapan'`, `accommodation: 'Akomodasi'`, `emergency: 'Darurat'` pada peta label kategori pengeluaran yang sudah ada.

- [ ] **Step 5: `FinanceProjectExpenses.vue`** — props `projectId`. Bila `session.can('finance.view-cash')`: tabel V2 (kategori, tanggal, nominal, memo) dari `api.finance.statement({ projectId, kind: 'expense' })` + tombol "Catat pengeluaran" (hanya bila `session.can('finance.post-cash')`) yang membuka `FinanceManualTransactionDialog` dengan `kind='expense'`, `projectId` terkunci, kategori dibatasi ke kategori project. Bila tidak: `EmptyState` "Pengeluaran project dicatat oleh tim Finance."
  Ganti isi `TabsContent value="expenses"` dengan komponen ini; hapus `getProjectExpenses`, `createProjectExpense`, `PROJECT_EXPENSE_CATEGORIES`.

- [ ] **Step 6: Verifikasi & commit**

```bash
cd backend && bun test && bun run typecheck && cd ../frontend && pnpm typecheck && pnpm test && pnpm lint
git add backend frontend/app
git commit -m "feat(project-detail): project expenses are posted and listed on the server (Finance only)"
```

---

### Task 7: Project Detail — tab Vendors, Activity & Changes, dan gate workflow

**Files:**
- Modify: `frontend/app/pages/project-orders/[id]/index.vue` (TabsContent `vendors`, `activity-changes`, step workflow)

**Interfaces:**
- Consumes: `FinanceVendorPaymentDialog`, `FinanceVendorInvoiceSheet`, `FinanceRefundCaseList`/kasus refund server, `getProjectFinanceFacts` (`data/finance-facts.ts`).

- [ ] **Step 1: Implementasi**
  - Vendors: tombol "Bayar vendor" (V2 `recordVendorPaymentDirect`, `paySupplierInvoice`) diganti `FinanceVendorPaymentDialog` dan hanya tampil bila `session.can('finance.post-cash')`. Status supplier invoice dari `summary.vendorInvoices`.
  - Activity & Changes: daftar refund dari server (pola `pages/changes/index.vue` monorepo); hapus `getRefundRequestsByProject`.
  - Workflow: gate "Invoice DP terbit"/"DP diterima" memakai `getProjectFinanceFacts` (pastikan kode V2 di `data/project-order-workflow.ts` tidak membaca invoice mock — tes monorepo `project-order-workflow.test.ts` harus tetap lulus).
- [ ] **Step 2: Verifikasi** — `pnpm typecheck && pnpm test && pnpm lint`.
- [ ] **Step 3: Commit** — `git commit -am "feat(project-detail): vendor payments, refunds and DP gates from the server"`

---

### Task 8: Dashboard V2 dari server

**Files:**
- Create: `frontend/app/lib/finance/dashboard-finance.ts`, `frontend/app/lib/finance/dashboard-finance.test.ts`
- Modify: `frontend/app/pages/index.vue`, `frontend/app/components/dashboard/{DashboardKpiHero,DashboardHeroPanel,DashboardCashFlowSection,MonthlyCashFlowChart}.vue`

**Interfaces:**
- Consumes: `api.finance.monthlyReport({ from, to })` (Task 3), `api.finance.overview()`, `api.finance.statement({ from, to, includeTransfers: false, limit: 1 })` (total masuk/keluar).
- Produces:

```ts
export interface DashboardPeriod { from: IsoDate; to: IsoDate }
export interface DashboardFinanceFigures {
  revenueMinor: string; costMinor: string; netMinor: string; expenseMinor: string
  months: { month: string; revenueMinor: string; costMinor: string; netMinor: string }[]
}
export function periodRange(preset: 'this-month' | 'this-year' | 'all-time' | 'custom', today: IsoDate, custom?: DashboardPeriod): DashboardPeriod
export function sumMonthly(report: MonthlyReportDto): DashboardFinanceFigures
```

- [ ] **Step 1: Tes gagal**

```ts
// frontend/app/lib/finance/dashboard-finance.test.ts
import { describe, expect, it } from 'vitest'
import { periodRange, sumMonthly } from './dashboard-finance'

describe('periodRange', () => {
  it('this month / this year / all time (capped at 24 months)', () => {
    expect(periodRange('this-month', '2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-01' })
    expect(periodRange('this-year', '2026-10-01')).toEqual({ from: '2026-01-01', to: '2026-10-01' })
    expect(periodRange('all-time', '2026-10-01')).toEqual({ from: '2024-11-01', to: '2026-10-01' })
  })
  it('custom uses the chosen range', () => {
    expect(periodRange('custom', '2026-10-01', { from: '2026-07-01', to: '2026-08-31' })).toEqual({ from: '2026-07-01', to: '2026-08-31' })
  })
})

describe('sumMonthly', () => {
  it('adds months as bigint strings, never floats', () => {
    const r = sumMonthly({ asOf: '2026-10-01', timezone: 'Asia/Jakarta', basis: 'accrual', vendors: [], months: [
      { month: '2026-08', invoicedMinor: '0', creditedMinor: '0', revenueMinor: '900000000000001', vendorCostMinor: '0', expenseMinor: '5', costMinor: '10', netMinor: '899999999999991' },
      { month: '2026-09', invoicedMinor: '0', creditedMinor: '0', revenueMinor: '1', vendorCostMinor: '0', expenseMinor: '1', costMinor: '1', netMinor: '0' }
    ] } as any)
    expect(r.revenueMinor).toBe('900000000000002')
    expect(r.costMinor).toBe('11')
    expect(r.netMinor).toBe('899999999999991')
    expect(r.expenseMinor).toBe('6')
    expect(r.months).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Jalankan** — FAIL.

- [ ] **Step 3: Implementasi**

```ts
// frontend/app/lib/finance/dashboard-finance.ts
import type { IsoDate, MonthlyReportDto } from '~/types/api'

export interface DashboardPeriod { from: IsoDate; to: IsoDate }
export interface DashboardFinanceFigures {
  revenueMinor: string; costMinor: string; netMinor: string; expenseMinor: string
  months: { month: string; revenueMinor: string; costMinor: string; netMinor: string }[]
}

export function periodRange (preset: 'this-month' | 'this-year' | 'all-time' | 'custom', today: IsoDate, custom?: DashboardPeriod): DashboardPeriod {
  if (preset === 'custom' && custom) { return custom }
  if (preset === 'this-month') { return { from: `${today.slice(0, 7)}-01`, to: today } }
  if (preset === 'this-year') { return { from: `${today.slice(0, 4)}-01-01`, to: today } }
  // all-time: the server caps a range at 24 months
  const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7))
  const start = new Date(Date.UTC(y, m - 1 - 23, 1))
  return { from: start.toISOString().slice(0, 10), to: today }
}

export function sumMonthly (report: MonthlyReportDto): DashboardFinanceFigures {
  const add = (k: 'revenueMinor' | 'costMinor' | 'netMinor' | 'expenseMinor') => report.months.reduce((s, m) => s + BigInt(m[k]), 0n).toString()
  return {
    revenueMinor: add('revenueMinor'), costMinor: add('costMinor'), netMinor: add('netMinor'), expenseMinor: add('expenseMinor'),
    months: report.months.map(m => ({ month: m.month, revenueMinor: m.revenueMinor, costMinor: m.costMinor, netMinor: m.netMinor }))
  }
}
```

Catatan: `this-month` pada tes memakai `today = 2026-10-01` sehingga `from === to`; itu benar.

- [ ] **Step 4: Sambungkan UI**
  - Filter periode V2 tetap; setiap perubahan memanggil `monthlyReport(periodRange(...))` lewat `useFinanceQuery`.
  - Pemasukan Bersih / Profit / Monthly Cash Flow / Opex → `sumMonthly`. Uang masuk/keluar riil per periode → `statement` (`summary.inMinor/outMinor`, cek nama field di `StatementList`).
  - Utang vendor, invoice terlambat, actual cost per project → `overview` (`view: 'full'`).
  - Admin (`overview.view === 'status'` atau `!session.can('finance.view-cash')`): semua widget keuangan disembunyikan, sama seperti `DashboardFinanceSummary` monorepo.
  - Hapus peringatan budget overrun (`isBudgetOverrun`) dari Dashboard (keputusan #2).
  - Hapus import `getProjectActualCostIdr`, `getRevenueByPeriod`, `getOpexTotalIdr`, `getOpexPeriods`, `OPEX_ENTRIES`, `getPayables`, `getInvoicesByProject`.

- [ ] **Step 5: Verifikasi & commit**

```bash
cd frontend && pnpm vitest run app/lib/finance/dashboard-finance.test.ts && pnpm typecheck && pnpm test && pnpm lint
git add frontend/app
git commit -m "feat(dashboard): V2 dashboard and period filter on server finance figures"
```

Tambahan: angka Dashboard untuk periode "Bulan ini" harus sama dengan Finance → Ringkasan "Uang masuk bulan ini" (cek manual sebagai Finance).

---

### Task 8b: Halaman lain V2 — kartu keuangan monorepo dipasang ulang

**Files:** `pages/{accommodation,mice,ticketing,transportation}/[id]/index.vue`, `pages/vendors/[id]/index.vue`, `pages/crm/parties/[id]/index.vue`, `pages/changes/**`, `components/reports/*`.

- [ ] **Step 1:** Untuk setiap file, pasang ulang hook yang tercatat di `2026-10-01-finance-hooks-to-restore.txt` (`FinanceContextPanel`/"Tagihan & pembayaran", `FinanceCancellationDialog`, `FinancePolicyLine`, laporan server di Reports) ke layout V2. Hapus pemakaian invoice/payment/credit-note/refund mock di file-file ini.
- [ ] **Step 2:** `pnpm typecheck && pnpm test && pnpm lint`.
- [ ] **Step 3:** `git commit -am "feat(ui): V2 booking, vendor, CRM, changes and reports pages keep server finance"`

---

## Phase B — DP per peserta Group Trip (server)

### Task 9: Referensi sales order + konfirmasi DP di server

**Files:**
- Create: `backend/migrations/0014_group_trip_sales_orders.up.sql`, `.down.sql`
- Create: `backend/src/modules/finance/group-trip.ts`
- Modify: `backend/src/modules/finance/receivables.ts`, `backend/src/modules/finance/routes-ar-ap.ts`, `backend/src/db/seed-demo.ts`, `backend/scripts/extract-demo-core.ts`, `backend/src/db/seeds/demo-core.json`
- Test: `backend/test/finance-group-trip.test.ts`

**Interfaces:**
- Produces:
  - Tabel `sales_order_refs(id, project_id, party_id, price_minor, traveler_count, provenance)`; `customer_invoices.sales_order_id` (unik untuk invoice non-void).
  - `POST /api/v1/finance/sales-orders/:id/confirm-dp` (capability `finance.post-cash` + `finance.manage-receivables`, Idempotency-Key) body `{ bankAccountId, dpAmountMinor, effectiveDate, dueDate }` → `{ invoiceId, invoiceNumber, transactionId, outstandingMinor, minimumDpMinor }`.
  - `GET /api/v1/sales-orders/:id/finance-summary` → Finance/Super Admin: `{ view: 'full', salesOrderId, priceMinor, invoicedMinor, receivedMinor, outstandingMinor, invoiceId|null, paymentStatus, label }`; Admin: `{ view: 'status', salesOrderId, paymentStatus, label }`.
  - Aturan: DP minimal `ceil(price × 30%)`, maksimal `price`. Invoice bertipe `dp` senilai harga penuh, pihak = customer sales order (bukan customer project).

- [ ] **Step 1: Migrasi**

```sql
-- 0014_group_trip_sales_orders.up.sql
create table sales_order_refs (
  id             text primary key check (id <> ''),
  project_id     text not null references projects (id),
  party_id       text not null references parties (id),
  price_minor    bigint not null check (price_minor > 0 and price_minor <= 1000000000000000),
  traveler_count integer not null check (traveler_count > 0),
  provenance     text not null default 'manual' check (provenance in ('manual', 'demo-fixture', 'migration')),
  created_at     timestamptz not null default now()
);
create index sales_order_refs_project on sales_order_refs (project_id);

alter table customer_invoices add column sales_order_id text references sales_order_refs (id);
create unique index customer_invoices_one_per_sales_order on customer_invoices (sales_order_id) where sales_order_id is not null and status <> 'void';
```

```sql
-- 0014_group_trip_sales_orders.down.sql
drop index if exists customer_invoices_one_per_sales_order;
alter table customer_invoices drop column if exists sales_order_id;
drop table if exists sales_order_refs;
```

- [ ] **Step 2: Seed** — `extract-demo-core.ts`: impor `SALES_ORDERS` dari `../../frontend/app/data/sales-orders`, tambahkan

```ts
salesOrders: [...SALES_ORDERS].filter(o => o.projectId).sort(byId).map(o => ({
  id: o.id, projectId: o.projectId!, partyId: o.customerId, priceMinor: String(Math.round(o.priceIdr)), travelerCount: o.travelerCount
})),
```

Tambahkan `salesOrders` ke `DemoCoreSeed` dan insert di `seed-demo.ts` setelah `projects` (`provenance 'demo-fixture'`, `on conflict (id) do update`). Jalankan `cd backend && bun run seed:extract` lalu periksa diff `demo-core.json` (project/party/booking baru dari V2 ikut masuk).

- [ ] **Step 3: Tes gagal**

```ts
// backend/test/finance-group-trip.test.ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'
import seed from '../src/db/seeds/demo-core.json'

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const TODAY = todayBusinessDate()
const req = (method: string, as: string, path: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: who[as], body, headers: key ? { 'idempotency-key': key } : {} })
const get = (as: string, path: string) => req('GET', as, path)
const confirm = (as: string, id: string, body: unknown, key = `gt-${++keySeq}`) => req('POST', as, `/finance/sales-orders/${id}/confirm-dp`, body, key)

const [order, other] = (seed as any).salesOrders as { id: string; projectId: string; partyId: string; priceMinor: string }[]
let bank: string

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  bank = (await req('POST', 'finance', '/finance/accounts', { code: 'BCA-OPS', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '0123456789' })).json.data.id
  await req('POST', 'finance', `/finance/accounts/${bank}/opening`, { amountMinor: '0', openingDate: TODAY })
  await req('POST', 'superAdmin', `/finance/accounts/${bank}/opening/verify`, { balanceMinor: '0', openingDate: TODAY })
})
afterAll(() => t.cleanup())

const minDp = (price: string) => ((BigInt(price) * 30n + 99n) / 100n).toString()

describe('group trip DP per participant', () => {
  test('below 30% and above the price are rejected', async () => {
    const below = (BigInt(minDp(order!.priceMinor)) - 1n).toString()
    expect((await confirm('finance', order!.id, { bankAccountId: bank, dpAmountMinor: below, effectiveDate: TODAY, dueDate: TODAY })).status).toBe(422)
    const above = (BigInt(order!.priceMinor) + 1n).toString()
    expect((await confirm('finance', order!.id, { bankAccountId: bank, dpAmountMinor: above, effectiveDate: TODAY, dueDate: TODAY })).status).toBe(422)
  })

  test('admin cannot confirm; sees status only', async () => {
    expect((await confirm('admin', order!.id, { bankAccountId: bank, dpAmountMinor: minDp(order!.priceMinor), effectiveDate: TODAY, dueDate: TODAY })).status).toBe(403)
    const s = await get('admin', `/sales-orders/${order!.id}/finance-summary`)
    expect(s.json.data.view).toBe('status')
    expect(JSON.stringify(s.json.data)).not.toMatch(/Minor/)
  })

  test('minimum DP: invoice for the full price to the participant, receipt allocated, outstanding = price − DP', async () => {
    const dp = minDp(order!.priceMinor)
    const r = await confirm('finance', order!.id, { bankAccountId: bank, dpAmountMinor: dp, effectiveDate: TODAY, dueDate: TODAY }, 'gt-fixed')
    expect(r.status).toBe(201)
    expect(r.json.data.outstandingMinor).toBe((BigInt(order!.priceMinor) - BigInt(dp)).toString())
    const inv = await get('finance', `/finance/customer-invoices/${r.json.data.invoiceId}`)
    expect(inv.json.data).toMatchObject({ status: 'issued', invoiceType: 'dp', totalMinor: order!.priceMinor, party: { id: order!.partyId }, project: { id: order!.projectId } })
    const s = await get('finance', `/sales-orders/${order!.id}/finance-summary`)
    expect(s.json.data).toMatchObject({ view: 'full', receivedMinor: dp, outstandingMinor: r.json.data.outstandingMinor })
  })

  test('same idempotency key replays; a second confirm on the same order is rejected', async () => {
    const dp = minDp(order!.priceMinor)
    const replay = await confirm('finance', order!.id, { bankAccountId: bank, dpAmountMinor: dp, effectiveDate: TODAY, dueDate: TODAY }, 'gt-fixed')
    expect(replay.status).toBe(201)
    expect(replay.headers.get('idempotent-replayed')).toBe('true')
    expect((await confirm('finance', order!.id, { bankAccountId: bank, dpAmountMinor: dp, effectiveDate: TODAY, dueDate: TODAY })).status).toBe(422)
    const statement = await get('finance', `/finance/statement?projectId=${order!.projectId}&kind=customer_receipt`)
    expect(statement.json.data.filter((m: any) => m.party?.id === order!.partyId)).toHaveLength(1)
  })

  test('full price as DP settles the invoice', async () => {
    const r = await confirm('superAdmin', other!.id, { bankAccountId: bank, dpAmountMinor: other!.priceMinor, effectiveDate: TODAY, dueDate: TODAY })
    expect(r.status).toBe(201)
    expect(r.json.data.outstandingMinor).toBe('0')
  })
})
```

Sesuaikan: bentuk response `t.call` (`headers`), bentuk item statement (`party.id`), dan kebutuhan `resolveJsonModule` (bila impor JSON tidak diizinkan, baca dengan `JSON.parse(readFileSync(...))`). Pastikan `salesOrders[0]` dan `[1]` milik project yang `assertBillable` (status bukan cancelled/draft) — bila tidak, pilih dua order yang sesuai dengan filter di tes.

- [ ] **Step 4: Jalankan** — `bun test test/finance-group-trip.test.ts` → FAIL (route belum ada).

- [ ] **Step 5: Implementasi `receivables.ts`**
  - `InvoiceDraftInput` tambah `salesOrderId?: string`. Di `createInvoiceDraft`: bila ada, `select * from sales_order_refs where id = $1`; project = `so.project_id`; `party_id = so.party_id`; simpan `sales_order_id`. Tangkap unique violation `customer_invoices_one_per_sales_order` → 422 "Sales order ini sudah punya invoice.".
  - `postReceipt`: ganti cek pihak project menjadi:

```ts
if (refs.projectId) {
  const [ok] = await tx.query(
    `select 1 from projects where id = $1 and party_id = $2
     union all select 1 from sales_order_refs where project_id = $1 and party_id = $2 limit 1`,
    [refs.projectId, input.partyId]
  )
  if (!ok) throw errors.validation({ projectId: ['Project ini milik customer lain.'] })
}
```

- [ ] **Step 6: Implementasi `group-trip.ts`**

```ts
import type { Db, Queryable } from '../../db/client'
import { errors, AppError } from '../../http/errors'
import type { Actor } from './common'
import { ID_PATTERN, parseMovementAmount } from './common'
import { createInvoiceDraft, issueInvoice, postReceipt, invoiceOutstandingPublic } from './receivables'

export const MINIMUM_DP_PERCENT = 30n

async function lockSalesOrder (tx: Queryable, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Sales order')
  const [so] = await tx.query<{ id: string; project_id: string; party_id: string; price_minor: string }>(
    'select id, project_id, party_id, price_minor from sales_order_refs where id = $1 for update', [id])
  if (!so) throw errors.notFound('Sales order')
  return so
}

export async function confirmGroupTripDp (tx: Queryable, actor: Actor, id: string,
  input: { bankAccountId: string; dpAmountMinor: string; effectiveDate: string; dueDate: string }, requestId: string) {
  const so = await lockSalesOrder(tx, id)
  const price = BigInt(so.price_minor)
  const dp = parseMovementAmount(input.dpAmountMinor, 'dpAmountMinor')
  const minimum = (price * MINIMUM_DP_PERCENT + 99n) / 100n
  if (dp < minimum) throw errors.validation({ dpAmountMinor: [`DP minimal ${minimum} (30% dari harga ${price}).`] })
  if (dp > price) throw errors.validation({ dpAmountMinor: [`DP melebihi harga booking (${price}).`] })
  const [existing] = await tx.query("select id from customer_invoices where sales_order_id = $1 and status <> 'void'", [so.id])
  if (existing) throw new AppError(422, 'RULE_VIOLATION', 'DP sales order ini sudah dikonfirmasi.')

  const draft = await createInvoiceDraft(tx, actor, {
    salesOrderId: so.id, invoiceType: 'dp', dueDate: input.dueDate,
    lines: [{ description: `Booking Group Trip ${so.id}`, amountMinor: price.toString() }]
  }, requestId)
  const issued = await issueInvoice(tx, actor, draft.id, { issueDate: input.effectiveDate, dueDate: input.dueDate }, requestId)
  const receipt = await postReceipt(tx, actor, {
    bankAccountId: input.bankAccountId, amountMinor: dp.toString(), effectiveDate: input.effectiveDate,
    partyId: so.party_id, projectId: so.project_id, reference: so.id,
    allocations: [{ invoiceId: draft.id, amountMinor: dp.toString() }]
  }, requestId)
  return {
    invoiceId: draft.id, invoiceNumber: issued.number, transactionId: receipt.transactionId,
    outstandingMinor: receipt.allocations[0]!.outstandingMinor, minimumDpMinor: minimum.toString()
  }
}

export async function salesOrderFinanceSummary (db: Db, id: string, full: boolean) {
  const so = await lockSalesOrder(db, id)
  const [inv] = await db.query<{ id: string; total_minor: string }>(
    "select id, total_minor from customer_invoices where sales_order_id = $1 and status = 'issued'", [so.id])
  const outstanding = inv ? await invoiceOutstandingPublic(db, inv.id) : BigInt(so.price_minor)
  const received = inv ? BigInt(inv.total_minor) - outstanding : 0n
  const paymentStatus = !inv ? 'not_invoiced' : outstanding === 0n ? 'paid' : received > 0n ? 'dp_received' : 'invoiced'
  const label = { not_invoiced: 'Menunggu DP', invoiced: 'Belum dibayar', dp_received: 'DP diterima', paid: 'Lunas' }[paymentStatus]
  if (!full) return { view: 'status' as const, salesOrderId: so.id, paymentStatus, label }
  return {
    view: 'full' as const, salesOrderId: so.id, priceMinor: so.price_minor, invoicedMinor: inv?.total_minor ?? '0',
    receivedMinor: received.toString(), outstandingMinor: outstanding.toString(), invoiceId: inv?.id ?? null, paymentStatus, label
  }
}
```

`lockSalesOrder` memakai `for update`; untuk `salesOrderFinanceSummary` buat varian tanpa `for update` (`readSalesOrder`). `invoiceOutstandingPublic` = ekspor tipis dari `invoiceOutstanding` yang sudah ada di `receivables.ts`. Cek nama tipe/impor asli (`Actor`, `ID_PATTERN`, `AppError`) dan sesuaikan path.

- [ ] **Step 7: Route** di `routes-ar-ap.ts`, mengikuti pola `idempotent(...)` dan `summaryAccess(...)` yang ada:

```ts
.post('/finance/sales-orders/:id/confirm-dp', async ({ request, params, body, set }) => {
  const actor = await auth.requireActor(request)
  if (!hasCapability(actor.role, 'finance.post-cash') || !hasCapability(actor.role, 'finance.manage-receivables')) throw errors.forbidden()
  assertIdParam(params.id)
  set.status = 201
  return idempotent(request, set, actor, 'finance.sales-order.confirm-dp', { id: params.id, ...body },
    tx => confirmGroupTripDp(tx, actor, params.id, body, requestIdOf(request)))
}, { body: t.Object({ bankAccountId: t.String(), dpAmountMinor: t.String(), effectiveDate: t.String(), dueDate: t.String() }) })
.get('/sales-orders/:id/finance-summary', async ({ request, params }) => {
  const { full } = await summaryAccess(request)
  assertIdParam(params.id)
  return ok(request, await salesOrderFinanceSummary(db, params.id, full))
})
```

Cek urutan "tolak dulu sebelum validasi body" (commit `d33bce3`): bila route lain memakai pola khusus agar 403 keluar sebelum 422, ikuti pola itu dan daftarkan route di `backend/src/modules/finance/access.ts` bila perlu.

- [ ] **Step 8: Tes lulus** — `bun test test/finance-group-trip.test.ts` → PASS; `bun test` (semua) & `bun run typecheck` hijau; `bun run db:rehearse` tidak diperlukan, tapi `migrateDown` test (bila ada di `db.test.ts`) harus lulus untuk 0014.

- [ ] **Step 9: Commit**

```bash
git add backend
git commit -m "feat(finance): group trip DP per participant — sales order refs, confirm DP, summary"
```

---

### Task 10: UI Group Trip — Bookings/Payments dari server

**Files:**
- Create: `frontend/app/lib/finance/group-trip.ts` (+test), `frontend/app/components/finance/FinanceGroupTripDpDialog.vue`
- Modify: `frontend/app/lib/api/endpoints.ts`, `frontend/app/types/api.ts`, `frontend/app/pages/project-orders/[id]/index.vue` (tab Bookings/Payments/Reservations), `frontend/app/data/index.ts`

**Interfaces:**
- Consumes: Task 9 endpoints.
- Produces: `api.finance.confirmGroupTripDp(id, body, key)`, `api.finance.salesOrderSummary(id)`; tipe `SalesOrderFinanceSummaryDto`; fungsi lokal `markGroupTripOrderPaid(orderId: string): SalesOrder | undefined` di `data/index.ts` (hanya status → `paid` + buat traveler; **tanpa** invoice/payment mock); `groupTripOrderFigures(summary: SalesOrderFinanceSummaryDto | null)`.

- [ ] **Step 1: Tes gagal** (`frontend/app/lib/finance/group-trip.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import { groupTripOrderFigures } from './group-trip'

describe('groupTripOrderFigures', () => {
  it('missing summary is unavailable', () => { expect(groupTripOrderFigures(null)).toEqual({ kind: 'unavailable' }) })
  it('status view has no amounts', () => {
    expect(groupTripOrderFigures({ view: 'status', salesOrderId: 'SLO-6', paymentStatus: 'dp_received', label: 'DP diterima' } as any))
      .toEqual({ kind: 'status', label: 'DP diterima', canConfirm: false })
  })
  it('full view: not invoiced can be confirmed; paid cannot', () => {
    expect(groupTripOrderFigures({ view: 'full', salesOrderId: 'SLO-6', priceMinor: '1000', invoicedMinor: '0', receivedMinor: '0', outstandingMinor: '1000', invoiceId: null, paymentStatus: 'not_invoiced', label: 'Menunggu DP' } as any))
      .toMatchObject({ kind: 'full', canConfirm: true, outstandingMinor: '1000' })
    expect(groupTripOrderFigures({ view: 'full', salesOrderId: 'SLO-6', priceMinor: '1000', invoicedMinor: '1000', receivedMinor: '1000', outstandingMinor: '0', invoiceId: 'CINV-1', paymentStatus: 'paid', label: 'Lunas' } as any))
      .toMatchObject({ kind: 'full', canConfirm: false })
  })
})
```

- [ ] **Step 2: Jalankan** — FAIL.

- [ ] **Step 3: Implementasi**

```ts
// frontend/app/lib/finance/group-trip.ts
import type { SalesOrderFinanceSummaryDto } from '~/types/api'

export type GroupTripOrderFigures =
  | { kind: 'unavailable' }
  | { kind: 'status'; label: string; canConfirm: false }
  | { kind: 'full'; label: string; priceMinor: string; receivedMinor: string; outstandingMinor: string; canConfirm: boolean }

export function groupTripOrderFigures (s: SalesOrderFinanceSummaryDto | null): GroupTripOrderFigures {
  if (!s) { return { kind: 'unavailable' } }
  if (s.view === 'status') { return { kind: 'status', label: s.label, canConfirm: false } }
  return { kind: 'full', label: s.label, priceMinor: s.priceMinor, receivedMinor: s.receivedMinor, outstandingMinor: s.outstandingMinor, canConfirm: s.paymentStatus === 'not_invoiced' }
}
```

- [ ] **Step 4: Dialog & tab**
  - `FinanceGroupTripDpDialog.vue` (pola `FinanceReceiptDialog`): rekening, nominal DP (hint minimal 30% = `ceil(price*0.3)`), tanggal terima, jatuh tempo pelunasan; `newIdempotencyKey()` per buka dialog; sukses → `markGroupTripOrderPaid(order.id)` lalu toast "DP dicatat. Sisa {outstanding}."
  - Tab Bookings (Awaiting DP / Confirmed) dan Payments: kolom nominal dari `salesOrderSummary` (Finance/Super Admin), label saja untuk Admin. Tombol "Konfirmasi DP" hanya bila `session.can('finance.post-cash')` dan `canConfirm`.
  - Isi tab Reservations/Payments yang kosong di V2 (lihat audit) dengan daftar sales order + figures di atas.
  - `data/index.ts`: tambah `markGroupTripOrderPaid`; hapus `confirmGroupTripDp` mock dan `getSalesOrderOutstandingIdr`.
- [ ] **Step 5: Verifikasi & commit**

```bash
cd frontend && pnpm vitest run app/lib/finance/group-trip.test.ts && pnpm typecheck && pnpm test && pnpm lint
git add frontend/app
git commit -m "feat(group-trip): bookings and payments tabs confirm DP on the server"
```

---

## Phase C — Debit Note (server)

### Task 11: Debit note di server

Desain: debit note = **invoice tambahan** (`invoice_type = 'debit_note'`) yang menunjuk invoice asal (`adjusts_invoice_id`), pihak/project/booking/sales order sama dengan invoice asal, langsung terbit dengan nomor `DN-YYYY-#####`. Karena berupa invoice, piutang, aging, cash flow, pendapatan, alokasi penerimaan, dan void otomatis ikut tanpa mengubah rumus outstanding.

**Files:**
- Create: `backend/migrations/0015_finance_debit_notes.up.sql`, `.down.sql`, `backend/src/modules/finance/debit-notes.ts`, `backend/test/finance-debit-notes.test.ts`
- Modify: `backend/src/modules/finance/receivables.ts` (`requireInvoiceType` menolak `debit_note` untuk draft biasa; DTO menyertakan `adjustsInvoiceId`), `routes-ar-ap.ts`

**Interfaces:**
- Produces: `POST /api/v1/finance/customer-invoices/:id/debit-notes` (capability `finance.manage-receivables`) body `{ amountMinor, reason, dueDate }` → `CustomerInvoiceDetailDto` debit note. DTO invoice: `invoiceType` bisa `'debit_note'`, field baru `adjustsInvoiceId: string | null`.

- [ ] **Step 1: Migrasi**

```sql
-- 0015_finance_debit_notes.up.sql
alter table customer_invoices drop constraint customer_invoices_invoice_type_check;
alter table customer_invoices add constraint customer_invoices_invoice_type_check
  check (invoice_type in ('dp', 'progress', 'final', 'other', 'debit_note'));
alter table customer_invoices add column adjusts_invoice_id text references customer_invoices (id);
alter table customer_invoices add constraint customer_invoices_debit_note_origin
  check ((invoice_type = 'debit_note') = (adjusts_invoice_id is not null));
create sequence finance_debit_note_number_seq;
```

```sql
-- 0015_finance_debit_notes.down.sql
delete from customer_invoice_lines where invoice_id in (select id from customer_invoices where invoice_type = 'debit_note');
delete from customer_invoices where invoice_type = 'debit_note';
drop sequence if exists finance_debit_note_number_seq;
alter table customer_invoices drop constraint if exists customer_invoices_debit_note_origin;
alter table customer_invoices drop column if exists adjusts_invoice_id;
alter table customer_invoices drop constraint customer_invoices_invoice_type_check;
alter table customer_invoices add constraint customer_invoices_invoice_type_check check (invoice_type in ('dp', 'progress', 'final', 'other'));
```

Cek nama constraint asli: `psql`/PGlite `\d customer_invoices` atau cari di `0008_*.up.sql`; bila CHECK tanpa nama, nama default Postgres adalah `customer_invoices_invoice_type_check`. Cek juga nama kolom FK baris (`invoice_id` vs `customer_invoice_id`) di `customer_invoice_lines`.

- [ ] **Step 2: Tes gagal** (`backend/test/finance-debit-notes.test.ts`, setup seperti `finance-arap.test.ts`: login finance/superAdmin/admin, rekening BCA-OPS terverifikasi)

```ts
describe('debit notes', () => {
  let origin: string
  test('setup: an issued invoice on PRJ-201', async () => {
    const d = await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: '1000000' }], dueDate: TODAY })
    origin = d.json.data.id
    expect((await post('finance', `/finance/customer-invoices/${origin}/issue`, {})).status).toBe(200)
  })

  test('issues a DN numbered debit note for the same customer; receivable grows by the amount', async () => {
    const before = (await get('finance', '/projects/PRJ-201/finance-summary')).json.data.receivable.outstandingMinor
    const r = await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '250000', reason: 'Tambahan kamar', dueDate: TODAY })
    expect(r.status).toBe(201)
    expect(r.json.data).toMatchObject({ invoiceType: 'debit_note', adjustsInvoiceId: origin, status: 'issued', totalMinor: '250000', party: { id: 'PTY-005' } })
    expect(r.json.data.number).toMatch(/^DN-\d{4}-\d{5}$/)
    const after = (await get('finance', '/projects/PRJ-201/finance-summary')).json.data.receivable.outstandingMinor
    expect(BigInt(after) - BigInt(before)).toBe(250000n)
  })

  test('rejects draft/void origin, short reason, and admin', async () => {
    const draft = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: 'other', lines: [{ description: 'x', amountMinor: '1' }] })).json.data.id
    expect((await post('finance', `/finance/customer-invoices/${draft}/debit-notes`, { amountMinor: '1', reason: 'Tambahan', dueDate: TODAY })).status).toBe(422)
    const toVoid = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: 'other', lines: [{ description: 'y', amountMinor: '1' }], dueDate: TODAY })).json.data.id
    await post('finance', `/finance/customer-invoices/${toVoid}/issue`, {})
    await post('finance', `/finance/customer-invoices/${toVoid}/void`, { reason: 'Salah input' })
    expect((await post('finance', `/finance/customer-invoices/${toVoid}/debit-notes`, { amountMinor: '1', reason: 'Tambahan', dueDate: TODAY })).status).toBe(422)
    expect((await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '1', reason: 'ab', dueDate: TODAY })).status).toBe(422)
    expect((await post('admin', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '1', reason: 'Tambahan', dueDate: TODAY })).status).toBe(403)
  })

  test('a normal draft cannot be created with type debit_note', async () => {
    expect((await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: 'debit_note', lines: [{ description: 'x', amountMinor: '1' }] })).status).toBe(422)
  })

  test('cannot void a paid debit note', async () => {
    const dn = (await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '1000', reason: 'Biaya admin', dueDate: TODAY })).json.data.id
    await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, partyId: 'PTY-005', projectId: 'PRJ-201', allocations: [{ invoiceId: dn, amountMinor: '1000' }] })
    expect((await post('finance', `/finance/customer-invoices/${dn}/void`, { reason: 'Salah input' })).status).toBe(422)
  })
})
```

Verifikasi dulu bahwa `voidInvoice` yang ada memang menolak invoice yang sudah punya alokasi; bila tidak, tes terakhir menemukan bug nyata — perbaiki di `voidInvoice` (tolak bila `exists (select 1 from payment_allocations where target_type='customer_invoice' and target_id=$1)`).

- [ ] **Step 3: Jalankan** — `bun test test/finance-debit-notes.test.ts` → FAIL.

- [ ] **Step 4: Implementasi `debit-notes.ts`**

```ts
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { parseMovementAmount, requireDate, todayBusinessDate, validateReason, type Actor } from './common'
import { lockInvoiceForUpdate } from './receivables'

export async function issueDebitNote (tx: Queryable, actor: Actor, originId: string,
  input: { amountMinor: string; reason: string; dueDate: string }, requestId: string) {
  const origin = await lockInvoiceForUpdate(tx, originId)
  if (origin.status !== 'issued') throw new AppError(422, 'RULE_VIOLATION', 'Debit note hanya untuk invoice yang sudah terbit.')
  if (origin.invoice_type === 'debit_note') throw new AppError(422, 'RULE_VIOLATION', 'Debit note dibuat dari invoice asal, bukan dari debit note.')
  const amount = parseMovementAmount(input.amountMinor)
  const reason = validateReason(input.reason)
  const issueDate = todayBusinessDate()
  const dueDate = requireDate(input.dueDate, 'dueDate')
  if (dueDate < issueDate) throw errors.validation({ dueDate: ['Jatuh tempo tidak boleh sebelum hari ini.'] })
  const [num] = await tx.query<{ number: string }>(
    `select 'DN-' || to_char($1::date, 'YYYY') || '-' || lpad(nextval('finance_debit_note_number_seq')::text, 5, '0') as number`, [issueDate])
  const [ctx] = await tx.query<{ project_name: string; party_name: string }>(
    'select p.name as project_name, pa.name as party_name from projects p join parties pa on pa.id = $2 where p.id = $1',
    [origin.project_id, origin.party_id])
  const [row] = await tx.query<{ id: string }>(
    `insert into customer_invoices (project_id, party_id, booking_type, booking_id, sales_order_id, invoice_type, adjusts_invoice_id,
       status, number, total_minor, issue_date, due_date, issued_by, issued_at, billing_snapshot, notes, created_by)
     values ($1, $2, $3, $4, $5, 'debit_note', $6, 'issued', $7, $8, $9, $10, $11, now(), $12::text::jsonb, $13, $11) returning id`,
    [origin.project_id, origin.party_id, origin.booking_type, origin.booking_id, origin.sales_order_id ?? null, origin.id,
      num!.number, amount.toString(), issueDate, dueDate, actor.userId,
      JSON.stringify({ partyName: ctx!.party_name, projectName: ctx!.project_name, adjusts: origin.number }), reason])
  await tx.query('insert into customer_invoice_lines (invoice_id, position, description, amount_minor) values ($1, 1, $2, $3)',
    [row!.id, reason, amount.toString()])
  await recordAudit(tx, {
    action: 'finance.debit_note_issued', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: row!.id, requestId, reason,
    after: { adjustsInvoiceId: origin.id, number: num!.number, amountMinor: amount.toString() }
  })
  return { id: row!.id }
}
```

Penyesuaian wajib sebelum menjalankan: ekspor `lockInvoice` dari `receivables.ts` sebagai `lockInvoiceForUpdate`; cocokkan nama kolom `customer_invoice_lines` dan path `recordAudit`/`validateReason`/`requireDate` dengan impor asli di `receivables.ts`. `requireInvoiceType` di `receivables.ts`: tolak `'debit_note'` ("Debit note dibuat dari menu invoice asal."). `invoiceRowDto`: tambah `adjustsInvoiceId: r.adjusts_invoice_id ?? null`.

- [ ] **Step 5: Route**

```ts
.post('/finance/customer-invoices/:id/debit-notes', async ({ request, params, body, set }) => {
  const actor = await auth.requireActor(request)
  if (!hasCapability(actor.role, 'finance.manage-receivables')) throw errors.forbidden()
  assertIdParam(params.id)
  const { id } = await inTx(tx => issueDebitNote(tx, actor, params.id, body, requestIdOf(request)))
  set.status = 201
  return ok(request, await getInvoice(db, id))
}, { body: t.Object({ amountMinor: t.String(), reason: t.String(), dueDate: t.String() }) })
```

- [ ] **Step 6: Tes lulus & full suite** — `bun test` dan `bun run typecheck` hijau (tes lama yang memeriksa daftar `invoiceType` mungkin perlu ditambah `debit_note`).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(finance): debit notes as DN-numbered supplementary invoices"
```

---

### Task 11b: UI Debit Note

**Files:**
- Create: `frontend/app/components/finance/FinanceDebitNoteDialog.vue`
- Modify: `frontend/app/types/api.ts` (`ApiInvoiceType` + `'debit_note'`, `adjustsInvoiceId`), `frontend/app/lib/finance/labels.ts` (`INVOICE_TYPE_LABEL.debit_note = 'Debit note'`), `frontend/app/lib/api/endpoints.ts` (`issueDebitNote(id, body)`), `FinanceInvoiceSheet.vue` (tombol "Buat debit note" untuk invoice `issued` non-debit-note bila `session.can('finance.manage-receivables')`), tab Finance Project Detail (bagian "Credit / Debit Notes" kembali tampil: credit note dari detail invoice, debit note = invoice `invoiceType === 'debit_note'`), `frontend/app/lib/finance/finance.test.ts` (label).

- [ ] **Step 1: Tes gagal** — di `frontend/app/lib/finance/finance.test.ts` (atau test label yang ada): `expect(INVOICE_TYPE_LABEL.debit_note).toBe('Debit note')` dan setiap `ApiInvoiceType` punya label (iterasi daftar tipe).
- [ ] **Step 2: Jalankan** — FAIL.
- [ ] **Step 3: Implementasi** sesuai Files di atas. Dialog: nominal, alasan (min 5 karakter, sama seperti credit note), jatuh tempo; sukses → toast "Debit note {number} terbit" + refresh ringkasan project.
- [ ] **Step 4: Lulus & verifikasi** — `pnpm typecheck && pnpm test && pnpm lint`.
- [ ] **Step 5: Commit** — `git commit -am "feat(finance-ui): debit notes from the invoice panel and project finance tab"`

---

## Phase D — Bersihkan mock dan verifikasi

### Task 12: Hapus keuangan mock V2 + tes penjaga

**Files:**
- Create: `frontend/app/no-mock-finance.test.ts`
- Modify/Delete: `frontend/app/data/finance-ext.ts`, `frontend/app/data/finance.ts`, `frontend/app/data/index.ts`, `frontend/app/components/dashboard/{DashboardHeroPanel,DashboardCashFlowSection,MonthlyCashFlowChart}.vue` (hapus bila tak dipakai lagi), `frontend/app/composables/useCountUp.ts`, `frontend/app/utils/sparkline.ts` (hapus bila tak dipakai), `frontend/app/plugins/mock-reset.client.ts`

**Interfaces:**
- Produces: tidak ada fungsi keuangan mock yang bisa diimpor oleh halaman.

- [ ] **Step 1: Tes penjaga (gagal dulu)**

```ts
// frontend/app/no-mock-finance.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Money now lives on the server. These mock finance helpers must never come back into the app. */
const FORBIDDEN = [
  'getInvoicesByProject', 'getPaymentsByInvoice', 'getProjectOutstandingIdr', 'getProjectCollectedIdr', 'getInvoiceOutstandingIdr',
  'getInvoiceMilestoneOutstandingIdr', 'getInvoiceMilestoneStatus', 'recordPayment', 'createInvoice(',
  'getCreditNotesByProject', 'getDebitNotesByProject', 'getSupplierInvoicesByProject', 'getSupplierInvoicesByServiceOrder',
  'evaluateFinanceClosureGate', 'closeProjectFinance', 'recordVendorPaymentDirect', 'paySupplierInvoice',
  'getProjectActualCostIdr', 'getProjectExpenses', 'createProjectExpense', 'getServiceTypeSpendBreakdown',
  'getRevenueByPeriod', 'getOpexTotalIdr', 'getOpexPeriods', 'OPEX_ENTRIES', 'getPayables(',
  'getSalesOrderOutstandingIdr', 'getClientFinanceSummary', 'getClientInvoices'
]
const ROOTS = ['pages', 'components', 'composables', 'layouts']

function files (dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { return files(p) }
    return /\.(vue|ts)$/.test(name) && !name.endsWith('.test.ts') ? [p] : []
  })
}

describe('no mock finance in the app', () => {
  const appDir = join(__dirname)
  for (const root of ROOTS) {
    for (const file of files(join(appDir, root))) {
      it(file.replace(appDir, ''), () => {
        const src = readFileSync(file, 'utf8')
        const hits = FORBIDDEN.filter(name => src.includes(name))
        expect(hits).toEqual([])
      })
    }
  }
})
```

- [ ] **Step 2: Jalankan** — `pnpm vitest run app/no-mock-finance.test.ts`. Expected: FAIL bila masih ada sisa (termasuk portal client yang tersembunyi: `pages/client/billing/**`). Untuk setiap hit: ganti ke server atau, untuk halaman portal client yang disembunyikan (ADR-006), tampilkan `EmptyState` "Tagihan tersedia setelah portal klien diaktifkan" dan hapus pemakaian mock.

- [ ] **Step 3: Hapus fungsi mock** dari `data/index.ts`, `data/finance.ts`, `data/finance-ext.ts` (dan seed array `INVOICES`, `PAYMENTS`, `CREDIT_NOTES`, `DEBIT_NOTES`, `SUPPLIER_INVOICES`, `OPEX_ENTRIES`, `PROJECT_EXPENSES` bila tidak dipakai lagi). Hapus pendaftaran mereka di `plugins/mock-reset.client.ts`. Hapus komponen dashboard lama yang tidak lagi diimpor.

```bash
cd frontend && grep -rn -E "from '~/data/finance(-ext)?'" app | grep -v test
```

Expected setelah selesai: hanya impor konstanta label non-uang (bila ada) atau tidak ada sama sekali.

- [ ] **Step 4: Lulus** — `pnpm vitest run app/no-mock-finance.test.ts && pnpm typecheck && pnpm test && pnpm lint && pnpm build`.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/app
git commit -m "chore(finance): remove V2 mock finance; guard test keeps it out"
```

---

### Task 13: Seed ulang, verifikasi end-to-end, dokumentasi

**Files:**
- Modify: `docs/manova-finance-implementation/finance-consumer-matrix.md` (consumer baru: Project Detail V2, Dashboard V2, Group Trip, Debit Note), `CLAUDE.md` root (tidak berubah kecuali perintah baru).

- [ ] **Step 1: Reset data demo lokal** (matikan `npm run dev` dulu — PGlite tidak boleh dibuka dua proses)

```bash
mv backend/.data/pglite backend/.data/pglite-before-v2-ui-$(date +%Y%m%d)
npm run db:migrate && npm run db:seed:demo && npm run db:seed:finance-demo
npm run dev
```

- [ ] **Step 2: Suite penuh**

```bash
npm run typecheck && npm run test && npm run lint && npm run typecheck:backend && npm run test:backend
TEST_DATABASE_URL=postgres://… npm run test:backend   # bila PostgreSQL 17 lokal tersedia
cd frontend && pnpm build
```

- [ ] **Step 3: Cek browser** (Chrome, 1440 px, 768 px, 390 px) — catat hasil di `docs/uat/2026-10-xx-v2-ui-monorepo.txt`:
  - Finance: PRJ-201 Project Detail — hero, tab Finance, Pengeluaran (catat 1 pengeluaran), Vendors (bayar 1 invoice vendor), debit note dari invoice; angka = menu Finance.
  - Finance: Group Trip (PRJ-501/502) — konfirmasi DP 30% satu peserta, double-click tombol simpan → satu invoice; tab Bookings/Payments menampilkan sisa.
  - Admin (Doni): Project Detail & Dashboard tanpa nominal; tidak ada tombol catat pengeluaran/konfirmasi DP/debit note; menu Operasional V2 tampil; `/finance` ditolak.
  - Super Admin: semua tampil, bisa catat pengeluaran.
  - Dashboard: filter Bulan ini/Tahun ini/Custom mengubah Pemasukan/Profit; angka "Bulan ini" = Finance → Ringkasan.
  - Matikan backend → halaman operasional V2 tetap jalan, kartu keuangan "Data keuangan belum tersedia".

- [ ] **Step 4: Commit & laporan**

```bash
git add docs
git commit -m "docs: V2 UI on monorepo — consumer matrix and UAT notes"
```

Setelah user menyetujui hasil browser: merge `feat/v2-ui-on-monorepo` → `monorepo` (`git switch monorepo && git merge --no-ff feat/v2-ui-on-monorepo`). Push hanya atas permintaan user.
