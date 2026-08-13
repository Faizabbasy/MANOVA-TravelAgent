<script setup lang="ts">
import { ref, computed, onMounted, nextTick, type ComputedRef } from 'vue'
import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  FolderKanban, Handshake, PlaneTakeoff, AlertTriangle, Receipt, Users, Save, X,
  Wallet, PieChart, ListChecks, CheckCircle2, CalendarClock, History, Activity, ShieldCheck, Package, Building2,
  TrendingUp, TrendingDown, Clock
} from 'lucide-vue-next'
import type { HeroMetric } from '~/components/dashboard/DashboardHeroPanel.vue'
import type { CashFlowSideMetric } from '~/components/dashboard/DashboardCashFlowSection.vue'
import {
  PROJECTS, LEADS, QUOTATIONS, PARTIES, USERS,
  getPartyById, getLeadById, getProjectById, getInvoicesByProject, getTasksByProject, getActivitiesByProject,
  getServicesForProjects, getUpcomingTasks, getRecentChanges, getUpcomingFollowUps,
  getSavedViewsForUser, createSavedView, deleteSavedView, applySavedView
} from '~/data'
import { getProjectActualCostIdr, getRevenueByPeriod, getOpexTotalIdr, getOpexPeriods, OPEX_ENTRIES } from '~/data/finance-ext'
import {
  PROJECT_STATUSES, QUOTATION_APPROVAL_STATUSES, PROJECT_CHARACTERISTICS, SERVICE_STATUSES, findStatusOption
} from '~/constants/status'
import { formatCurrencyIdr, formatPercentage, formatDateRange, formatDateTime, formatDayLabel, daysUntil } from '~/utils/format'
import {
  isUpcomingDeparture, isBudgetOverrun, isInvoiceOverdue, hasUnreviewedChange,
  isProjectNeedingAttention, DEMO_REFERENCE_DATE
} from '~/utils/attention'
import { ROLES } from '~/constants/roles'
import type { RoleId } from '~/types/user'
import type { Project, ServiceTypeKey } from '~/types/project'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Dashboard' })

const { currentRole, currentUser } = useCurrentUser()
const { isRole } = usePermissions()
const { showToast } = useToast()

const roleLabel = computed(() => ROLES.value.find(role => role.value === currentRole.value)?.label ?? currentRole.value)
const firstName = computed(() => currentUser.value.name.split(' ')[0])
const dateLabel = computed(() => formatDayLabel(DEMO_REFERENCE_DATE))

/**
 * Section 22 (D-079) — SSR loading-skeleton fix. Sebelumnya `isLoading` hanya berubah ke `false` lewat
 * `setTimeout` di `onMounted`, yang TIDAK PERNAH berjalan saat SSR — hasilnya HTML hasil render server
 * selalu berupa skeleton kosong ("Memuat ringkasan dashboard...", ditemukan Section 20 saat regresi
 * `docs/frontend-known-issues.md` bagian 15). Data di halaman ini seluruhnya fixture sinkron (bukan
 * fetch async nyata) sehingga TIDAK ADA alasan genuine untuk menahan render — `isLoading` dihilangkan
 * (selalu `false`), bukan diberi delay buatan client-only, karena delay client-only akan memaksa konten
 * yang sudah benar dari SSR untuk sempat "hilang" lagi jadi skeleton setelah hydration (regresi UX baru).
 */
const isLoading = ref(false)

/**
 * Visibilitas widget per role. Memakai `isRole()` (bukan `Array.includes`) supaya role id lama yang masih
 * tertulis di pemanggilan di bawah — `project-manager`, `ticketing`, `viewer`, `supplier`, dst. — otomatis
 * teresolusi ke role hasil penggabungan (Revisi 9-Modul), tanpa perlu menyweep puluhan baris ini.
 */
function visibleTo (...roles: RoleId[]) {
  return computed(() => isRole(...roles))
}

/* ==================================================
 * Filters — Section 06: periode, owner, client, project type, dan status.
 * Diterapkan ke seluruh widget berbasis Project (Pipeline Opportunity dan Quotation tidak terpengaruh,
 * keduanya domain CRM yang belum punya filter sendiri sampai Section 08).
 * ================================================== */
const statusFilter = ref<'all' | Project['status']>('all')
const typeFilter = ref<'all' | Project['characteristic']>('all')
const clientFilter = ref<'all' | string>('all')
const ownerFilter = ref<'all' | string>('all')
const periodFilter = ref<'all' | '30' | '60' | '90'>('all')

