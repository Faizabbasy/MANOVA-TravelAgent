<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { Receipt, Wallet, AlertTriangle, FileStack, GitCompareArrows, HandCoins, ArrowDownToLine, ShieldAlert, FileText, CreditCard, ChevronRight } from 'lucide-vue-next'
import {
  getOutstandingInvoices, INVOICES, PAYMENTS, PROJECTS,
  getSupplierInvoiceReconciliationQueue, evaluateFinanceClosureGate,
  getInvoicesByProject, getInvoiceOutstandingIdr, getSupplierInvoicesByProject,
  getRefundRequestsByProject, getCreditNotesByProject, getDebitNotesByProject, getServiceOrderById
} from '~/data'
import { getPayables } from '~/data/finance-ext'
import { isInvoiceOverdue, DEMO_REFERENCE_DATE } from '~/utils/attention'
import { formatCurrencyIdr, formatNumber } from '~/utils/format'
import type { BadgeTone } from '~/types/common'

/**
 * Finance overview (Section 15 lama — shell; Section 20 — D-077, menambah link Notes/Reconciliation dan
 * agregat "Financial Closure Readiness" lintas-project berdasarkan `evaluateFinanceClosureGate`).
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Finance' })

const { canView, canViewFinancials } = usePermissions()

const outstanding = computed(() => getOutstandingInvoices())
const outstandingTotal = computed(() => outstanding.value.reduce((sum, invoice) => sum + invoice.amountIdr, 0))
const overdueCount = computed(() => INVOICES.filter(invoice => isInvoiceOverdue(invoice)).length)
const reconciliationQueueCount = computed(() => getSupplierInvoiceReconciliationQueue().length)

/** Financial closure readiness (Section 20, Wajib) — agregat lintas-project, hanya project yang belum `financeSettled`.
 * Kolom Invoice/Payment/AR-AP/Notes semuanya angka nyata (bukan karangan) — direbuild dari fungsi yang sama
 * yang dipakai `evaluateFinanceClosureGate` (outstanding invoice, unmatched Supplier Invoice, Refund Request
 * belum selesai) plus Credit/Debit Notes project itu, supaya konsisten satu sumber data dengan gate-nya sendiri. */
const closureReadiness = computed(() => PROJECTS
  .filter(project => !project.closureChecklist?.financeSettled)
  .map(project => {
    const gate = evaluateFinanceClosureGate(project.id)
    const invoices = getInvoicesByProject(project.id)
    const outstandingInvoiceCount = invoices.filter(invoice => getInvoiceOutstandingIdr(invoice.id) > 0).length
    const paidInvoiceCount = invoices.length - outstandingInvoiceCount
    const unmatchedSupplierInvoiceCount = getSupplierInvoicesByProject(project.id).filter(invoice => invoice.matchStatus && invoice.matchStatus !== 'matched').length
    const nonTerminalRefundCount = getRefundRequestsByProject(project.id).filter(request => request.status === 'requested' || request.status === 'under-review' || request.status === 'approved').length
    const notesCount = getCreditNotesByProject(project.id).length + getDebitNotesByProject(project.id).length
    const status: { label: string; tone: BadgeTone } = gate.ready
      ? { label: 'Siap Close', tone: 'success' }
      : paidInvoiceCount > 0
        ? { label: 'Proses', tone: 'warning' }
        : { label: 'Belum Close', tone: 'destructive' }
    return {
      project,
      gate,
      status,
      invoiceLabel: `${outstandingInvoiceCount}/${invoices.length}`,
      paymentLabel: `${paidInvoiceCount}/${invoices.length}`,
      arApCount: unmatchedSupplierInvoiceCount + nonTerminalRefundCount,
      notesCount
    }
  }))

/** Label relatif berbasis hari — `DEMO_REFERENCE_DATE` cuma presisi tanggal (bukan jam), jadi "X jam lalu" tidak bisa dihitung jujur dari data fixture ini. */
function daysAgoLabel (iso: string): string {
  const diffDays = Math.round((new Date(DEMO_REFERENCE_DATE).getTime() - new Date(iso).getTime()) / 86400000)
  if (diffDays <= 0) { return 'Hari ini' }
  if (diffDays === 1) { return 'Kemarin' }
  return `${diffDays} hari lalu`
}

