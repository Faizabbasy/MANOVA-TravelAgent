<script setup lang="ts">
import { ref, computed } from 'vue'
import { Handshake, FolderKanban, Building2, Wallet, Receipt, Download, Save, X, Clock } from 'lucide-vue-next'
import {
  PROJECTS, LEADS, QUOTATIONS, VENDOR_QUOTATIONS, INVOICES,
  getProjectById, getLeadById, getProjectServices, getServicesForProjects, getVendorById,
  getCommittedVendorCostIdr, getInvoiceOutstandingIdr,
  getSavedViewsForUser, createSavedView, deleteSavedView, applySavedView
} from '~/data'
import { getProjectActualCostIdr } from '~/data/finance-ext'
import {
  PROJECT_STATUSES, PROJECT_CHARACTERISTICS, QUOTATION_APPROVAL_STATUSES, SERVICE_STATUSES, VENDOR_QUOTATION_STATUSES
} from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange, formatPercentage, daysUntil } from '~/utils/format'
import { isUpcomingDeparture, invoiceAgingDays, DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { RoleId } from '~/types/user'
import type { Project } from '~/types/project'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

/**
 * Tab "Operasional" — Menu Reporting & BI > Reports (Penyederhanaan 7-Role/Menu). Dulu `/reports`
 * (halaman ini sendiri), kini tab dalam satu menu bersama Analytics & Marketing ROI — logika tidak diubah.
 */

const { currentRole, currentUser } = useCurrentUser()
const { canView, isRole } = usePermissions()
const { showToast } = useToast()

/**
 * Section 22 (D-079) — SSR loading-skeleton fix (identik rasional Dashboard `app/pages/index.vue`).
 * Data di halaman ini seluruhnya fixture sinkron, tidak ada alasan genuine untuk menahan render.
 */
const isLoading = ref(false)

/** Lihat catatan yang sama di `app/pages/index.vue` — `isRole()` meresolusi role id lama secara otomatis. */
function visibleTo (...roles: RoleId[]) {
  return computed(() => isRole(...roles))
}

/* ==================================================
 * Filters — berlaku ke seluruh section berbasis Project (Sales Pipeline domain CRM, tidak terpengaruh).
 * ================================================== */
const statusFilter = ref<'all' | Project['status']>('all')
const typeFilter = ref<'all' | Project['characteristic']>('all')
const periodFilter = ref<'all' | '30' | '60' | '90'>('all')

function matchesFilters (project: Project): boolean {
  if (statusFilter.value !== 'all' && project.status !== statusFilter.value) { return false }
  if (typeFilter.value !== 'all' && project.characteristic !== typeFilter.value) { return false }
  if (periodFilter.value !== 'all' && daysUntil(project.travelStartDate, DEMO_REFERENCE_DATE) > Number(periodFilter.value)) { return false }
  return true
}

const filteredProjects = computed(() => PROJECTS.filter(matchesFilters))
const filteredProjectIds = computed(() => filteredProjects.value.map(p => p.id))

/**
 * Saved Views (Section 22, D-079) — membungkus 3 filter Reports yang SUDAH ADA di atas. Centralized
 * reactive mock state (`app/data/reporting.ts`), per user login — konsisten pola Dashboard, BUKAN
 * localStorage/sessionStorage.
 */
const mySavedViews = computed(() => getSavedViewsForUser(currentUser.value.id, 'reports'))
const isSaveViewOpen = ref(false)
const newViewLabel = ref('')

function submitSaveView () {
  const label = newViewLabel.value.trim()
  if (!label) { return }
  createSavedView({
    userId: currentUser.value.id,
    page: 'reports',
    label,
    filters: { status: statusFilter.value, type: typeFilter.value, period: periodFilter.value }
  })
  showToast('Saved View Disimpan', `"${label}" tersimpan — dapat diterapkan ulang kapan saja.`, 'success')
  newViewLabel.value = ''
  isSaveViewOpen.value = false
}

function applyView (id: string) {
  const view = applySavedView(id)
  if (!view) { return }
  statusFilter.value = (view.filters.status ?? 'all') as typeof statusFilter.value
  typeFilter.value = (view.filters.type ?? 'all') as typeof typeFilter.value
  periodFilter.value = (view.filters.period ?? 'all') as typeof periodFilter.value
  showToast('Saved View Diterapkan', `Filter "${view.label}" diterapkan.`, 'success')
}

function removeView (id: string, label: string) {
  deleteSavedView(id)
  showToast('Saved View Dihapus', `"${label}" telah dihapus.`, 'info')
}

/**
 * Export mock (Section 22) — CSV/PDF placeholder. TIDAK ADA file yang benar-benar dihasilkan (larangan
 * protokol eksplisit) — murni simulasi nama file + toast, konsisten pola D-006.
 */
const EXPORT_SECTIONS = [
  { key: 'sales-pipeline', label: 'Sales Pipeline' },
  { key: 'project-performance', label: 'Project Performance' },
  { key: 'departure-readiness', label: 'Upcoming Departure dan Service Readiness' },
  { key: 'vendor-summary', label: 'Vendor Summary' },
  { key: 'budget-margin', label: 'Budget vs Actual dan Margin' },
  { key: 'invoice-aging', label: 'Invoice Aging dan Outstanding' },
  { key: 'sla-quotation-performance', label: 'SLA dan Quotation Performance' },
  { key: 'full-report', label: 'Seluruh Laporan' }
]
const isExportOpen = ref(false)
const exportSectionKey = ref(EXPORT_SECTIONS[EXPORT_SECTIONS.length - 1].key)
const exportFormat = ref<'csv' | 'pdf'>('csv')

function submitExport () {
  const section = EXPORT_SECTIONS.find(item => item.key === exportSectionKey.value)
  const filename = `${exportSectionKey.value}-${DEMO_REFERENCE_DATE}.${exportFormat.value}`
  showToast('Export Disiapkan', `${filename} — bagian "${section?.label}" (mock, tidak ada file yang benar-benar dihasilkan).`, 'success')
  isExportOpen.value = false
}

/* ==================================================
 * Section 1 — Sales Pipeline (Sales/Management/Super Admin/Viewer)
 * ================================================== */
/** Lead ber-deal (Quotation dibuat) — pengganti Opportunity lama; "Lost" tidak dilacak (tidak ada fitur Lost, lihat komentar desain di `app/types/lead.ts`). */
const dealLeads = computed(() => LEADS.filter(lead => lead.quotationId))
const openOpportunities = computed(() => dealLeads.value.filter(lead => !lead.projectId))
const wonCount = computed(() => dealLeads.value.filter(lead => lead.projectId).length)
const winRatePct = computed(() => (dealLeads.value.length === 0 ? 0 : (wonCount.value / dealLeads.value.length) * 100))
const openPipelineValueIdr = computed(() => openOpportunities.value.reduce((sum, lead) => {
  const quotation = QUOTATIONS.find(q => q.leadId === lead.id)
  return sum + (quotation?.amountIdr ?? 0)
}, 0))
const salesPipelineItems = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, { count: number; value: number }>()
  for (const quotation of QUOTATIONS) {
    const status = quotation.approvalStatus ?? 'draft'
    const entry = byStatus.get(status) ?? { count: 0, value: 0 }
    entry.count += 1
    entry.value += quotation.amountIdr ?? 0
    byStatus.set(status, entry)
  }
  return QUOTATION_APPROVAL_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map((status) => {
      const entry = byStatus.get(status.value)!
      return { key: status.value, label: status.label, tone: status.tone, count: entry.count, secondaryLabel: entry.value > 0 ? formatCurrencyIdr(entry.value) : undefined }
    })
})

