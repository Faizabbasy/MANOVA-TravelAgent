<script setup lang="ts">
import { computed, ref } from 'vue'
import { Users, CalendarCheck, Wallet, Award, Search, TrendingUp } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import {
  EMPLOYEES,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_RUNS,
  PAYROLL_RUN_STATUSES,
  COMMISSION_STATUSES,
  COMMISSION_RECORDS,
  getAttendanceSummary,
  getAttendancePeriods,
  getPayrollBreakdown,
  getPayrollTotalIdr,
  updatePayrollRunStatus,
  getPerformanceReviews,
  getProductivitySummary
} from '~/data/hr'
import { getUserById, getProjectById } from '~/data'
import { findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatPercentage } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Human Resource Management' })

const { canView, can } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const hasAccess = computed(() => canView('hr'))
const canManagePayroll = computed(() => can('hr.manage-payroll'))
const canManagePerformance = computed(() => can('hr.manage-performance'))

const refreshKey = ref(0)
const activeTab = ref<'employees' | 'attendance' | 'payroll' | 'commissions' | 'performance' | 'productivity'>('employees')

const searchQuery = ref('')
const departmentFilter = ref<'all' | string>('all')
const periods = computed(() => getAttendancePeriods())
const selectedPeriod = ref('')
const activePeriod = computed(() => selectedPeriod.value || periods.value[0])

const departments = computed(() => [...new Set(EMPLOYEES.map(employee => employee.department))])

const filteredEmployees = computed(() => {
  let result = EMPLOYEES as typeof EMPLOYEES
  if (departmentFilter.value !== 'all') { result = result.filter(employee => employee.department === departmentFilter.value) }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(employee => employee.name.toLowerCase().includes(query) || employee.position.toLowerCase().includes(query))
  }
  return result
})

const stats = computed(() => {
  void refreshKey.value
  const active = EMPLOYEES.filter(employee => employee.status === 'active')
  const rates = EMPLOYEES.slice(0, 8).map(employee => getAttendanceSummary(employee.id, activePeriod.value).ratePercent)
  return {
    headcount: active.length,
    onLeave: EMPLOYEES.filter(employee => employee.status === 'on-leave').length,
    attendanceRate: rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0,
    monthlyPayroll: PAYROLL_RUNS.length ? getPayrollTotalIdr(PAYROLL_RUNS.at(-1)!.id) : 0
  }
})

const selectedPayrollRunId = ref('')
const activePayrollRun = computed(() => PAYROLL_RUNS.find(run => run.id === selectedPayrollRunId.value) ?? PAYROLL_RUNS.at(-1))
const payrollBreakdown = computed(() => {
  void refreshKey.value
  return activePayrollRun.value ? getPayrollBreakdown(activePayrollRun.value.id) : []
})

const attendanceRows = computed(() => {
  void refreshKey.value
  return EMPLOYEES.slice(0, 8).map(employee => ({
    employee,
    summary: getAttendanceSummary(employee.id, activePeriod.value)
  }))
})

const commissions = computed(() => {
  void refreshKey.value
  return [...COMMISSION_RECORDS].sort((a, b) => b.amountIdr - a.amountIdr)
})

const reviews = computed(() => getPerformanceReviews())
const productivity = computed(() => {
  void refreshKey.value
  return getProductivitySummary(activePeriod.value)
})

const maxRevenueHandled = computed(() => Math.max(1, ...productivity.value.map(row => row.revenueHandledIdr)))