interface ActivityItem { key: string; icon: Component; tone: BadgeTone; title: string; subtitle: string; meta: string }

/** "Aktivitas Terbaru" — 4 highlight nyata (bukan feed generik) diambil dari sumber yang sama dengan stat row di atas: invoice terbaru, payment terbaru, Supplier Invoice reconciliation paling lama menunggu, dan invoice AR paling overdue. */
const recentFinanceActivity = computed<ActivityItem[]>(() => {
  const items: ActivityItem[] = []

  const latestInvoice = [...INVOICES].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]
  if (latestInvoice) {
    items.push({
      key: 'invoice',
      icon: Receipt,
      tone: 'primary',
      title: `Invoice ${latestInvoice.id}`,
      subtitle: `${PROJECTS.find(p => p.id === latestInvoice.projectId)?.name ?? latestInvoice.projectId} · ${formatCurrencyIdr(latestInvoice.amountIdr)}`,
      meta: daysAgoLabel(latestInvoice.issuedAt)
    })
  }

  const latestPayment = [...PAYMENTS].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]
  if (latestPayment) {
    const parentInvoice = INVOICES.find(invoice => invoice.id === latestPayment.invoiceId)
    items.push({
      key: 'payment',
      icon: ArrowDownToLine,
      tone: 'success',
      title: 'Payment received',
      subtitle: `${PROJECTS.find(p => p.id === parentInvoice?.projectId)?.name ?? '—'} · ${formatCurrencyIdr(latestPayment.amountIdr)}`,
      meta: daysAgoLabel(latestPayment.receivedAt)
    })
  }

  const pendingReconciliation = getSupplierInvoiceReconciliationQueue()[0]
  if (pendingReconciliation) {
    const serviceOrder = getServiceOrderById(pendingReconciliation.serviceOrderId)
    const project = serviceOrder ? PROJECTS.find(p => p.id === serviceOrder.projectId) : undefined
    items.push({
      key: 'reconciliation',
      icon: GitCompareArrows,
      tone: 'purple',
      title: 'Reconciliation pending',
      subtitle: `${project?.name ?? '—'} · ${reconciliationQueueCount.value} menunggu ditriase`,
      meta: daysAgoLabel(pendingReconciliation.submittedAt)
    })
  }

  const mostOverdueInvoice = [...INVOICES].filter(invoice => isInvoiceOverdue(invoice)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
  if (mostOverdueInvoice) {
    items.push({
      key: 'ar-overdue',
      icon: AlertTriangle,
      tone: 'destructive',
      title: 'AR overdue',
      subtitle: `${PROJECTS.find(p => p.id === mostOverdueInvoice.projectId)?.name ?? '—'} · ${formatCurrencyIdr(getInvoiceOutstandingIdr(mostOverdueInvoice.id))}`,
      meta: daysAgoLabel(mostOverdueInvoice.dueAt)
    })
  }

  return items
})

/** Total Hutang (AP) — sisi payables, pelengkap "Total Outstanding" (AR) supaya stat row tidak cuma cerita piutang. */
const payablesTotal = computed(() => getPayables().reduce((sum, row) => sum + row.outstandingIdr, 0))
/** Uang yang benar-benar diterima bulan berjalan (bukan sekadar outstanding) — pola sama `getRevenueByPeriod().collectedIdr`. */
const currentPeriod = computed(() => DEMO_REFERENCE_DATE.slice(0, 7))
const collectedThisMonth = computed(() => PAYMENTS
  .filter(payment => payment.receivedAt.startsWith(currentPeriod.value))
  .reduce((sum, payment) => sum + payment.amountIdr, 0))
/** Jumlah project yang macet Close Finance-nya — angka ringkas dari `closureReadiness` yang sudah dihitung di atas. */
const closureBlockerCount = computed(() => closureReadiness.value.filter(row => !row.gate.ready).length)

/** Tint chip ikon kecil (Aktivitas Terbaru) — reuse token warna yang sudah ada di tempat lain (mis. tab Vendors Project Detail), bukan warna baru. */
const TONE_ICON_BG: Partial<Record<BadgeTone, string>> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  purple: 'bg-chart-4/10 text-chart-4'
}