/* ==================================================
 * Section 2 — Project Performance (Project Manager/Management/Super Admin/Viewer)
 * ================================================== */
const activeProjectCount = computed(() => filteredProjects.value.filter(p => !['completed', 'cancelled'].includes(p.status)).length)
const completedProjectCount = computed(() => filteredProjects.value.filter(p => p.status === 'completed').length)
const onHoldProjectCount = computed(() => filteredProjects.value.filter(p => p.status === 'on-hold').length)
const avgTravelerCount = computed(() => {
  if (filteredProjects.value.length === 0) { return 0 }
  return Math.round(filteredProjects.value.reduce((sum, p) => sum + p.travelerCount, 0) / filteredProjects.value.length)
})
const projectsByStatusItems = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const project of filteredProjects.value) { byStatus.set(project.status, (byStatus.get(project.status) ?? 0) + 1) }
  return PROJECT_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})
const projectsByCharacteristicItems = computed<StatusBreakdownItem[]>(() => {
  const byChar = new Map<string, number>()
  for (const project of filteredProjects.value) { byChar.set(project.characteristic, (byChar.get(project.characteristic) ?? 0) + 1) }
  return PROJECT_CHARACTERISTICS
    .filter(type => byChar.has(type.value))
    .sort((a, b) => a.order - b.order)
    .map(type => ({ key: type.value, label: type.label, tone: type.tone, count: byChar.get(type.value)! }))
})