const showFilters = visibleTo('management', 'project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'finance', 'super-admin', 'viewer')
/**
 * Dulu disembunyikan untuk Project Manager (yang hanya melihat project miliknya sendiri). Sejak
 * `project-manager` melebur ke `operations` — yang juga menangani seluruh sub-domain operasional lintas
 * project — filter owner kembali relevan untuk semua, dan menyembunyikannya tidak punya nilai keamanan
 * apa pun (ia filter tampilan, bukan gerbang data).
 */
const showOwnerFilter = computed(() => true)

const clientOptions = computed(() => {
  const ids = [...new Set(PROJECTS.map(p => p.partyId))]
  return ids.map(id => getPartyById(id)).filter((party): party is NonNullable<typeof party> => Boolean(party))
})
const ownerOptions = computed(() => {
  const ids = [...new Set(PROJECTS.map(p => p.ownerId))]
  return ids.map(id => USERS.find(u => u.id === id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})

/**
 * Saved Views (Section 22, D-079) — membungkus 5 filter Dashboard yang SUDAH ADA di atas, bukan filter
 * baru. Centralized reactive mock state (`app/data/reporting.ts`), per user login (`currentUser.value.id`)
 * — sengaja BUKAN localStorage/sessionStorage, konsisten pola seluruh fixture lain di codebase.
 */
const mySavedViews = computed(() => getSavedViewsForUser(currentUser.value.id, 'dashboard'))
const isSaveViewOpen = ref(false)
const newViewLabel = ref('')

function submitSaveView () {
  const label = newViewLabel.value.trim()
  if (!label) { return }
  createSavedView({
    userId: currentUser.value.id,
    page: 'dashboard',
    label,
    filters: {
      status: statusFilter.value,
      type: typeFilter.value,
      client: clientFilter.value,
      owner: ownerFilter.value,
      period: periodFilter.value
    }
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
  clientFilter.value = view.filters.client ?? 'all'
  ownerFilter.value = view.filters.owner ?? 'all'
  periodFilter.value = (view.filters.period ?? 'all') as typeof periodFilter.value
  showToast('Saved View Diterapkan', `Filter "${view.label}" diterapkan.`, 'success')
}

function removeView (id: string, label: string) {
  deleteSavedView(id)
  showToast('Saved View Dihapus', `"${label}" telah dihapus.`, 'info')
}

function matchesCommonFilters (project: Project): boolean {
  if (statusFilter.value !== 'all' && project.status !== statusFilter.value) { return false }
  if (typeFilter.value !== 'all' && project.characteristic !== typeFilter.value) { return false }
  if (clientFilter.value !== 'all' && project.partyId !== clientFilter.value) { return false }
  if (periodFilter.value !== 'all' && daysUntil(project.travelStartDate, DEMO_REFERENCE_DATE) > Number(periodFilter.value)) { return false }
  return true
}

/** Project sesuai filter aktif (dipakai widget agregat: Management/Finance/Operations-family/Super Admin/Viewer). */
const filteredProjects = computed(() => PROJECTS.filter(project =>
  matchesCommonFilters(project) && (ownerFilter.value === 'all' || project.ownerId === ownerFilter.value)
))
const filteredProjectIds = computed(() => filteredProjects.value.map(p => p.id))

/** Project milik current user sesuai filter aktif (dipakai widget "milik sendiri" — Project Manager). */
const myProjectsAll = computed(() => PROJECTS.filter(project =>
  project.ownerId === currentUser.value.id && matchesCommonFilters(project)
))
const myProjectIds = computed(() => myProjectsAll.value.map(p => p.id))

function attentionOf (projects: Project[]) {
  return projects.filter(project => isProjectNeedingAttention(project, {
    invoices: getInvoicesByProject(project.id),
    tasks: getTasksByProject(project.id),
    activities: getActivitiesByProject(project.id)
  }))
}

function attentionReasons (projectId: string): string[] {
  const project = getProjectById(projectId)!
  const reasons: string[] = []
  if (project.status === 'on-hold') { reasons.push('Status On Hold') }
  if (isBudgetOverrun(project)) { reasons.push('Actual cost melebihi budget') }
  if (getInvoicesByProject(projectId).some(invoice => isInvoiceOverdue(invoice))) { reasons.push('Ada invoice overdue') }
  if (getTasksByProject(projectId).some(task => task.status === 'overdue')) { reasons.push('Ada task overdue') }
  if (hasUnreviewedChange(getActivitiesByProject(projectId))) { reasons.push('Ada perubahan belum direview') }
  return reasons
}

/* ==================================================
 * Data per widget
 * ================================================== */

const activeProjects = computed(() => filteredProjects.value.filter(p => !['completed', 'cancelled'].includes(p.status)))
/** Lead dengan deal berjalan (Quotation dibuat) yang belum jadi Project Order — pengganti "open opportunities" lama. */
const openLeads = computed(() => LEADS.filter(lead => lead.quotationId && !lead.projectId))
const upcomingDepartures = computed(() => filteredProjects.value.filter(project => isUpcomingDeparture(project)))
const attentionProjects = computed(() => attentionOf(filteredProjects.value))
const outstandingInvoices = computed(() =>
  filteredProjectIds.value.flatMap(id => getInvoicesByProject(id)).filter(invoice => invoice.status !== 'paid')
)
const outstandingTotal = computed(() => outstandingInvoices.value.reduce((sum, invoice) => sum + invoice.amountIdr, 0))
const outstandingOverdueCount = computed(() => outstandingInvoices.value.filter(invoice => isInvoiceOverdue(invoice)).length)
/** Keliling ring mini di header Outstanding Invoices — motif "bulet" yang sama dengan Cost Breakdown, dalam skala kecil. */
const OUTSTANDING_RING_CIRCUMFERENCE = 2 * Math.PI * 15
const outstandingOverdueRingOffset = computed(() => {
  if (!outstandingInvoices.value.length) { return OUTSTANDING_RING_CIRCUMFERENCE }
  const share = outstandingOverdueCount.value / outstandingInvoices.value.length
  return OUTSTANDING_RING_CIRCUMFERENCE * (1 - share)
})
const recentActivityItems = computed(() =>
  filteredProjectIds.value
    .flatMap(id => getActivitiesByProject(id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map(activity => ({
      id: activity.id,
      message: activity.message,
      projectName: getProjectById(activity.projectId)?.name,
      createdAt: activity.createdAt,
      isChange: activity.isChange
    }))
)

/** Quotation Pipeline (dulu "Opportunity Pipeline") — Sales/Management/Super Admin/Viewer (D-031, bagian 6). */
const opportunityPipeline = computed<StatusBreakdownItem[]>(() => {
  const bystatus = new Map<string, { count: number; value: number }>()
  for (const quotation of QUOTATIONS) {
    const status = quotation.approvalStatus ?? 'draft'
    const entry = bystatus.get(status) ?? { count: 0, value: 0 }
    entry.count += 1
    entry.value += quotation.amountIdr ?? 0
    bystatus.set(status, entry)
  }
  return QUOTATION_APPROVAL_STATUSES
    .filter(status => bystatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map((status) => {
      const entry = bystatus.get(status.value)!
      return {
        key: status.value,
        label: status.label,
        tone: status.tone,
        count: entry.count,
        secondaryLabel: entry.value > 0 ? formatCurrencyIdr(entry.value) : undefined
      }
    })
})

/**
 * `opportunityPipeline` di atas sudah hanya berisi status Quotation yang "maju" (draft → submitted →
 * approved) — tidak ada lagi stage machine terpisah yang perlu difilter untuk tampilan funnel, jadi funnel
 * dan breakdown memakai data yang sama persis.
 */
const opportunityFunnelStages = computed(() => opportunityPipeline.value)

/** Active Projects by Status — Management/Super Admin/Viewer. */
const projectsByStatus = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const project of filteredProjects.value) {
    byStatus.set(project.status, (byStatus.get(project.status) ?? 0) + 1)
  }
  return PROJECT_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

/** Budget vs Actual — Management/Finance/Super Admin/Viewer. */
const budgetChartProjects = computed(() => filteredProjects.value.filter(p => p.status !== 'cancelled'))

/**
 * Cost Breakdown — Finance/Super Admin. Actual cost hanya tersedia sebagai agregat per Project (belum ada
 * field cost per jenis layanan di fixture), sehingga breakdown di sini per-project — bukan per kategori
 * layanan. Lihat docs/mockup-section-reports/section-06-dashboard.md bagian Known Issues. Nilainya
 * `getProjectActualCostIdr()` (Fase 3.2, Penyederhanaan 7-Role/Menu) — bukan field statis
 * `Project.actualCostIdr` yang tidak pernah diperbarui mutator apa pun.
 */
const costBreakdownItems = computed(() =>
  [...budgetChartProjects.value]
    .map(p => ({ name: p.name, valueIdr: getProjectActualCostIdr(p.id) }))
    .sort((a, b) => b.valueIdr - a.valueIdr)
)

/** Quotations Menunggu Keputusan — Sales/Super Admin. */
const quotationsPendingDecision = computed(() => QUOTATIONS.filter((quotation) => {
  if (quotation.accepted) { return false }
  const lead = getLeadById(quotation.leadId)
  return Boolean(lead) && !lead!.projectId
}))

/**
 * Follow-up Mendatang milik sendiri — Sales (D-031, bagian 6). Deferred di Section 06 karena
 * belum ada model Activity level-Party/Opportunity; diisi Section 07 (CRM Party) via `PartyActivity`.
 */
const myUpcomingFollowUps = computed(() => getUpcomingFollowUps(currentUser.value.id))

/** Widget "milik sendiri" — Project Manager. */
const myActiveProjects = computed(() => myProjectsAll.value.filter(p => !['completed', 'cancelled'].includes(p.status)))
const myAttentionProjects = computed(() => attentionOf(myProjectsAll.value))
const myUpcomingTasks = computed(() => getUpcomingTasks(myProjectIds.value))
const myRecentChanges = computed(() => getRecentChanges(myProjectIds.value, 5))

/** "Project Saya" (bento merge) — active projects milik PM, dipecah jadi sub-bagian Perlu Perhatian/Lainnya agar tidak duplikat baris. */
const myAttentionIds = computed(() => new Set(myAttentionProjects.value.map(p => p.id)))
const myOtherActiveProjects = computed(() => myActiveProjects.value.filter(p => !myAttentionIds.value.has(p.id)))

/**
 * Service Readiness — Operations & Super Admin.
 *
 * Dulu dipersempit per role sub-domain (`ticketing` → hanya Flight, `accommodation` → hanya Hotel, dst.).
 * Keempat role tersebut kini melebur ke satu role `operations` yang memang memiliki SELURUH sub-domain,
 * sehingga penyempitan itu tidak lagi punya makna — widget menampilkan seluruh tipe layanan (`undefined`),
 * dan judulnya otomatis menjadi "Seluruh Layanan" lewat `serviceReadinessLabel` di bawah.
 */
const serviceReadinessType = computed<ServiceTypeKey | undefined>(() => undefined)

const serviceReadinessItems = computed<StatusBreakdownItem[]>(() => {
  const services = getServicesForProjects(filteredProjectIds.value, serviceReadinessType.value)
  const byStatus = new Map<string, number>()
  for (const service of services) {
    byStatus.set(service.status, (byStatus.get(service.status) ?? 0) + 1)
  }
  return SERVICE_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const serviceReadinessLabel = computed(() => {
  const labels: Record<string, string> = { flight: 'Flight', hotel: 'Hotel', transportation: 'Transportation', mice: 'MICE' }
  return serviceReadinessType.value ? labels[serviceReadinessType.value] : 'Seluruh Layanan'
})

/* ==================================================
 * KPI row
 * ================================================== */
const kpiCards = computed(() => [
  {
    key: 'active-projects',
    title: 'Active Projects',
    value: String(activeProjects.value.length),
    icon: FolderKanban,
    color: 'blue' as const,
    /** Finance sengaja dikecualikan — card ini dihapus dari Dashboard Finance (permintaan eksplisit). */
    visible: visibleTo('management', 'project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'super-admin', 'viewer').value
  },
  {
    key: 'open-opportunities',
    title: 'Leads in Quotation',
    value: String(openLeads.value.length),
    icon: Handshake,
    color: 'violet' as const,
    visible: visibleTo('sales', 'account-executive', 'management', 'super-admin', 'viewer').value
  },
  {
    key: 'upcoming-departures',
    title: 'Upcoming Departures',
    value: String(upcomingDepartures.value.length),
    icon: PlaneTakeoff,
    color: 'cyan' as const,
    visible: visibleTo('project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'super-admin').value
  },
  {
    key: 'attention',
    title: 'Project Perlu Perhatian',
    value: String(attentionProjects.value.length),
    icon: AlertTriangle,
    color: 'rose' as const,
    visible: visibleTo('management', 'super-admin', 'viewer').value
  },
  {
    key: 'outstanding',
    title: 'Outstanding Invoices',
    value: formatCurrencyIdr(outstandingTotal.value),
    icon: Receipt,
    color: 'amber' as const,
    /** Finance sengaja dikecualikan — card ini dihapus dari Dashboard Finance (sudah ada versinya di
     * Monthly Cash Flow section), permintaan eksplisit. */
    visible: visibleTo('management', 'super-admin', 'viewer').value
  },
  {
    key: 'total-users',
    title: 'Total User Demo',
    value: String(USERS.length),
    icon: Users,
    color: 'teal' as const,
    visible: visibleTo('super-admin').value
  }
])

/* ==================================================
 * Financial hero panel — Pemasukan Bersih & Profit (sumber sama dengan `ReportsAnalyticsPanel`).
 * Satu papan "ledger terminal" (`DashboardHeroPanel`) tersendiri di atas KPI row biasa, dengan sparkline
 * dari histori 6 periode terakhir asli (bukan dekorasi) — lihat komentar desain di komponen itu sendiri.
 * ================================================== */
const revenuePeriods = computed(() => getRevenueByPeriod())
const latestRevenuePeriod = computed(() => revenuePeriods.value.at(-1))
const previousRevenuePeriod = computed(() => revenuePeriods.value.at(-2))
const showFinancialSummary = visibleTo('finance', 'management', 'super-admin', 'viewer')

function periodTrend (currentIdr: number, previousIdr: number | undefined): { direction: 'up' | 'down'; percentLabel: string } | undefined {
  if (previousIdr === undefined || previousIdr === 0) { return undefined }
  const deltaPercent = ((currentIdr - previousIdr) / Math.abs(previousIdr)) * 100
  return {
    direction: deltaPercent >= 0 ? 'up' : 'down',
    percentLabel: formatPercentage(Math.abs(deltaPercent), 1)
  }
}

const financialPeriodLabel = computed(() => {
  const period = latestRevenuePeriod.value?.period
  if (!period) { return undefined }
  return format(parseISO(`${period}-01`), 'MMMM yyyy', { locale: localeId })
})

const heroMetrics = computed<HeroMetric[]>(() => {
  if (!showFinancialSummary.value || !latestRevenuePeriod.value) { return [] }
  const period = latestRevenuePeriod.value
  const previous = previousRevenuePeriod.value
  const history = revenuePeriods.value.slice(-6)
  /** Merah hanya saat benar-benar rugi — supaya warna panel tetap jujur, bukan selalu hijau apa pun angkanya. */
  const profitPositive = period.netProfitIdr >= 0
  return [
    {
      key: 'net-revenue',
      label: 'Pemasukan Bersih',
      valueIdr: period.revenueIdr,
      icon: TrendingUp,
      series: history.map(row => row.revenueIdr),
      trend: periodTrend(period.revenueIdr, previous?.revenueIdr),
      accent: 'blue'
    },
    {
      key: 'net-profit',
      label: 'Profit',
      valueIdr: period.netProfitIdr,
      icon: Wallet,
      series: history.map(row => row.netProfitIdr),
      trend: periodTrend(period.netProfitIdr, previous?.netProfitIdr),
      accent: profitPositive ? 'emerald' : 'rose'
    }
  ]
})

/* ==================================================
 * Monthly Cash Flow — section baru (permintaan eksplisit, referensi eksternal). Chart dari periode ASLI
 * yang sama dengan `heroMetrics` (bukan data fiktif Jan-Des) — Income = revenueIdr, Expense = directCostIdr
 * + opexIdr per periode. 4 kartu di sampingnya menampilkan ringkasan Opex periode berjalan (sumber sama
 * dengan `OpexPanel` — "Total Opex Periode"/"Sudah Dibayar"/"Menunggu Persetujuan") + Outstanding Invoices
 * yang sudah ada — bukan metrik baru di luar yang sudah tercatat.
 * ================================================== */
const cashFlowLabels = computed(() => revenuePeriods.value.map(row => format(parseISO(`${row.period}-01`), 'MMM', { locale: localeId })))
const cashFlowIncome = computed(() => revenuePeriods.value.map(row => row.revenueIdr))
const cashFlowExpense = computed(() => revenuePeriods.value.map(row => row.directCostIdr + row.opexIdr))

const cashFlowSideMetrics = computed<CashFlowSideMetric[]>(() => {
  if (!showFinancialSummary.value || !latestRevenuePeriod.value) { return [] }
  /** Periode Opex terbaru YANG BENAR-BENAR ADA datanya (`OPEX_ENTRIES`), bukan `latestRevenuePeriod` —
   * periode invoice bisa lebih baru (mis. 2026-08) padahal fixture Opex cuma sampai 2026-07, jadi kalau
   * ikut periode invoice, 3 card ini selalu Rp0. */
  const period = getOpexPeriods()[0]
  const periodOpexEntries = OPEX_ENTRIES.filter(entry => entry.period === period)
  const paidIdr = periodOpexEntries.filter(entry => entry.status === 'paid').reduce((sum, entry) => sum + entry.amountIdr, 0)
  const pendingIdr = periodOpexEntries.filter(entry => entry.status === 'submitted' || entry.status === 'draft').reduce((sum, entry) => sum + entry.amountIdr, 0)
  return [
    { key: 'cf-opex-total', label: 'Total Opex Periode', value: getOpexTotalIdr(period), icon: TrendingDown, accent: 'rose', isCurrency: true },
    { key: 'cf-opex-paid', label: 'Sudah Dibayar', value: paidIdr, icon: CheckCircle2, accent: 'emerald', isCurrency: true },
    { key: 'cf-opex-pending', label: 'Menunggu Persetujuan', value: pendingIdr, icon: Clock, accent: 'violet', isCurrency: true },
    { key: 'cf-outstanding', label: 'Outstanding Invoices', value: outstandingTotal.value, icon: Receipt, accent: 'amber', isCurrency: true }
  ]
})

/* ==================================================
 * Ringkasan Administrasi — dulu cuma 3 angka sejajar dengan sisa ruang kosong besar di bawahnya (widget ini
 * "wide" tier). Ditambah tabel User per Role (data ASLI dari `USERS`, bukan angka baru) supaya ruang itu
 * terisi informasi yang genuinely berguna buat Super Admin, bukan sekadar dilebarkan/dipadatkan kosong.
 * ================================================== */
const adminUserRoleBreakdown = computed(() => {
  const counts = new Map<string, { total: number; active: number; suspended: number }>()
  for (const user of USERS) {
    const entry = counts.get(user.role) ?? { total: 0, active: 0, suspended: 0 }
    entry.total += 1
    if (user.status === 'active') { entry.active += 1 } else { entry.suspended += 1 }
    counts.set(user.role, entry)
  }
  return ROLES.value
    .filter(role => counts.has(role.value))
    .map(role => ({ role: role.label, ...counts.get(role.value)! }))
    .sort((a, b) => b.total - a.total)
})

const adminPartyBreakdown = computed(() => ({
  prospect: PARTIES.filter(party => party.lifecycleStatus === 'prospect').length,
  client: PARTIES.filter(party => party.lifecycleStatus === 'client').length
}))

/** Palet kategorikal tetap (urutan tidak berubah antar-render) — dipakai ribbon komposisi & tiap baris role. */
const ROLE_PALETTE = ['bg-primary', 'bg-success', 'bg-warning', 'bg-chart-4', 'bg-chart-5', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500']

function adminRoleShare (total: number): number {
  const grand = adminUserRoleBreakdown.value.reduce((sum, row) => sum + row.total, 0)
  return grand > 0 ? (total / grand) * 100 : 0
}

/** Ribbon & bar per-role tumbuh dari 0 saat mount — sama bahasa motion dengan `BudgetChart`/`ExpenseCategories`. */
const adminSummaryMounted = ref(false)
onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => { adminSummaryMounted.value = true })
})

/* ==================================================
 * Widget visibility per role (docs/route-and-role-matrix.md bagian 6, LOCKED D-031)
 * `account-executive`/`supplier` (Prompt 19 — Change Request) ditambahkan ke widget yang relevan agar
 * kedua role baru tidak mendapat Dashboard kosong (mockup-scope.md bagian 12, Definition of Done:
 * "tanpa role yang menyebabkan... halaman kosong tak terduga") — AE mewarisi widget Opportunity/Quotation
 * dari Sales (D-047, sekarang AE yang mengelola pipeline tsb); Supplier mendapat widget welcome tersendiri
 * (data internal MANOVA tetap tidak ditampilkan ke Supplier, konsisten isolasi D-048).
 * ================================================== */
const showPipeline = visibleTo('sales', 'account-executive', 'management', 'super-admin', 'viewer')
const showProjectsByStatus = visibleTo('management', 'super-admin', 'viewer')
const showBudgetVsActual = visibleTo('management', 'finance', 'super-admin', 'viewer')
const showCostBreakdown = visibleTo('finance', 'super-admin')
const showOutstanding = visibleTo('finance', 'management', 'super-admin', 'viewer')
const showAttentionGlobal = visibleTo('management', 'super-admin', 'viewer')
const showRecentActivity = visibleTo('management', 'super-admin', 'viewer')
const showQuotationsPending = visibleTo('sales', 'account-executive', 'super-admin')
const showFollowUps = visibleTo('sales')
const showUpcomingDepartures = visibleTo('project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'super-admin')
const showServiceReadiness = visibleTo('operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'super-admin')
const showMyProjects = visibleTo('project-manager')
const showMyTasks = visibleTo('project-manager')
const showMyChanges = visibleTo('project-manager')
const showAdminSummary = visibleTo('super-admin')
const showSupplierWelcome = visibleTo('supplier')
/** Section 02 — mencegah Dashboard kosong untuk 3 role baru (pola sama seperti AE/Supplier, Prompt 19). */
const showClientWelcome = visibleTo('client')
const showProcurementWelcome = visibleTo('procurement')
const showProductPlannerWelcome = visibleTo('product-planner')

/* ==================================================
 * Grid tiering (Dashboard card redesign) — murni fungsi dari show* flag di atas (tidak ada logic role
 * baru, tidak ada hardcode per-role) supaya otomatis menyesuaikan kombinasi widget apa pun yang terlihat
 * untuk role yang sedang login. Grid kartu seragam — tidak ada lagi widget "hero" yang dibesarkan.
 * ================================================== */
/** "Perlu Ditindak" (bento merge) — gabungan Quotations Menunggu Keputusan + Follow-up Mendatang. */
const showActionNeeded = computed(() => showQuotationsPending.value || showFollowUps.value)

const HERO_PRIORITY: { key: string; visible: ComputedRef<boolean> }[] = [
  { key: 'attention-global', visible: showAttentionGlobal },
  { key: 'my-projects', visible: showMyProjects },
  { key: 'outstanding', visible: showOutstanding },
  { key: 'pipeline', visible: showPipeline },
  { key: 'action-needed', visible: showActionNeeded },
  { key: 'budget-vs-actual', visible: showBudgetVsActual },
  { key: 'service-readiness', visible: showServiceReadiness },
  { key: 'projects-by-status', visible: showProjectsByStatus },
  { key: 'cost-breakdown', visible: showCostBreakdown },
  { key: 'upcoming-departures', visible: showUpcomingDepartures },
  { key: 'my-tasks', visible: showMyTasks },
  { key: 'my-changes', visible: showMyChanges },
  { key: 'recent-activity', visible: showRecentActivity },
  { key: 'admin-summary', visible: showAdminSummary },
  { key: 'welcome', visible: computed(() => showSupplierWelcome.value || showClientWelcome.value || showProcurementWelcome.value || showProductPlannerWelcome.value) }
]

const visibleWidgetCount = computed(() => HERO_PRIORITY.filter(widget => widget.visible.value).length)

/** Widget berisi chart/tabel ringkasan — selalu diberi ruang lebih lebar di grid. */
const WIDE_CONTENT_KEYS = new Set(['pipeline', 'budget-vs-actual', 'cost-breakdown', 'admin-summary'])

function tierOf (key: string): 'default' | 'wide' | 'full' {
  if (visibleWidgetCount.value === 1) { return 'full' }
  return WIDE_CONTENT_KEYS.has(key) ? 'wide' : 'default'
}

const visibleKpiCards = computed(() => kpiCards.value.filter(card => card.visible))

function kpiSubtitle (key: string): string | undefined {
  if (key === 'outstanding') { return `${outstandingInvoices.value.length} invoice belum lunas` }
  if (key === 'attention') { return 'Perlu tindak lanjut segera' }
  return undefined
}
</script>

<template>
  <div>
    <DashboardHeader
      :role-label="roleLabel"
      :greeting="`Halo, ${firstName}.`"
      :date-label="dateLabel"
      description="Ringkasan lintas-domain, konten menyesuaikan role yang sedang login."
    />

    <LoadingState v-if="isLoading" message="Memuat ringkasan dashboard..." :rows="4" />

    <template v-else>
      <DashboardHeroPanel
        v-if="heroMetrics.length"
        :metrics="heroMetrics"
        :period-label="financialPeriodLabel"
        class="mb-4"
      />

      <DashboardCashFlowSection
        v-if="cashFlowSideMetrics.length"
        :labels="cashFlowLabels"
        :income="cashFlowIncome"
        :expense="cashFlowExpense"
        :side-metrics="cashFlowSideMetrics"
        class="mb-6"
      />

      <div v-if="visibleKpiCards.length" class="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4 mb-6">
        <DashboardStat
          v-for="card in visibleKpiCards"
          :key="card.key"
          :label="card.title"
          :value="card.value"
          :icon="card.icon"
          :color="card.color"
          :subtitle="kpiSubtitle(card.key)"
        />
      </div>

      <div v-if="showFilters" class="rounded-2xl border border-border bg-card shadow-sm p-4 mb-6">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold text-muted-foreground mr-1">Filter</span>

          <Select v-model="statusFilter">
            <SelectTrigger class="h-9 text-sm w-auto min-w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
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
            <SelectTrigger class="h-9 text-sm w-auto min-w-[140px]">
              <SelectValue placeholder="Tipe Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Semua Tipe
              </SelectItem>
              <SelectItem v-for="type in PROJECT_CHARACTERISTICS" :key="type.value" :value="type.value">
                {{ type.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="clientFilter">
            <SelectTrigger class="h-9 text-sm w-auto min-w-[140px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Semua Client
              </SelectItem>
              <SelectItem v-for="party in clientOptions" :key="party.id" :value="party.id">
                {{ party.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-if="showOwnerFilter" v-model="ownerFilter">
            <SelectTrigger class="h-9 text-sm w-auto min-w-[140px]">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Semua Owner
              </SelectItem>
              <SelectItem v-for="user in ownerOptions" :key="user.id" :value="user.id">
                {{ user.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="periodFilter">
            <SelectTrigger class="h-9 text-sm w-auto min-w-[170px]">
              <SelectValue placeholder="Periode Keberangkatan" />
            </SelectTrigger>
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

          <Dialog v-model:open="isSaveViewOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline" class="ml-auto">
                <Save class="h-3.5 w-3.5 mr-1.5" />Simpan View
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-sm">
              <DialogHeader>
                <DialogTitle>Simpan Saved View</DialogTitle>
                <DialogDescription>Menyimpan kombinasi filter aktif saat ini (mock, tersimpan per user login, bukan localStorage).</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="dashboard-view-label">Nama View</Label>
                <Input id="dashboard-view-label" v-model="newViewLabel" placeholder="mis. Project Confirmed Bulan Ini" />
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
        </div>

        <div v-if="mySavedViews.length" class="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-border">
          <span class="text-xs text-muted-foreground">Saved:</span>
          <div v-for="view in mySavedViews" :key="view.id" class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-3 pr-1.5 py-1 text-xs text-foreground">
            <button type="button" class="hover:underline" @click="applyView(view.id)">
              {{ view.label }}
            </button>
            <button type="button" class="text-muted-foreground hover:text-destructive p-0.5 rounded-full" title="Hapus" @click="removeView(view.id, view.label)">
              <X class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 grid-flow-row-dense">
        <DashboardPanel v-if="showSupplierWelcome" title="Supplier Portal" :icon="Package" color="amber" :size="tierOf('welcome')">
          <p class="text-sm text-muted-foreground leading-relaxed mb-4 max-w-prose">
            Dashboard lintas-domain ini menampilkan data internal MANOVA (project/CRM) yang tidak relevan untuk role Supplier.
            Gunakan Supplier Portal untuk melihat company, produk/layanan, dan assignment/quotation milik Anda sendiri.
          </p>
          <NuxtLink to="/supplier" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Buka Supplier Portal →
          </NuxtLink>
        </DashboardPanel>

        <DashboardPanel v-if="showClientWelcome" title="Client Portal" :icon="Users" color="blue" :size="tierOf('welcome')">
          <p class="text-sm text-muted-foreground leading-relaxed mb-4 max-w-prose">
            Dashboard lintas-domain ini menampilkan data internal MANOVA (project/CRM) yang tidak relevan untuk role Client.
            Gunakan Client Portal untuk melihat profil company, Quotation, dan Project Order milik Anda sendiri.
          </p>
          <NuxtLink to="/client" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Buka Client Portal →
          </NuxtLink>
        </DashboardPanel>

        <DashboardPanel v-if="showProcurementWelcome" title="Vendor Management" :icon="Building2" color="teal" :size="tierOf('welcome')">
          <p class="text-sm text-muted-foreground leading-relaxed mb-4 max-w-prose">
            Kelola direktori Vendor — tambah vendor baru, lihat penugasan aktif, dan katalog produk/layanan per vendor.
          </p>
          <NuxtLink to="/vendors" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Buka Vendors →
          </NuxtLink>
        </DashboardPanel>

        <DashboardPanel v-if="showProductPlannerWelcome" title="Product Planning dan Costing" :icon="Wallet" color="violet" :size="tierOf('welcome')">
          <p class="text-sm text-muted-foreground leading-relaxed mb-4 max-w-prose">
            Kelola katalog Product/Package Template dan siapkan Cost Sheet (traveler-based costing, markup/tax/contingency)
            untuk dipakai Account Executive membentuk Quotation.
          </p>
          <div class="flex flex-wrap gap-x-5 gap-y-2">
            <NuxtLink to="/product-planning" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Buka Product Planning →
            </NuxtLink>
            <NuxtLink to="/product-planning#cost-sheets" class="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Buka Cost Sheets →
            </NuxtLink>
          </div>
        </DashboardPanel>

        <DashboardPanel
          v-if="showPipeline"
          title="Quotation Pipeline"
          description="Dikelompokkan per status approval, seluruh party."
          :icon="Handshake"
          color="violet"
          :size="tierOf('pipeline')"
        >
          <PipelineFunnel :items="opportunityFunnelStages" />
        </DashboardPanel>

        <DashboardPanel v-if="showProjectsByStatus" title="Active Projects by Status" :icon="FolderKanban" color="blue" :size="tierOf('projects-by-status')">
          <StatusBreakdownList :items="projectsByStatus" empty-label="Tidak ada project sesuai filter" />
        </DashboardPanel>

        <DashboardPanel v-if="showBudgetVsActual" title="Budget vs Actual" :icon="Wallet" color="teal" :size="tierOf('budget-vs-actual')">
          <template v-if="budgetChartProjects.length > 0">
            <BudgetChart
              :labels="budgetChartProjects.map(p => p.name)"
              :budget-idr="budgetChartProjects.map(p => p.budgetIdr)"
              :actual-idr="budgetChartProjects.map(p => getProjectActualCostIdr(p.id))"
              :height-class="tierOf('budget-vs-actual') === 'default' ? 'h-[220px]' : 'h-[260px]'"
            />
          </template>
          <EmptyState v-else title="Tidak ada project sesuai filter" />
        </DashboardPanel>

        <DashboardPanel
          v-if="showCostBreakdown"
          title="Cost Breakdown"
          description="Actual cost per project (belum tersedia breakdown per jenis layanan)."
          :icon="PieChart"
          color="cyan"
          :size="tierOf('cost-breakdown')"
        >
          <ExpenseCategories v-if="costBreakdownItems.length > 0" :items="costBreakdownItems" />
          <EmptyState v-else title="Tidak ada project sesuai filter" />
        </DashboardPanel>

        <DashboardPanel v-if="showActionNeeded" title="Perlu Ditindak" :icon="ListChecks" color="amber" :size="tierOf('action-needed')">
          <template v-if="showQuotationsPending">
            <p v-if="showFollowUps" class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Quotation Menunggu Keputusan
            </p>
            <ul class="divide-y divide-border" :class="showFollowUps ? 'mb-5' : ''">
              <li v-for="quotation in quotationsPendingDecision" :key="quotation.id" class="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ getLeadById(quotation.leadId)?.title ?? getLeadById(quotation.leadId)?.companyName ?? getLeadById(quotation.leadId)?.name }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-0.5 truncate">
                    {{ getPartyById(getLeadById(quotation.leadId)?.partyId ?? '')?.name }}
                  </p>
                </div>
                <p class="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {{ formatCurrencyIdr(quotation.amountIdr) }}
                </p>
              </li>
            </ul>
            <EmptyState v-if="quotationsPendingDecision.length === 0" title="Tidak ada quotation menunggu keputusan" />
          </template>

          <template v-if="showFollowUps">
            <p v-if="showQuotationsPending" class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Follow-up Mendatang
            </p>
            <ul class="divide-y divide-border">
              <li v-for="activity in myUpcomingFollowUps" :key="activity.id" class="py-3 first:pt-0 last:pb-0">
                <p class="text-sm font-medium text-foreground">
                  {{ activity.message }}
                </p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ getPartyById(activity.partyId)?.name }} · Dijadwalkan {{ activity.dueAt }}
                </p>
              </li>
            </ul>
            <EmptyState v-if="myUpcomingFollowUps.length === 0" title="Tidak ada follow-up terjadwal dalam waktu dekat" />
          </template>
        </DashboardPanel>

        <DashboardPanel v-if="showUpcomingDepartures" title="Upcoming Departures" :icon="PlaneTakeoff" color="blue" :size="tierOf('upcoming-departures')">
          <ul class="divide-y divide-border">
            <li v-for="project in upcomingDepartures" :key="project.id" class="py-3 first:pt-0 last:pb-0">
              <NuxtLink :to="`/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                {{ project.name }}
              </NuxtLink>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
              </p>
            </li>
          </ul>
          <EmptyState v-if="upcomingDepartures.length === 0" title="Tidak ada keberangkatan sesuai filter" />
        </DashboardPanel>

        <DashboardPanel
          v-if="showServiceReadiness"
          :title="`Service Readiness — ${serviceReadinessLabel}`"
          :icon="CheckCircle2"
          color="cyan"
          :size="tierOf('service-readiness')"
        >
          <StatusBreakdownList :items="serviceReadinessItems" empty-label="Tidak ada service sesuai filter" />
        </DashboardPanel>

        <DashboardPanel v-if="showAttentionGlobal" title="Project Perlu Perhatian" :icon="AlertTriangle" color="rose" :size="tierOf('attention-global')">
          <ul class="divide-y divide-border">
            <li v-for="project in attentionProjects" :key="project.id" class="py-3 first:pt-0 last:pb-0">
              <div class="flex items-center justify-between gap-2">
                <NuxtLink :to="`/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                  {{ project.name }}
                </NuxtLink>
                <AttentionIndicator severity="high" label="Perlu Perhatian" />
              </div>
              <ul class="mt-1.5 pl-4 list-disc text-xs text-muted-foreground space-y-0.5">
                <li v-for="reason in attentionReasons(project.id)" :key="reason">
                  {{ reason }}
                </li>
              </ul>
            </li>
          </ul>
          <EmptyState v-if="attentionProjects.length === 0" title="Tidak ada project yang butuh perhatian" />
        </DashboardPanel>

        <DashboardPanel v-if="showMyProjects" title="Project Saya" :icon="FolderKanban" color="rose" :size="tierOf('my-projects')">
          <template v-if="myAttentionProjects.length">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Perlu Perhatian
            </p>
            <ul class="divide-y divide-border mb-5">
              <li v-for="project in myAttentionProjects" :key="project.id" class="py-3 first:pt-0 last:pb-0">
                <div class="flex items-center justify-between gap-2">
                  <NuxtLink :to="`/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                    {{ project.name }}
                  </NuxtLink>
                  <AttentionIndicator severity="high" label="Perlu Perhatian" />
                </div>
                <ul class="mt-1.5 pl-4 list-disc text-xs text-muted-foreground space-y-0.5">
                  <li v-for="reason in attentionReasons(project.id)" :key="reason">
                    {{ reason }}
                  </li>
                </ul>
              </li>
            </ul>
          </template>

          <template v-if="myOtherActiveProjects.length">
            <p v-if="myAttentionProjects.length" class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Lainnya
            </p>
            <ul class="divide-y divide-border">
              <li v-for="project in myOtherActiveProjects" :key="project.id" class="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <NuxtLink :to="`/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline truncate block">
                    {{ project.name }}
                  </NuxtLink>
                  <p class="text-xs text-muted-foreground mt-0.5 truncate">
                    {{ getPartyById(project.partyId)?.name }}
                  </p>
                </div>
                <StatusBadge
                  :label="findStatusOption(PROJECT_STATUSES, project.status).label"
                  :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
                />
              </li>
            </ul>
          </template>

          <EmptyState v-if="myActiveProjects.length === 0 && myAttentionProjects.length === 0" title="Tidak ada project aktif milik Anda" />
        </DashboardPanel>

        <DashboardPanel v-if="showMyTasks" title="Milestone / Task Mendatang" :icon="CalendarClock" color="amber" :size="tierOf('my-tasks')">
          <ul class="divide-y divide-border">
            <li v-for="task in myUpcomingTasks" :key="task.id" class="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate">
                  {{ task.title }}
                </p>
                <p class="text-xs text-muted-foreground mt-0.5 truncate">
                  {{ getProjectById(task.projectId)?.name }}
                </p>
              </div>
              <p class="text-xs text-muted-foreground shrink-0">
                Jatuh tempo {{ task.dueAt }}
              </p>
            </li>
          </ul>
          <EmptyState v-if="myUpcomingTasks.length === 0" title="Tidak ada task mendatang" />
        </DashboardPanel>

        <DashboardPanel v-if="showMyChanges" title="Change History Ringkas" :icon="History" color="violet" :size="tierOf('my-changes')">
          <ul class="divide-y divide-border">
            <li v-for="change in myRecentChanges" :key="change.id" class="py-3 first:pt-0 last:pb-0">
              <p class="text-sm font-medium text-foreground">
                {{ change.message }}
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ getProjectById(change.projectId)?.name }} · {{ formatDateTime(change.createdAt) }}
              </p>
            </li>
          </ul>
          <EmptyState v-if="myRecentChanges.length === 0" title="Tidak ada perubahan terbaru pada project Anda" />
        </DashboardPanel>

        <DashboardPanel v-if="showOutstanding" title="Outstanding Invoices" :icon="Receipt" color="amber" :size="tierOf('outstanding')">
          <div v-if="outstandingInvoices.length" class="mb-4 flex items-center gap-3 pb-4 border-b border-border">
            <div class="relative h-10 w-10 shrink-0">
              <svg viewBox="0 0 36 36" class="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" stroke-width="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="hsl(var(--destructive))"
                  stroke-width="4"
                  stroke-linecap="round"
                  :stroke-dasharray="OUTSTANDING_RING_CIRCUMFERENCE"
                  :stroke-dashoffset="outstandingOverdueRingOffset"
                  class="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-foreground tabular-nums">
                {{ formatCurrencyIdr(outstandingTotal) }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ outstandingInvoices.length }} invoice
                <template v-if="outstandingOverdueCount"> · <span class="text-destructive font-medium">{{ outstandingOverdueCount }} overdue</span></template>
              </p>
            </div>
          </div>

          <ul class="-mx-1 divide-y divide-border">
            <li
              v-for="invoice in outstandingInvoices"
              :key="invoice.id"
              class="flex items-center gap-3 border-l-2 py-3 pl-3 pr-1 first:pt-0 last:pb-0"
              :class="isInvoiceOverdue(invoice) ? 'border-destructive' : 'border-transparent'"
            >
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground truncate">
                  {{ invoice.label }}
                </p>
                <p class="text-xs text-muted-foreground mt-0.5 truncate">
                  {{ getProjectById(invoice.projectId)?.name }}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-semibold text-foreground tabular-nums">
                  {{ formatCurrencyIdr(invoice.amountIdr) }}
                </p>
                <p v-if="isInvoiceOverdue(invoice)" class="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                  Overdue
                </p>
              </div>
            </li>
          </ul>
          <EmptyState v-if="outstandingInvoices.length === 0" title="Tidak ada invoice outstanding" />
        </DashboardPanel>

        <DashboardPanel v-if="showRecentActivity" title="Recent Activity" :icon="Activity" color="blue" :size="tierOf('recent-activity')">
          <RecentActivity :items="recentActivityItems" />
        </DashboardPanel>

        <DashboardPanel v-if="showAdminSummary" title="Ringkasan Administrasi" :icon="ShieldCheck" color="teal" :size="tierOf('admin-summary')">
          <div class="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-3">
            <div class="flex items-center gap-3 rounded-xl border border-primary/[0.14] bg-gradient-to-br from-primary/[0.14] via-primary/[0.04] to-transparent p-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Users class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-lg font-bold leading-none text-foreground tabular-nums">
                  {{ USERS.length }}
                </p>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  Total User Demo
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 rounded-xl border border-violet-500/[0.14] bg-gradient-to-br from-violet-500/[0.14] via-violet-500/[0.04] to-transparent p-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
                <Building2 class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-lg font-bold leading-none text-foreground tabular-nums">
                  {{ PARTIES.length }}
                </p>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  {{ adminPartyBreakdown.prospect }} prospect · {{ adminPartyBreakdown.client }} client
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3 rounded-xl border border-success/[0.14] bg-gradient-to-br from-success/[0.14] via-success/[0.04] to-transparent p-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                <FolderKanban class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-lg font-bold leading-none text-foreground tabular-nums">
                  {{ PROJECTS.length }}
                </p>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  Total Project
                </p>
              </div>
            </div>
          </div>

          <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Komposisi User per Role
          </p>

          <div class="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              v-for="(row, index) in adminUserRoleBreakdown"
              :key="`ribbon-${row.role}`"
              class="h-full transition-[width] ease-out first:rounded-l-full last:rounded-r-full"
              :class="ROLE_PALETTE[index % ROLE_PALETTE.length]"
              :style="{
                width: `${adminSummaryMounted ? adminRoleShare(row.total) : 0}%`,
                transitionDuration: '700ms',
                transitionDelay: `${index * 60}ms`,
                marginRight: index < adminUserRoleBreakdown.length - 1 ? '2px' : '0'
              }"
              :title="`${row.role}: ${row.total}`"
            />
          </div>

          <ul class="divide-y divide-border">
            <li v-for="(row, index) in adminUserRoleBreakdown" :key="row.role" class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="ROLE_PALETTE[index % ROLE_PALETTE.length]" />
              <span class="min-w-0 flex-1 truncate text-sm text-foreground">{{ row.role }}</span>
              <span v-if="row.suspended" class="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                {{ row.suspended }} suspended
              </span>
              <div class="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
                <div
                  class="h-full rounded-full transition-[width] ease-out"
                  :class="ROLE_PALETTE[index % ROLE_PALETTE.length]"
                  :style="{ width: `${adminSummaryMounted ? adminRoleShare(row.total) : 0}%`, transitionDuration: '700ms', transitionDelay: `${index * 60}ms` }"
                />
              </div>
              <span class="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{{ row.total }}</span>
            </li>
          </ul>
        </DashboardPanel>
      </div>
    </template>
  </div>
</template>