type StatsCardTone = 'primary' | 'success' | 'warning' | 'destructive'
interface StatTile { key: string; label: string; value: string; icon: typeof Receipt; tone: StatsCardTone; to: string }

/** Stat tile — pakai `StatsCard` (komponen yang sama dipakai di seluruh dashboard/halaman lain), dibungkus
 * `NuxtLink` supaya tetap klik-able ke halaman terkait. Sebelumnya sempat dibikin varian custom (border kiri
 * berwarna) yang bikin halaman ini terlihat beda tema dari halaman lain — dikembalikan ke komponen standar. */
const statTilesRowOne = computed<StatTile[]>(() => [
  { key: 'invoice-outstanding', label: 'Invoice Outstanding', value: formatNumber(outstanding.value.length), icon: Receipt, tone: 'primary', to: '/finance/invoices' },
  ...(canViewFinancials.value
    ? [{ key: 'total-outstanding', label: 'Total Outstanding', value: formatCurrencyIdr(outstandingTotal.value), icon: Wallet, tone: 'success' as StatsCardTone, to: '/finance/invoices' }]
    : []),
  { key: 'invoice-overdue', label: 'Invoice Overdue', value: formatNumber(overdueCount.value), icon: AlertTriangle, tone: 'destructive', to: '/finance/invoices' },
  ...(canViewFinancials.value
    ? [{ key: 'total-hutang', label: 'Total Hutang (AP)', value: formatCurrencyIdr(payablesTotal.value), icon: HandCoins, tone: 'warning' as StatsCardTone, to: '/finance/payables#payables' }]
    : [])
])

const statTilesRowTwo = computed<StatTile[]>(() => [
  ...(canViewFinancials.value
    ? [{ key: 'collected-bulan-ini', label: 'Collected Bulan Ini', value: formatCurrencyIdr(collectedThisMonth.value), icon: ArrowDownToLine, tone: 'success' as StatsCardTone, to: '/finance/payments' }]
    : []),
  { key: 'reconciliation-pending', label: 'Reconciliation Pending', value: formatNumber(reconciliationQueueCount.value), icon: GitCompareArrows, tone: 'primary', to: '/finance/payments#reconciliation' },
  { key: 'closure-blocker', label: 'Financial Closure Blocker', value: formatNumber(closureBlockerCount.value), icon: ShieldAlert, tone: closureBlockerCount.value > 0 ? 'warning' : 'success', to: '#closure-readiness' }
])

/** Anatomi disamakan persis dengan `StatsCard` di atasnya (chip ikon bertone di kanan judul, p-4, border+shadow
 * yang sama) — TANPA baris "Buka X →" terpisah di bawah (itu yang bikin card ini terlihat beda/ada
 * "list" tambahan dibanding stat tile lain). Seluruh card sudah `NuxtLink`, jadi teks link terpisah redundan. */
const quickLinkTiles = computed<StatTile[]>(() => [
  { key: 'invoices', label: 'Invoices', value: 'Lihat seluruh invoice lintas-project', icon: FileText, tone: 'primary', to: '/finance/invoices' },
  { key: 'payments', label: 'Payments', value: 'Lihat seluruh payment lintas-project', icon: CreditCard, tone: 'success', to: '/finance/payments' },
  { key: 'notes', label: 'Credit/Debit Notes', value: 'Lihat seluruh Credit/Debit Note lintas-project', icon: FileStack, tone: 'warning', to: '/finance/invoices#notes' },
  { key: 'reconciliation', label: 'Reconciliation', value: `${reconciliationQueueCount.value} Supplier Invoice perlu ditriase`, icon: GitCompareArrows, tone: 'destructive', to: '/finance/payments#reconciliation' }
])
</script>