/* ==================================================
 * Section 3 — Upcoming Departure dan Service Readiness (Project Manager/Management/Super Admin/Viewer)
 * ================================================== */
const upcomingDepartureProjects = computed(() =>
  filteredProjects.value
    .filter(project => isUpcomingDeparture(project))
    .sort((a, b) => daysUntil(a.travelStartDate, DEMO_REFERENCE_DATE) - daysUntil(b.travelStartDate, DEMO_REFERENCE_DATE))
)
const serviceReadinessItems = computed<StatusBreakdownItem[]>(() => {
  const services = getServicesForProjects(filteredProjectIds.value)
  const byStatus = new Map<string, number>()
  for (const service of services) { byStatus.set(service.status, (byStatus.get(service.status) ?? 0) + 1) }
  return SERVICE_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})
function readinessFraction (projectId: string): string {
  const services = getProjectServices(projectId)
  if (services.length === 0) { return '0/0' }
  const confirmed = services.filter(service => ['confirmed', 'completed'].includes(service.status)).length
  return `${confirmed}/${services.length}`
}

/* ==================================================
 * Section 4 — Vendor Summary (Project Manager/Finance/Management/Super Admin/Viewer)
 * ================================================== */
const scopedVendorQuotations = computed(() => VENDOR_QUOTATIONS.filter(q => filteredProjectIds.value.includes(q.projectId)))
const vendorQuotationStatusItems = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const quotation of scopedVendorQuotations.value) { byStatus.set(quotation.status, (byStatus.get(quotation.status) ?? 0) + 1) }
  return VENDOR_QUOTATION_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})
const totalCommittedVendorCostIdr = computed(() => filteredProjectIds.value.reduce((sum, id) => sum + getCommittedVendorCostIdr(id), 0))
const activeVendorCount = computed(() => new Set(scopedVendorQuotations.value.filter(q => q.status === 'accepted').map(q => q.vendorId)).size)
const topVendorRows = computed(() => {
  const byVendor = new Map<string, { vendorId: string; committedIdr: number; assignments: number }>()
  for (const quotation of scopedVendorQuotations.value) {
    if (quotation.status !== 'accepted') { continue }
    const entry = byVendor.get(quotation.vendorId) ?? { vendorId: quotation.vendorId, committedIdr: 0, assignments: 0 }
    entry.committedIdr += quotation.amountIdr
    entry.assignments += 1
    byVendor.set(quotation.vendorId, entry)
  }
  return [...byVendor.values()]
    .sort((a, b) => b.committedIdr - a.committedIdr)
    .map(entry => ({ ...entry, vendor: getVendorById(entry.vendorId) }))
})

/* ==================================================
 * Section 5 — Budget vs Actual dan Margin (Finance/Management/Super Admin/Viewer)
 * Reuse `getCommittedVendorCostIdr`/formula margin existing (Section 15) — bukan menghitung ulang di tempat lain.
 * ================================================== */
const budgetProjects = computed(() => filteredProjects.value.filter(p => p.status !== 'cancelled'))
const totalBudgetIdr = computed(() => budgetProjects.value.reduce((sum, p) => sum + p.budgetIdr, 0))
/** Fase 3.2 (Penyederhanaan 7-Role/Menu) — `getProjectActualCostIdr()` turunan, bukan field statis `Project.actualCostIdr` (selalu `0` untuk project baru). */
const totalActualIdr = computed(() => budgetProjects.value.reduce((sum, p) => sum + getProjectActualCostIdr(p.id), 0))
const totalVarianceIdr = computed(() => totalBudgetIdr.value - totalActualIdr.value)
const totalQuotationIdr = computed(() => budgetProjects.value.reduce((sum, p) => sum + p.quotationAmountIdr, 0))
const totalMarginIdr = computed(() => totalQuotationIdr.value - totalActualIdr.value)