function setPayrollStatus (status: 'approved' | 'paid') {
  if (!activePayrollRun.value) { return }
  updatePayrollRunStatus(activePayrollRun.value.id, status, currentUser.value.id)
  refreshKey.value += 1
  showToast('Payroll diperbarui', `Periode ${activePayrollRun.value.period} kini ${findStatusOption(PAYROLL_RUN_STATUSES, status).label}.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Human Resource Management"
      description="Data karyawan, absensi & payroll, komisi & insentif, performance dan productivity tracking."
      :breadcrumb="[{ label: 'Human Resource' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Human Resource" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Karyawan Aktif" :value="String(stats.headcount)" :icon="Users" icon-color="primary" />
        <StatsCard title="Sedang Cuti" :value="String(stats.onLeave)" :icon="CalendarCheck" :icon-color="stats.onLeave ? 'warning' : 'success'" />
        <StatsCard title="Rata-rata Kehadiran" :value="formatPercentage(stats.attendanceRate)" :icon="CalendarCheck" :icon-color="stats.attendanceRate >= 90 ? 'success' : 'warning'" />
        <StatsCard title="Payroll Periode Terakhir" :value="formatCurrencyIdr(stats.monthlyPayroll)" :icon="Wallet" />
      </div>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="employees">
            Data Karyawan
          </TabsTrigger>
          <TabsTrigger value="attendance">
            Absensi
          </TabsTrigger>
          <TabsTrigger value="payroll">
            Payroll
          </TabsTrigger>
          <TabsTrigger value="commissions">
            Komisi & Insentif
          </TabsTrigger>
          <TabsTrigger value="performance">
            Performance
          </TabsTrigger>
          <TabsTrigger value="productivity">
            Produktivitas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" class="pt-4 space-y-4">
          <div class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
            <div class="relative flex-1 max-w-sm w-full">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input v-model="searchQuery" placeholder="Cari nama atau posisi..." class="pl-9" />
            </div>
            <select v-model="departmentFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Departemen
              </option>
              <option v-for="department in departments" :key="department" :value="department">
                {{ department }}
              </option>
            </select>
          </div>

          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Bergabung</TableHead>
                  <TableHead class="text-right">
                    Gaji Pokok
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="employee in filteredEmployees" :key="employee.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ employee.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ employee.position }}
                      <template v-if="employee.commissionRatePercent"> · komisi {{ employee.commissionRatePercent }}%</template>
                    </p>
                  </TableCell>
                  <TableCell class="text-sm text-foreground">
                    {{ employee.department }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(EMPLOYMENT_TYPES, employee.employmentType).label"
                      :tone="findStatusOption(EMPLOYMENT_TYPES, employee.employmentType).tone"
                    />
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ formatDate(employee.joinedAt) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-foreground">
                    {{ employee.baseSalaryIdr ? formatCurrencyIdr(employee.baseSalaryIdr) : 'Per proyek' }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(EMPLOYEE_STATUSES, employee.status).label"
                      :tone="findStatusOption(EMPLOYEE_STATUSES, employee.status).tone"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="attendance" class="pt-4 space-y-4">
          <select v-model="selectedPeriod" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option v-for="period in periods" :key="period" :value="period">
              Periode {{ period }}
            </option>
          </select>

          <SectionCard :description="`Rekap kehadiran periode ${activePeriod}. Hadir dan remote sama-sama dihitung bekerja.`">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead v-for="status in ATTENDANCE_STATUSES" :key="status.value" class="text-center">
                    {{ status.label }}
                  </TableHead>
                  <TableHead>Tingkat Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in attendanceRows" :key="row.employee.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ row.employee.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ row.employee.position }}
                    </p>
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.summary.present }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.summary.remote }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.summary.leave }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.summary.sick }}
                  </TableCell>
                  <TableCell class="text-center text-sm" :class="row.summary.absent ? 'text-destructive font-medium' : 'text-foreground'">
                    {{ row.summary.absent }}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span class="h-2 w-20 rounded-full bg-muted overflow-hidden">
                        <span
                          :class="cn('block h-full rounded-full', row.summary.ratePercent >= 90 ? 'bg-success' : row.summary.ratePercent >= 75 ? 'bg-warning' : 'bg-destructive')"
                          :style="{ width: `${row.summary.ratePercent}%` }"
                        />
                      </span>
                      <span class="text-sm font-medium text-foreground">{{ row.summary.ratePercent }}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="payroll" class="pt-4 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <select v-model="selectedPayrollRunId" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option v-for="run in PAYROLL_RUNS" :key="run.id" :value="run.id">
                Payroll {{ run.period }}
              </option>
            </select>

            <div v-if="canManagePayroll && activePayrollRun" class="flex items-center gap-2">
              <StatusBadge
                :label="findStatusOption(PAYROLL_RUN_STATUSES, activePayrollRun.status).label"
                :tone="findStatusOption(PAYROLL_RUN_STATUSES, activePayrollRun.status).tone"
              />
              <Button v-if="activePayrollRun.status === 'draft'" size="sm" @click="setPayrollStatus('approved')">
                Setujui Payroll
              </Button>
              <Button v-if="activePayrollRun.status === 'approved'" size="sm" @click="setPayrollStatus('paid')">
                Tandai Dibayar
              </Button>
            </div>
          </div>

          <SectionCard v-if="activePayrollRun" :title="`Payroll ${activePayrollRun.period}`" :description="`Total ${formatCurrencyIdr(getPayrollTotalIdr(activePayrollRun.id))}`">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead class="text-right">
                    Gaji Pokok
                  </TableHead>
                  <TableHead class="text-right">
                    Tunjangan
                  </TableHead>
                  <TableHead class="text-right">
                    Komisi
                  </TableHead>
                  <TableHead class="text-right">
                    Potongan
                  </TableHead>
                  <TableHead class="text-right">
                    Take Home Pay
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="line in payrollBreakdown" :key="line.id">
                  <TableCell class="text-sm font-medium text-foreground">
                    {{ line.employee?.name ?? line.employeeId }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(line.baseSalaryIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(line.allowanceIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm" :class="line.commissionIdr ? 'text-success' : 'text-muted-foreground'">
                    {{ formatCurrencyIdr(line.commissionIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-destructive">
                    −{{ formatCurrencyIdr(line.deductionIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold text-foreground">
                    {{ formatCurrencyIdr(line.netIdr) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="commissions" class="pt-4">
          <SectionCard description="Komisi diturunkan dari nilai kontrak project yang dipegang karyawan dan tarif komisinya masing-masing.">
            <Table v-if="commissions.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead class="text-right">
                    Nilai Kontrak
                  </TableHead>
                  <TableHead class="text-right">
                    Tarif
                  </TableHead>
                  <TableHead class="text-right">
                    Komisi
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="record in commissions" :key="record.id">
                  <TableCell class="text-sm font-medium text-foreground">
                    {{ EMPLOYEES.find(item => item.id === record.employeeId)?.name ?? record.employeeId }}
                  </TableCell>
                  <TableCell>
                    <NuxtLink :to="`/project-orders/${record.projectId}`" class="text-sm text-primary hover:underline">
                      {{ getProjectById(record.projectId)?.name ?? record.projectId }}
                    </NuxtLink>
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ record.period }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(record.baseAmountIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ record.ratePercent }}%
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold text-foreground">
                    {{ formatCurrencyIdr(record.amountIdr) }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(COMMISSION_STATUSES, record.status).label"
                      :tone="findStatusOption(COMMISSION_STATUSES, record.status).tone"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <EmptyState v-else :icon="Award" title="Belum ada komisi tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="performance" class="pt-4">
          <SectionCard :description="canManagePerformance ? 'Hasil review periodik per karyawan.' : 'Anda hanya dapat melihat hasil review.'">
            <ul v-if="reviews.length" class="divide-y divide-border">
              <li v-for="review in reviews" :key="review.id" class="py-4 first:pt-0 last:pb-0">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-foreground">
                      {{ EMPLOYEES.find(item => item.id === review.employeeId)?.name ?? review.employeeId }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Periode {{ review.period }} · direview {{ getUserById(review.reviewerId)?.name ?? review.reviewerId }} pada {{ formatDate(review.reviewedAt) }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-bold" :class="review.overallScore >= 4 ? 'text-success' : review.overallScore >= 3 ? 'text-warning' : 'text-destructive'">
                      {{ review.overallScore.toFixed(2) }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      dari 5.00
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div v-for="item in [{ label: 'Delivery', value: review.deliveryScore }, { label: 'Kualitas', value: review.qualityScore }, { label: 'Kolaborasi', value: review.collaborationScore }, { label: 'Inisiatif', value: review.initiativeScore }]" :key="item.label" class="rounded-lg bg-muted/40 px-2.5 py-1.5">
                    <p class="text-xs text-muted-foreground">
                      {{ item.label }}
                    </p>
                    <p class="text-sm font-semibold text-foreground">
                      {{ item.value }}/5
                    </p>
                  </div>
                </div>

                <p v-if="review.strengths" class="text-xs text-muted-foreground mt-2">
                  <span class="text-success font-medium">Kekuatan:</span> {{ review.strengths }}
                </p>
                <p v-if="review.improvements" class="text-xs text-muted-foreground mt-0.5">
                  <span class="text-warning font-medium">Perbaikan:</span> {{ review.improvements }}
                </p>
              </li>
            </ul>
            <EmptyState v-else :icon="Award" title="Belum ada performance review" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="productivity" class="pt-4">
          <SectionCard description="Seluruh angka diturunkan dari project dan task yang benar-benar dipegang karyawan — bukan input manual.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead class="text-center">
                    Project
                  </TableHead>
                  <TableHead class="text-center">
                    Task Selesai
                  </TableHead>
                  <TableHead>Penyelesaian Task</TableHead>
                  <TableHead class="text-right">
                    Nilai Dikelola
                  </TableHead>
                  <TableHead class="text-center">
                    Kehadiran
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in productivity" :key="row.employeeId">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ row.employeeName }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ row.position }}
                    </p>
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.projectsCompleted }}/{{ row.projectsOwned }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.tasksCompleted }}/{{ row.tasksAssigned }}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <span class="block h-full rounded-full bg-primary" :style="{ width: `${row.taskCompletionPercent}%` }" />
                      </span>
                      <span class="text-xs text-muted-foreground">{{ row.taskCompletionPercent }}%</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex items-center justify-end gap-2">
                      <span class="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                        <span class="block h-full rounded-full bg-success" :style="{ width: `${(row.revenueHandledIdr / maxRevenueHandled) * 100}%` }" />
                      </span>
                      <span class="text-sm text-foreground">{{ formatCurrencyIdr(row.revenueHandledIdr) }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-center text-sm" :class="row.attendanceRatePercent >= 90 ? 'text-success' : 'text-muted-foreground'">
                    {{ row.attendanceRatePercent ? `${row.attendanceRatePercent}%` : '—' }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