<template>
  <div class="space-y-4">
    <PageHeader
      title="Finance"
      description="Ringkasan invoice dan pembayaran lintas-project."
      :breadcrumb="[{ label: 'Finance' }]"
    />

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink v-for="tile in statTilesRowOne" :key="tile.key" :to="tile.to" class="block">
          <StatsCard :title="tile.label" :value="tile.value" :icon="tile.icon" :icon-color="tile.tone" />
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink v-for="tile in statTilesRowTwo" :key="tile.key" :to="tile.to" class="block">
          <StatsCard :title="tile.label" :value="tile.value" :icon="tile.icon" :icon-color="tile.tone" />
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink
          v-for="tile in quickLinkTiles"
          :key="tile.key"
          :to="tile.to"
          class="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)] transition-colors duration-150 hover:border-border/80 hover:bg-muted/20"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="min-w-0 flex-1 text-sm font-semibold text-foreground">
              {{ tile.label }}
            </p>
            <div class="shrink-0 rounded-lg p-2" :class="TONE_ICON_BG[tile.tone]">
              <component :is="tile.icon" class="h-4 w-4" />
            </div>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            {{ tile.value }}
          </p>
        </NuxtLink>
      </div>

      <SectionCard
        v-if="canViewFinancials"
        id="closure-readiness"
        compact
        content-class="p-0"
        titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
        title="Financial Closure Readiness"
        description="Project yang belum Close Finance — blocker AR/AP/Refund harus tuntas sebelum ditutup."
        class="scroll-mt-20"
      >
        <template #actions>
          <StatusBadge :label="`${closureReadiness.length} Project`" tone="neutral" />
        </template>

        <template v-if="closureReadiness.length">
          <div class="overflow-x-auto border-t border-border">
            <Table class="w-full min-w-[860px]">
              <TableHeader>
                <TableRow class="bg-muted/40 hover:bg-muted/40">
                  <TableHead class="w-10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    No
                  </TableHead>
                  <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Project
                  </TableHead>
                  <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Status Finance
                  </TableHead>
                  <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Invoice
                  </TableHead>
                  <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment
                  </TableHead>
                  <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    AR/AP
                  </TableHead>
                  <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </TableHead>
                  <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, index) in closureReadiness" :key="row.project.id">
                  <TableCell class="px-4 py-3 text-xs text-muted-foreground">
                    {{ index + 1 }}
                  </TableCell>
                  <TableCell class="px-4 py-3">
                    <p class="text-sm font-medium text-foreground">
                      {{ row.project.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ row.project.destination }}
                    </p>
                  </TableCell>
                  <TableCell class="px-4 py-3">
                    <StatusBadge :label="row.status.label" :tone="row.status.tone" />
                  </TableCell>
                  <TableCell class="px-4 py-3 text-sm tabular-nums text-foreground">
                    {{ row.invoiceLabel }}
                  </TableCell>
                  <TableCell class="px-4 py-3 text-sm tabular-nums text-foreground">
                    {{ row.paymentLabel }}
                  </TableCell>
                  <TableCell class="px-4 py-3">
                    <span class="inline-flex items-center gap-1 text-sm tabular-nums" :class="row.arApCount > 0 ? 'text-warning' : 'text-muted-foreground'">
                      <AlertTriangle v-if="row.arApCount > 0" class="h-3.5 w-3.5" />{{ row.arApCount }}
                    </span>
                  </TableCell>
                  <TableCell class="px-4 py-3">
                    <span class="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                      <FileStack class="h-3.5 w-3.5" />{{ row.notesCount }}
                    </span>
                  </TableCell>
                  <TableCell class="px-4 py-3 text-right">
                    <NuxtLink :to="`/project-orders/${row.project.id}?tab=finance`" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Lihat Detail<ChevronRight class="h-3.5 w-3.5" />
                    </NuxtLink>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Aktivitas Terbaru — highlight nyata (bukan feed generik), lihat computed `recentFinanceActivity`. -->
          <div v-if="recentFinanceActivity.length" class="grid grid-cols-1 gap-3 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="item in recentFinanceActivity" :key="item.key" class="flex items-start gap-2.5">
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" :class="TONE_ICON_BG[item.tone]">
                <component :is="item.icon" class="h-3.5 w-3.5" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-semibold text-foreground">
                  {{ item.title }}
                </p>
                <p class="truncate text-xs text-muted-foreground" :title="item.subtitle">
                  {{ item.subtitle }}
                </p>
                <p class="mt-0.5 text-[11px] text-muted-foreground/70">
                  {{ item.meta }}
                </p>
              </div>
            </div>
          </div>
        </template>

        <EmptyState v-else title="Seluruh project sudah Close Finance" description="Tidak ada project aktif yang finance-nya belum diselesaikan." />
      </SectionCard>
    </template>
  </div>
</template>