/* ==================================================
 * Section 6 — Invoice Aging dan Outstanding (Finance/Management/Super Admin/Viewer)
 * Reuse `invoiceAgingDays`/`getInvoiceOutstandingIdr` existing (Section 15) — bukan menghitung ulang.
 * ================================================== */
const outstandingInvoiceRows = computed(() =>
  INVOICES
    .filter(invoice => filteredProjectIds.value.includes(invoice.projectId) && invoice.status !== 'paid')
    .map(invoice => ({
      invoice,
      projectName: getProjectById(invoice.projectId)?.name ?? invoice.projectId,
      agingDays: invoiceAgingDays(invoice),
      outstandingIdr: getInvoiceOutstandingIdr(invoice.id)
    }))
    .sort((a, b) => a.agingDays - b.agingDays)
)
const totalOutstandingIdr = computed(() => outstandingInvoiceRows.value.reduce((sum, row) => sum + row.outstandingIdr, 0))
const overdueInvoiceCount = computed(() => outstandingInvoiceRows.value.filter(row => row.agingDays < 0).length)

const AGING_BUCKETS = [
  { key: 'current', label: 'Belum Jatuh Tempo', tone: 'success' as const, test: (days: number) => days >= 0 },
  { key: 'b1-30', label: 'Overdue 1–30 Hari', tone: 'warning' as const, test: (days: number) => days < 0 && days >= -30 },
  { key: 'b31-60', label: 'Overdue 31–60 Hari', tone: 'warning' as const, test: (days: number) => days < -30 && days >= -60 },
  { key: 'b60plus', label: 'Overdue 60+ Hari', tone: 'destructive' as const, test: (days: number) => days < -60 }
]
const invoiceAgingItems = computed<StatusBreakdownItem[]>(() =>
  AGING_BUCKETS
    .map(bucket => ({ key: bucket.key, label: bucket.label, tone: bucket.tone, count: outstandingInvoiceRows.value.filter(row => bucket.test(row.agingDays)).length }))
    .filter(item => item.count > 0)
)
function agingLabel (days: number): string {
  if (days < 0) { return `${Math.abs(days)} hari overdue` }
  if (days === 0) { return 'Jatuh tempo hari ini' }
  return `Jatuh tempo dalam ${days} hari`
}

/* ==================================================
 * Section 7 — SLA dan Quotation Performance (Section 22, BARU — bukan reuse section 1-6).
 * Domain Lead/Quotation (sama seperti Sales Pipeline) — TIDAK terpengaruh filter Project di atas.
 * Metrik dihitung dari `Lead.qualifiedAt` → `Quotation.createdAt` (bukan `Quotation.sentToClientAt`,
 * yang HANYA terisi untuk 1 dari seluruh quotation saat ini — field opsional, belum konsisten dipakai
 * cukup untuk jadi metrik utama, lihat kartu terpisah di bawah). `qualifiedAt` menggantikan
 * `Opportunity.createdAt` lama sebagai timestamp awal cycle (entitas Opportunity dihapus, lihat komentar
 * desain di `app/types/lead.ts`). Threshold SLA (3 hari) adalah ASUMSI MOCK eksplisit untuk demo — BUKAN SLA
 * kontraktual nyata dengan client (D-079). "Approval cycle time" (dari literal Section 22 Wajib) TIDAK
 * dihitung — `Quotation` tidak memiliki field timestamp `approvedAt` tersimpan (hanya
 * `approvedBy`/`approvalNote`), lihat `docs/frontend-known-issues.md` bagian 17.
 * ================================================== */
const QUOTATION_SLA_THRESHOLD_DAYS = 3

const opportunityQuotationCycle = computed(() => LEADS
  .filter(lead => lead.qualifiedAt)
  .map((lead) => {
    const quotation = QUOTATIONS.find(q => q.leadId === lead.id)
    if (!quotation) { return null }
    const cycleDays = daysUntil(quotation.createdAt, lead.qualifiedAt!)
    return { lead, quotation, cycleDays, withinSla: cycleDays <= QUOTATION_SLA_THRESHOLD_DAYS }
  })
  .filter((row): row is NonNullable<typeof row> => row !== null)
  .sort((a, b) => b.cycleDays - a.cycleDays))

