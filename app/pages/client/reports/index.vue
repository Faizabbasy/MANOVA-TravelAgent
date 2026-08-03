<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderKanban, PlaneTakeoff, Users, Wallet, TrendingUp, AlertTriangle, Download, Printer, Star } from 'lucide-vue-next'
import { getProjectsByParty, getClientReportSummary } from '~/data'
import { PROJECT_STATUSES, SERVICE_TYPES } from '~/constants/status'
import { formatCurrencyIdr, formatPercentage } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { ProjectStatus, ServiceTypeKey } from '~/types/project'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'
import type { BadgeTone } from '~/types/common'

/**
 * Reports & Analytics (Repair Phase Section 7 — Insights & Company, Master Prompt bagian 16). Seluruh angka
 * murni derivasi `getClientReportSummary` (agregasi di atas Project/Invoice/Traveler/ChangeRequest/
 * SupportTicket/Feedback existing) — TIDAK ADA dataset laporan paralel. Chart mengikuti pattern existing:
 * `StatusBreakdownList` (breakdown kategorikal, pola sama `/reports` internal) + `SimpleBarChart`
 * (Chart.js/vue-chartjs, diekstrak dari `BudgetChart.vue` Dashboard) untuk tren bulanan.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Reports & Analytics' })

const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()

const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const destinations = computed(() => Array.from(new Set(projects.value.map(project => project.destination))).sort())

const dateFrom = ref('')
const dateTo = ref('')
const projectFilter = ref('all')
const destinationFilter = ref('all')
const serviceFilter = ref<'all' | ServiceTypeKey>('all')
const statusFilter = ref<'all' | ProjectStatus>('all')

const summary = computed(() => (clientScopeId.value
  ? getClientReportSummary(clientScopeId.value, {
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined,
    projectId: projectFilter.value !== 'all' ? projectFilter.value : undefined,
    destination: destinationFilter.value !== 'all' ? destinationFilter.value : undefined,
    service: serviceFilter.value !== 'all' ? serviceFilter.value : undefined,
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined
  })
  : undefined))

const TONE_CYCLE: BadgeTone[] = ['primary', 'info', 'success', 'warning', 'purple', 'destructive', 'neutral']
function toBreakdownItems (rows: { key: string; label: string; value: number }[], formatSecondary: (value: number) => string = String): StatusBreakdownItem[] {
  return rows.map((row, index) => ({ key: row.key, label: row.label, tone: TONE_CYCLE[index % TONE_CYCLE.length], count: row.value, secondaryLabel: formatSecondary(row.value) }))
}

const tripsByStatusItems = computed(() => summary.value ? summary.value.tripsByStatus.map(row => ({ key: row.key, label: row.label, tone: PROJECT_STATUSES.find(o => o.value === row.key)?.tone ?? 'neutral', count: row.value })) : [])
const spendingByDestinationItems = computed(() => summary.value ? toBreakdownItems(summary.value.spendingByDestination, v => formatCurrencyIdr(v)) : [])
const spendingByServiceItems = computed(() => summary.value ? toBreakdownItems(summary.value.spendingByService, v => formatCurrencyIdr(v)) : [])
const issueCategoryItems = computed(() => summary.value ? toBreakdownItems(summary.value.issueCategory) : [])
const paymentStatusItems = computed(() => summary.value ? toBreakdownItems(summary.value.paymentStatus) : [])

/* --- Export mock --- */
const EXPORT_SECTIONS = [
  { key: 'summary', label: 'Ringkasan (Stat Cards)' },
  { key: 'spending', label: 'Spending by Month/Destination/Service' },
  { key: 'trips', label: 'Trips by Status dan Participant Trend' },
  { key: 'full-report', label: 'Seluruh Laporan' }
]
const isExportOpen = ref(false)
const exportSectionKey = ref(EXPORT_SECTIONS[EXPORT_SECTIONS.length - 1].key)
const exportFormat = ref<'excel' | 'pdf'>('excel')
function submitExport () {
  const section = EXPORT_SECTIONS.find(item => item.key === exportSectionKey.value)
  const filename = `client-report-${exportSectionKey.value}-${DEMO_REFERENCE_DATE}.${exportFormat.value === 'excel' ? 'xlsx' : 'pdf'}`
  showToast('Export Disiapkan', `${filename} — bagian "${section?.label}" (mock, tidak ada file yang benar-benar dihasilkan).`, 'success')
  isExportOpen.value = false
}
function printPage () {
  window.print()
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Reports & Analytics"
      description="Laporan dan analitik perjalanan company Anda, dihitung langsung dari data terpusat."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Insights' }, { label: 'Reports & Analytics' }]"
    >
      <template #actions>
        <div class="flex items-center gap-2 print:hidden">
          <Button size="sm" variant="outline" @click="printPage">
            <Printer class="h-4 w-4 mr-1.5" />Print
          </Button>
          <Dialog v-model:open="isExportOpen">
            <DialogTrigger as-child>
              <Button size="sm">
                <Download class="h-4 w-4 mr-1.5" />Export
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Export Laporan</DialogTitle>
                <DialogDescription>Mock export — tidak ada file yang benar-benar dihasilkan (D-006).</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="export-section">Bagian</Label>
                  <select id="export-section" v-model="exportSectionKey" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in EXPORT_SECTIONS" :key="option.key" :value="option.key">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="export-format">Format</Label>
                  <select id="export-format" v-model="exportFormat" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="excel">
                      Excel
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
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard class="print:hidden">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="space-y-1.5">
            <Label for="rep-from">Dari Tanggal</Label>
            <Input id="rep-from" v-model="dateFrom" type="date" />
          </div>
          <div class="space-y-1.5">
            <Label for="rep-to">Sampai Tanggal</Label>
            <Input id="rep-to" v-model="dateTo" type="date" />
          </div>
          <div class="space-y-1.5">
            <Label for="rep-project">Project</Label>
            <select id="rep-project" v-model="projectFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Project
              </option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="rep-destination">Destinasi</Label>
            <select id="rep-destination" v-model="destinationFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Destinasi
              </option>
              <option v-for="destination in destinations" :key="destination" :value="destination">
                {{ destination }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="rep-service">Layanan</Label>
            <select id="rep-service" v-model="serviceFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Layanan
              </option>
              <option v-for="option in SERVICE_TYPES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="rep-status">Status Project</Label>
            <select id="rep-status" v-model="statusFilter" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Status
              </option>
              <option v-for="option in PROJECT_STATUSES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
      </SectionCard>

      <template v-if="summary && projects.length">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Trips" :value="String(summary.totalTrips)" :icon="PlaneTakeoff" />
          <StatsCard title="Total Projects" :value="String(summary.totalProjects)" :icon="FolderKanban" />
          <StatsCard title="Total Participants" :value="String(summary.totalParticipants)" :icon="Users" />
          <StatsCard title="Total Spending" :value="formatCurrencyIdr(summary.totalSpendingIdr)" :icon="Wallet" />
          <StatsCard title="Average Project Value" :value="formatCurrencyIdr(summary.averageProjectValueIdr)" :icon="TrendingUp" />
          <StatsCard title="Upcoming Trips" :value="String(summary.upcomingTrips)" :icon="PlaneTakeoff" icon-color="warning" />
          <StatsCard title="Completed Trips" :value="String(summary.completedTrips)" :icon="PlaneTakeoff" icon-color="success" />
          <StatsCard title="Outstanding Invoices" :value="String(summary.outstandingInvoiceCount)" :subtitle="formatCurrencyIdr(summary.outstandingInvoiceIdr)" :icon="AlertTriangle" icon-color="warning" />
          <StatsCard title="Cancellation Rate" :value="formatPercentage(summary.cancellationRatePercent, 1)" :icon="AlertTriangle" />
          <StatsCard title="Satisfaction" :value="summary.satisfactionAverage !== undefined ? `${summary.satisfactionAverage}/5` : 'Belum ada data'" :icon="Star" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Spending by Month">
            <SimpleBarChart :labels="summary.spendingByMonth.map(p => p.label)" :values="summary.spendingByMonth.map(p => p.value)" :value-formatter="formatCurrencyIdr" />
          </SectionCard>
          <SectionCard title="Change Request Frequency" description="Jumlah Change Request diajukan per bulan.">
            <SimpleBarChart :labels="summary.changeRequestFrequencyByMonth.map(p => p.label)" :values="summary.changeRequestFrequencyByMonth.map(p => p.value)" />
          </SectionCard>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Spending by Destination">
            <StatusBreakdownList :items="spendingByDestinationItems" empty-label="Belum ada data" />
          </SectionCard>
          <SectionCard title="Spending by Service">
            <StatusBreakdownList :items="spendingByServiceItems" empty-label="Belum ada data" />
          </SectionCard>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Trips by Status">
            <StatusBreakdownList :items="tripsByStatusItems" empty-label="Belum ada data" />
          </SectionCard>
          <SectionCard title="Participant Trend" description="Jumlah peserta per Project Order, diurutkan tanggal keberangkatan (pendekatan tren — Traveler tidak memiliki timestamp pendaftaran individual).">
            <SimpleBarChart :labels="summary.participantTrend.map(p => p.label)" :values="summary.participantTrend.map(p => p.value)" />
          </SectionCard>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Issue Category">
            <StatusBreakdownList :items="issueCategoryItems" empty-label="Belum ada data" />
          </SectionCard>
          <SectionCard title="Payment Status">
            <StatusBreakdownList :items="paymentStatusItems" empty-label="Belum ada data" />
          </SectionCard>
        </div>
      </template>
      <SectionCard v-else>
        <EmptyState :icon="FolderKanban" title="Belum ada data" description="Laporan akan tampil di sini setelah Project Order Anda tersedia, atau coba ubah filter." />
      </SectionCard>
    </template>
  </div>
</template>