const avgQuotationCycleDays = computed(() => {
  if (opportunityQuotationCycle.value.length === 0) { return 0 }
  const sum = opportunityQuotationCycle.value.reduce((acc, row) => acc + row.cycleDays, 0)
  return Math.round((sum / opportunityQuotationCycle.value.length) * 10) / 10
})
const withinSlaPct = computed(() => {
  if (opportunityQuotationCycle.value.length === 0) { return 0 }
  return (opportunityQuotationCycle.value.filter(row => row.withinSla).length / opportunityQuotationCycle.value.length) * 100
})
const quotationsSentToClient = computed(() => QUOTATIONS.filter(q => q.sentToClientAt))

/* ==================================================
 * Visibilitas per section (docs/route-and-role-matrix.md bagian 5/6 — lihat catatan implementasi Section 16
 * di dokumen tsb untuk pemetaan 6 section granular terhadap 4 section yang tercatat di bagian 5).
 * `account-executive` ditambahkan Prompt 19 (Change Request) — AE mengambil alih pengelolaan Opportunity/
 * Quotation dari Sales, jadi turut melihat Sales Pipeline (Sales tetap melihatnya juga, kini sebagai
 * konteks lintas-tim, tidak lagi mengelola langsung).
 * ================================================== */
const showSalesPipeline = visibleTo('sales', 'account-executive', 'management', 'super-admin', 'viewer')
const showProjectPerformance = visibleTo('project-manager', 'management', 'super-admin', 'viewer')
const showDepartureReadiness = visibleTo('project-manager', 'management', 'super-admin', 'viewer')
const showVendorSummary = visibleTo('project-manager', 'finance', 'management', 'super-admin', 'viewer')
const showBudgetMargin = visibleTo('finance', 'management', 'super-admin', 'viewer')
const showInvoiceAging = visibleTo('finance', 'management', 'super-admin', 'viewer')
/** SLA dan Quotation Performance (Section 22) — sama seperti Sales Pipeline (domain Opportunity/Quotation, dikelola Sales/AE, dipantau Management). */
const showSlaPerformance = visibleTo('sales', 'account-executive', 'management', 'super-admin', 'viewer')
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <Dialog v-model:open="isExportOpen">
        <DialogTrigger as-child>
          <Button size="sm" variant="outline">
            <Download class="h-4 w-4 mr-1.5" />Export
          </Button>
        </DialogTrigger>
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export Report</DialogTitle>
            <DialogDescription>Mock export — tidak ada file yang benar-benar dihasilkan, murni simulasi (D-006).</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="export-section">Bagian</Label>
              <select id="export-section" v-model="exportSectionKey" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="section in EXPORT_SECTIONS" :key="section.key" :value="section.key">
                  {{ section.label }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="export-format">Format</Label>
              <select id="export-format" v-model="exportFormat" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="csv">
                  CSV
                </option>
                <option value="pdf">
                  PDF
                </option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isExportOpen = false">
              Batal
            </Button>
            <Button @click="submitExport">
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <RoleAccessState v-if="!canView('reports')" module-label="modul Reporting & BI" />

    <template v-else>
      <LoadingState v-if="isLoading" message="Menyusun laporan..." :rows="5" />

      <template v-else>
        <SectionCard title="Filter" description="Berlaku untuk seluruh section berbasis Project di bawah (Sales Pipeline dan SLA/Quotation Performance tidak terpengaruh).">
          <template #actions>
            <Dialog v-model:open="isSaveViewOpen">
              <DialogTrigger as-child>
                <Button size="sm" variant="outline">
                  <Save class="h-4 w-4 mr-1.5" />Simpan View
                </Button>
              </DialogTrigger>
              <DialogContent class="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Simpan Saved View</DialogTitle>
                  <DialogDescription>Menyimpan kombinasi filter aktif saat ini (mock, tersimpan per user login, bukan localStorage).</DialogDescription>
                </DialogHeader>
                <div class="space-y-1.5 py-2">
                  <Label for="reports-view-label">Nama View</Label>
                  <Input id="reports-view-label" v-model="newViewLabel" placeholder="mis. Project In Progress Kuartal Ini" />
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isSaveViewOpen = false">
                    Batal
                  </Button>
                  <Button :disabled="!newViewLabel.trim()" @click="submitSaveView">
                    Simpan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </template>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select v-model="statusFilter">
              <SelectTrigger><SelectValue placeholder="Status Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Semua Status
                </SelectItem>
                <SelectItem v-for="status in PROJECT_STATUSES" :key="status.value" :value="status.value">
                  {{ status.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select v-model="typeFilter">
              <SelectTrigger><SelectValue placeholder="Tipe Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Semua Tipe
                </SelectItem>
                <SelectItem v-for="type in PROJECT_CHARACTERISTICS" :key="type.value" :value="type.value">
                  {{ type.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select v-model="periodFilter">
              <SelectTrigger><SelectValue placeholder="Periode Keberangkatan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Semua Periode
                </SelectItem>
                <SelectItem value="30">
                  30 Hari ke Depan
                </SelectItem>
                <SelectItem value="60">
                  60 Hari ke Depan
                </SelectItem>
                <SelectItem value="90">
                  90 Hari ke Depan
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="mySavedViews.length" class="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted-foreground shrink-0">Saved Views:</span>
            <div v-for="view in mySavedViews" :key="view.id" class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-3 pr-1 py-1 text-xs">
              <button type="button" class="text-foreground hover:underline" @click="applyView(view.id)">
                {{ view.label }}
              </button>
              <button type="button" class="text-muted-foreground hover:text-destructive p-0.5" title="Hapus" @click="removeView(view.id, view.label)">
                <X class="h-3 w-3" />
              </button>
            </div>
          </div>
        </SectionCard>

        <!-- Section 1: Sales Pipeline -->
        <SectionCard v-if="showSalesPipeline" title="Sales Pipeline" description="Seluruh Lead ber-deal dikelompokkan per status approval Quotation, lintas party (tidak terpengaruh filter project).">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatsCard title="Open Leads (Quotation)" :value="String(openOpportunities.length)" :icon="Handshake" />
            <StatsCard title="Nilai Pipeline Terbuka" :value="formatCurrencyIdr(openPipelineValueIdr)" :icon="Handshake" icon-color="primary" />
            <StatsCard title="Win Rate" :value="formatPercentage(winRatePct)" :subtitle="`${wonCount} Won / ${dealLeads.length} Deal`" :icon="Handshake" icon-color="success" />
          </div>
          <StatusBreakdownList :items="salesPipelineItems" empty-label="Tidak ada quotation dalam pipeline" />
          <div v-if="salesPipelineItems.length" class="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted-foreground shrink-0">Lihat detail per status:</span>
            <NuxtLink
              v-for="item in salesPipelineItems"
              :key="item.key"
              :to="`/sales/pipeline?qtab=all&status=${item.key}#quotations`"
              class="text-xs text-primary hover:underline"
            >
              {{ item.label }} ({{ item.count }})
            </NuxtLink>
          </div>
        </SectionCard>

        <!-- Section 2: Project Performance -->
        <SectionCard v-if="showProjectPerformance" title="Project Performance" description="Ringkasan status dan karakteristik project sesuai filter aktif.">
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Active Projects" :value="String(activeProjectCount)" :icon="FolderKanban" />
            <StatsCard title="Completed" :value="String(completedProjectCount)" :icon="FolderKanban" icon-color="success" />
            <StatsCard title="On Hold" :value="String(onHoldProjectCount)" :icon="FolderKanban" icon-color="warning" />
            <StatsCard title="Rata-rata Traveler" :value="String(avgTravelerCount)" :icon="FolderKanban" />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-3">
                Berdasarkan Status
              </p>
              <StatusBreakdownList :items="projectsByStatusItems" empty-label="Tidak ada project sesuai filter" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-3">
                Berdasarkan Tipe
              </p>
              <StatusBreakdownList :items="projectsByCharacteristicItems" empty-label="Tidak ada project sesuai filter" />
            </div>
          </div>
        </SectionCard>

        <!-- Section 3: Upcoming Departure dan Service Readiness -->
        <SectionCard v-if="showDepartureReadiness" title="Upcoming Departure dan Service Readiness" description="Keberangkatan dalam 30 hari ke depan dan status kesiapan layanan sesuai filter aktif.">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-3">
                Upcoming Departures
              </p>
              <ul v-if="upcomingDepartureProjects.length" class="divide-y divide-border">
                <li v-for="project in upcomingDepartureProjects" :key="project.id" class="py-3 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <NuxtLink :to="`/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:underline truncate block">
                      {{ project.name }}
                    </NuxtLink>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
                    </p>
                  </div>
                  <span class="text-xs text-muted-foreground shrink-0">Readiness {{ readinessFraction(project.id) }}</span>
                </li>
              </ul>
              <EmptyState v-else title="Tidak ada keberangkatan sesuai filter" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-3">
                Service Readiness
              </p>
              <StatusBreakdownList :items="serviceReadinessItems" empty-label="Tidak ada service sesuai filter" />
            </div>
          </div>
        </SectionCard>

        <!-- Section 4: Vendor Summary -->
        <SectionCard v-if="showVendorSummary" title="Vendor Summary" description="Status quotation vendor dan committed cost sesuai filter project aktif.">
          <template #actions>
            <NuxtLink to="/vendors#performance">
              <Button size="sm" variant="outline">
                Procurement Performance Review
              </Button>
            </NuxtLink>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatsCard title="Vendor Aktif" :value="String(activeVendorCount)" :icon="Building2" />
            <StatsCard title="Committed Vendor Cost" :value="formatCurrencyIdr(totalCommittedVendorCostIdr)" :icon="Building2" icon-color="primary" />
            <StatsCard title="Total Quotation" :value="String(scopedVendorQuotations.length)" :icon="Building2" />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-3">
                Status Quotation
              </p>
              <StatusBreakdownList :items="vendorQuotationStatusItems" empty-label="Tidak ada quotation vendor sesuai filter" />
            </div>
            <div>
              <p class="text-xs font-medium text-muted-foreground mb-3">
                Top Vendor (Committed Cost)
              </p>
              <Table v-if="topVendorRows.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Committed Cost</TableHead>
                    <TableHead>Penugasan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in topVendorRows" :key="row.vendorId" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/vendors/${row.vendorId}`)">
                    <TableCell class="font-medium text-foreground">
                      {{ row.vendor?.name ?? row.vendorId }}
                    </TableCell>
                    <TableCell>{{ formatCurrencyIdr(row.committedIdr) }}</TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ row.assignments }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <EmptyState v-else title="Belum ada quotation vendor yang diterima" />
            </div>
          </div>
        </SectionCard>

        <!-- Section 5: Budget vs Actual dan Margin -->
        <SectionCard v-if="showBudgetMargin" title="Budget vs Actual dan Margin" description="Agregat lintas project sesuai filter aktif (project berstatus Cancelled dikecualikan).">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatsCard title="Budget" :value="formatCurrencyIdr(totalBudgetIdr)" :icon="Wallet" />
            <StatsCard title="Actual Cost" :value="formatCurrencyIdr(totalActualIdr)" :icon="Wallet" :icon-color="totalActualIdr > totalBudgetIdr ? 'destructive' : 'success'" />
            <StatsCard title="Variance" :value="formatCurrencyIdr(totalVarianceIdr)" :icon="Wallet" :icon-color="totalVarianceIdr >= 0 ? 'success' : 'destructive'" />
            <StatsCard title="Nilai Quotation" :value="formatCurrencyIdr(totalQuotationIdr)" :icon="Wallet" icon-color="primary" />
            <StatsCard title="Margin" :value="formatCurrencyIdr(totalMarginIdr)" :icon="Wallet" :icon-color="totalMarginIdr >= 0 ? 'success' : 'destructive'" />
          </div>
          <BudgetChart
            v-if="budgetProjects.length > 0"
            :labels="budgetProjects.map(p => p.name)"
            :budget-idr="budgetProjects.map(p => p.budgetIdr)"
            :actual-idr="budgetProjects.map(p => getProjectActualCostIdr(p.id))"
          />
          <EmptyState v-else title="Tidak ada project sesuai filter" />
        </SectionCard>

        <!-- Section 6: Invoice Aging dan Outstanding -->
        <SectionCard v-if="showInvoiceAging" title="Invoice Aging dan Outstanding" description="Invoice belum lunas lintas project sesuai filter aktif, diurutkan dari yang paling overdue. Klik baris untuk membuka tab Finance pada Project terkait.">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <StatsCard title="Total Outstanding" :value="formatCurrencyIdr(totalOutstandingIdr)" :icon="Receipt" icon-color="warning" />
            <StatsCard title="Invoice Overdue" :value="String(overdueInvoiceCount)" :icon="Receipt" icon-color="destructive" />
          </div>
          <StatusBreakdownList :items="invoiceAgingItems" empty-label="Tidak ada invoice outstanding sesuai filter" class="mb-6" />
          <Table v-if="outstandingInvoiceRows.length">
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in outstandingInvoiceRows"
                :key="row.invoice.id"
                class="cursor-pointer hover:bg-muted/50"
                @click="navigateTo(`/project-orders/${row.invoice.projectId}?tab=finance`)"
              >
                <TableCell class="font-medium text-foreground">
                  {{ row.invoice.label }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.projectName }}
                </TableCell>
                <TableCell>{{ formatCurrencyIdr(row.outstandingIdr) }}</TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatDate(row.invoice.dueAt) }}
                </TableCell>
                <TableCell :class="row.agingDays < 0 ? 'text-destructive' : 'text-muted-foreground'">
                  {{ agingLabel(row.agingDays) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <EmptyState v-else title="Tidak ada invoice outstanding sesuai filter" />
        </SectionCard>

        <!-- Section 7: SLA dan Quotation Performance (Section 22, BARU) -->
        <SectionCard
          v-if="showSlaPerformance"
          title="SLA dan Quotation Performance"
          description="Cycle time Lead Qualified → Quotation Dibuat, lintas party (domain Lead/Quotation, tidak terpengaruh filter project di atas)."
        >
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatsCard title="Rata-rata Cycle Time" :value="`${avgQuotationCycleDays} hari`" :icon="Clock" />
            <StatsCard
              title="Dalam Threshold SLA"
              :value="formatPercentage(withinSlaPct)"
              :subtitle="`Threshold mock: ${QUOTATION_SLA_THRESHOLD_DAYS} hari`"
              :icon="Clock"
              :icon-color="withinSlaPct >= 50 ? 'success' : 'warning'"
            />
            <StatsCard title="Quotation Terkirim ke Client" :value="String(quotationsSentToClient.length)" :subtitle="`dari ${QUOTATIONS.length} quotation`" :icon="Clock" />
          </div>
          <p class="text-xs text-muted-foreground mb-4">
            Threshold SLA {{ QUOTATION_SLA_THRESHOLD_DAYS }} hari adalah <strong>asumsi mock untuk demo</strong>, bukan SLA kontraktual nyata dengan client.
            "Approval cycle time" (Wajib literal Section 22) tidak dapat dihitung — Quotation tidak menyimpan timestamp <code>approvedAt</code>
            (hanya <code>approvedBy</code>/<code>approvalNote</code>), lihat known issues.
          </p>
          <Table v-if="opportunityQuotationCycle.length">
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Quotation</TableHead>
                <TableHead>Lead Qualified</TableHead>
                <TableHead>Quotation Dibuat</TableHead>
                <TableHead>Cycle Time</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in opportunityQuotationCycle"
                :key="row.quotation.id"
                class="cursor-pointer hover:bg-muted/50"
                @click="navigateTo(`/crm/leads/${row.lead.id}`)"
              >
                <TableCell class="font-medium text-foreground">
                  {{ row.lead.title ?? row.lead.companyName ?? row.lead.name }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.quotation.id }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatDate(row.lead.qualifiedAt) }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatDate(row.quotation.createdAt) }}
                </TableCell>
                <TableCell>{{ row.cycleDays }} hari</TableCell>
                <TableCell>
                  <StatusBadge :label="row.withinSla ? 'Dalam SLA' : 'Melebihi SLA'" :tone="row.withinSla ? 'success' : 'destructive'" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <EmptyState v-else title="Belum ada Lead dengan Quotation untuk dihitung cycle time-nya" />
        </SectionCard>
      </template>
    </template>
  </div>
</template>
