<script setup lang="ts">
import { computed, ref } from 'vue'
import { Users, CalendarCheck, Wallet, Award, Search, TrendingUp, Plus, Pencil } from 'lucide-vue-next'
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
  updatePayrollLine,
  updatePayrollRunStatus,
  getPerformanceReviews,
  getProductivitySummary,
  addEmployee,
  updateEmployee,
  getEmployeeByUserId,
  addIncentive
} from '~/data/hr'
import type { PayrollLineComputed } from '~/data/hr'
import { getUserById, getProjectById, PROJECTS } from '~/data'
import { findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatPercentage } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { Employee } from '~/types/hr'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Human Resource Management' })

const { canView, can } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const hasAccess = computed(() => canView('hr'))
const canManageEmployees = computed(() => can('hr.manage-employee'))
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

/* Dialog tambah / edit karyawan */
const isEmployeeFormOpen = ref(false)
const employeeFormMode = ref<'create' | 'edit'>('create')
const editingEmployeeId = ref<string | undefined>()
const employeeForm = ref({
  name: '',
  position: '',
  department: '',
  employmentType: 'full-time' as Employee['employmentType'],
  status: 'active' as Employee['status'],
  joinedAt: DEMO_REFERENCE_DATE,
  isProjectBased: false,
  baseSalaryIdr: null as number | null,
  commissionRatePercent: null as number | null,
  phone: '',
  email: ''
})

function openCreateEmployee () {
  employeeFormMode.value = 'create'
  editingEmployeeId.value = undefined
  employeeForm.value = {
    name: '',
    position: '',
    department: '',
    employmentType: 'full-time',
    status: 'active',
    joinedAt: DEMO_REFERENCE_DATE,
    isProjectBased: false,
    baseSalaryIdr: null,
    commissionRatePercent: null,
    phone: '',
    email: ''
  }
  isEmployeeFormOpen.value = true
}

function openEditEmployee (employee: Employee) {
  employeeFormMode.value = 'edit'
  editingEmployeeId.value = employee.id
  employeeForm.value = {
    name: employee.name,
    position: employee.position,
    department: employee.department,
    employmentType: employee.employmentType,
    status: employee.status,
    joinedAt: employee.joinedAt,
    isProjectBased: employee.baseSalaryIdr === 0,
    baseSalaryIdr: employee.baseSalaryIdr || null,
    commissionRatePercent: employee.commissionRatePercent ?? null,
    phone: employee.phone ?? '',
    email: employee.email ?? ''
  }
  isEmployeeFormOpen.value = true
}

const isEmployeeFormValid = computed(() => Boolean(
  employeeForm.value.name.trim() &&
  employeeForm.value.position.trim() &&
  employeeForm.value.department.trim() &&
  (employeeForm.value.isProjectBased || (employeeForm.value.baseSalaryIdr && employeeForm.value.baseSalaryIdr > 0))
))

function submitEmployeeForm () {
  if (!isEmployeeFormValid.value) { return }
  const payload = {
    name: employeeForm.value.name.trim(),
    position: employeeForm.value.position.trim(),
    department: employeeForm.value.department.trim(),
    employmentType: employeeForm.value.employmentType,
    status: employeeForm.value.status,
    joinedAt: employeeForm.value.joinedAt,
    baseSalaryIdr: employeeForm.value.isProjectBased ? 0 : Number(employeeForm.value.baseSalaryIdr),
    commissionRatePercent: employeeForm.value.commissionRatePercent ?? undefined,
    phone: employeeForm.value.phone.trim() || undefined,
    email: employeeForm.value.email.trim() || undefined
  }

  if (employeeFormMode.value === 'edit' && editingEmployeeId.value) {
    updateEmployee(editingEmployeeId.value, payload)
    refreshKey.value += 1
    isEmployeeFormOpen.value = false
    showToast('Perubahan disimpan', `"${payload.name}" diperbarui.`, 'success')
    return
  }

  addEmployee(payload)
  refreshKey.value += 1
  isEmployeeFormOpen.value = false
  showToast('Karyawan ditambahkan', `"${payload.name}" masuk ke data karyawan.`, 'success')
}

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

/* Dialog tambah insentif */
const isIncentiveFormOpen = ref(false)
const incentiveForm = ref({
  projectId: '',
  period: DEMO_REFERENCE_DATE.slice(0, 7),
  amountIdr: null as number | null,
  note: '',
  selectedEmployeeIds: [] as string[]
})

const incentiveSelectedProject = computed(() => PROJECTS.find(item => item.id === incentiveForm.value.projectId))

const incentiveCandidateEmployees = computed(() => {
  const project = incentiveSelectedProject.value
  if (!project) { return [] }
  const userIds = [project.ownerId, ...project.teamUserIds]
  const seen = new Set<string>()
  const result: Employee[] = []
  for (const userId of userIds) {
    const employee = getEmployeeByUserId(userId)
    if (employee && !seen.has(employee.id)) {
      seen.add(employee.id)
      result.push(employee)
    }
  }
  return result
})

/** Tarif dihitung balik dari nominal insentif vs nilai kontrak project — preview live di form, sama seperti yang dipakai `addIncentive`. */
const incentiveRatePreview = computed(() => {
  const baseAmountIdr = incentiveSelectedProject.value?.quotationAmountIdr
  if (!baseAmountIdr || !incentiveForm.value.amountIdr) { return undefined }
  return Math.round((incentiveForm.value.amountIdr / baseAmountIdr) * 10000) / 100
})

function openAddIncentive () {
  incentiveForm.value = {
    projectId: '',
    period: DEMO_REFERENCE_DATE.slice(0, 7),
    amountIdr: null,
    note: '',
    selectedEmployeeIds: []
  }
  isIncentiveFormOpen.value = true
}

function toggleIncentiveEmployee (employeeId: string) {
  const index = incentiveForm.value.selectedEmployeeIds.indexOf(employeeId)
  if (index === -1) { incentiveForm.value.selectedEmployeeIds.push(employeeId) } else { incentiveForm.value.selectedEmployeeIds.splice(index, 1) }
}

const isIncentiveFormValid = computed(() => Boolean(
  incentiveForm.value.projectId &&
  incentiveForm.value.period.trim() &&
  incentiveForm.value.selectedEmployeeIds.length &&
  incentiveForm.value.amountIdr && incentiveForm.value.amountIdr > 0
))

function submitIncentiveForm () {
  if (!isIncentiveFormValid.value) { return }
  for (const employeeId of incentiveForm.value.selectedEmployeeIds) {
    addIncentive({
      projectId: incentiveForm.value.projectId,
      employeeId,
      period: incentiveForm.value.period.trim(),
      amountIdr: Number(incentiveForm.value.amountIdr),
      note: incentiveForm.value.note.trim() || undefined
    })
  }
  refreshKey.value += 1
  isIncentiveFormOpen.value = false
  showToast('Insentif ditambahkan', `Insentif tercatat untuk ${incentiveForm.value.selectedEmployeeIds.length} orang.`, 'success')
}

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

/* Dialog edit baris payroll — hanya saat payroll run masih draft. */
const isPayrollLineFormOpen = ref(false)
const editingPayrollLineId = ref<string | undefined>()
const editingPayrollLineEmployeeName = ref('')
const payrollLineForm = ref({
  baseSalaryIdr: null as number | null,
  allowanceIdr: null as number | null,
  deductionIdr: null as number | null
})

function openEditPayrollLine (line: PayrollLineComputed) {
  editingPayrollLineId.value = line.id
  editingPayrollLineEmployeeName.value = line.employee?.name ?? line.employeeId
  payrollLineForm.value = {
    baseSalaryIdr: line.baseSalaryIdr,
    allowanceIdr: line.allowanceIdr,
    deductionIdr: line.deductionIdr
  }
  isPayrollLineFormOpen.value = true
}

const isPayrollLineFormValid = computed(() => Boolean(
  payrollLineForm.value.baseSalaryIdr !== null && payrollLineForm.value.baseSalaryIdr >= 0 &&
  payrollLineForm.value.allowanceIdr !== null && payrollLineForm.value.allowanceIdr >= 0 &&
  payrollLineForm.value.deductionIdr !== null && payrollLineForm.value.deductionIdr >= 0
))

function submitPayrollLineForm () {
  if (!isPayrollLineFormValid.value || !editingPayrollLineId.value) { return }
  updatePayrollLine(editingPayrollLineId.value, {
    baseSalaryIdr: Number(payrollLineForm.value.baseSalaryIdr),
    allowanceIdr: Number(payrollLineForm.value.allowanceIdr),
    deductionIdr: Number(payrollLineForm.value.deductionIdr)
  })
  refreshKey.value += 1
  isPayrollLineFormOpen.value = false
  showToast('Payroll diperbarui', `Baris payroll "${editingPayrollLineEmployeeName.value}" diperbarui.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Human Resource Management"
      description="Data karyawan, absensi & payroll, komisi & insentif, performance dan productivity tracking."
      :breadcrumb="[{ label: 'Human Resource' }]"
    >
      <template v-if="canManageEmployees" #actions>
        <Button size="sm" @click="openCreateEmployee">
          <Plus class="h-4 w-4 mr-1.5" />
          Tambah Karyawan
        </Button>
      </template>
    </PageHeader>

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
                  <TableHead v-if="canManageEmployees" class="text-right">
                    Aksi
                  </TableHead>
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
                  <TableCell v-if="canManageEmployees" class="text-right">
                    <Button variant="outline" size="sm" @click="openEditEmployee(employee)">
                      <Pencil class="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
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
                  <TableHead v-if="canManagePayroll && activePayrollRun.status !== 'paid'" class="text-right">
                    Aksi
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
                  <TableCell v-if="canManagePayroll && activePayrollRun.status !== 'paid'" class="text-right">
                    <Button variant="outline" size="sm" @click="openEditPayrollLine(line)">
                      <Pencil class="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="commissions" class="pt-4 space-y-4">
          <div v-if="canManagePayroll" class="flex justify-end">
            <Button size="sm" @click="openAddIncentive">
              <Plus class="h-4 w-4 mr-1.5" />
              Tambah Insentif
            </Button>
          </div>

          <SectionCard description="Komisi diturunkan dari nilai kontrak project yang dipegang karyawan dan tarif komisinya masing-masing. Insentif dicatat manual per project dan orangnya.">
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
                  <TableHead>Tipe</TableHead>
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
                    {{ record.baseAmountIdr ? formatCurrencyIdr(record.baseAmountIdr) : '—' }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ record.baseAmountIdr ? `${record.ratePercent}%` : '—' }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold text-foreground">
                    {{ formatCurrencyIdr(record.amountIdr) }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="record.source === 'manual' ? 'Insentif' : 'Otomatis'"
                      :tone="record.source === 'manual' ? 'purple' : 'neutral'"
                    />
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

      <Dialog v-model:open="isEmployeeFormOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ employeeFormMode === 'edit' ? 'Edit Karyawan' : 'Tambah Karyawan Baru' }}</DialogTitle>
            <DialogDescription>
              {{ employeeFormMode === 'edit' ? 'Perbarui data karyawan.' : 'Karyawan baru langsung masuk ke data karyawan MANOVA.' }}
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>Nama Karyawan</Label>
              <Input v-model="employeeForm.name" placeholder="mis. Rani Kusuma" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Posisi</Label>
                <Input v-model="employeeForm.position" placeholder="mis. Sales Executive" />
              </div>
              <div class="space-y-1.5">
                <Label>Departemen</Label>
                <Input v-model="employeeForm.department" placeholder="mis. Sales" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Tipe Kepegawaian</Label>
                <select v-model="employeeForm.employmentType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="type in EMPLOYMENT_TYPES" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label>Status</Label>
                <select v-model="employeeForm.status" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="status in EMPLOYEE_STATUSES" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="space-y-1.5">
              <Label>Tanggal Bergabung</Label>
              <Input v-model="employeeForm.joinedAt" type="date" />
            </div>
            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="employeeForm.isProjectBased" />Gaji per proyek (tanpa nominal tetap)
              </label>
              <template v-if="!employeeForm.isProjectBased">
                <Label>Gaji Pokok (IDR)</Label>
                <Input v-model.number="employeeForm.baseSalaryIdr" type="number" placeholder="0" />
              </template>
              <p v-else class="text-xs text-muted-foreground">
                Karyawan ini dibayar per proyek — tidak ada gaji pokok tetap tiap bulan.
              </p>
            </div>
            <div class="space-y-1.5">
              <Label>Komisi % (opsional)</Label>
              <Input v-model.number="employeeForm.commissionRatePercent" type="number" step="0.1" placeholder="mis. 2" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Telepon (opsional)</Label>
                <Input v-model="employeeForm.phone" placeholder="0812-xxxx-xxxx" />
              </div>
              <div class="space-y-1.5">
                <Label>Email (opsional)</Label>
                <Input v-model="employeeForm.email" type="email" placeholder="nama@manova.id" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="isEmployeeFormOpen = false">
              Batal
            </Button>
            <Button :disabled="!isEmployeeFormValid" @click="submitEmployeeForm">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isPayrollLineFormOpen">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Payroll — {{ editingPayrollLineEmployeeName }}</DialogTitle>
            <DialogDescription>Komisi diturunkan otomatis dari project dan tidak bisa diedit di sini.</DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>Gaji Pokok (IDR)</Label>
              <Input v-model.number="payrollLineForm.baseSalaryIdr" type="number" placeholder="0" />
            </div>
            <div class="space-y-1.5">
              <Label>Tunjangan (IDR)</Label>
              <Input v-model.number="payrollLineForm.allowanceIdr" type="number" placeholder="0" />
            </div>
            <div class="space-y-1.5">
              <Label>Potongan (IDR)</Label>
              <Input v-model.number="payrollLineForm.deductionIdr" type="number" placeholder="0" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="isPayrollLineFormOpen = false">
              Batal
            </Button>
            <Button :disabled="!isPayrollLineFormValid" @click="submitPayrollLineForm">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isIncentiveFormOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Insentif</DialogTitle>
            <DialogDescription>Insentif manual untuk satu atau beberapa orang di sebuah project. Langsung berstatus disetujui.</DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>Project</Label>
              <select v-model="incentiveForm.projectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="" disabled>
                  Pilih project
                </option>
                <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </select>
            </div>

            <div v-if="incentiveForm.projectId" class="space-y-1.5">
              <Label>Orang</Label>
              <div v-if="incentiveCandidateEmployees.length" class="space-y-1.5 rounded-lg border border-border p-2.5 max-h-40 overflow-y-auto">
                <label v-for="employee in incentiveCandidateEmployees" :key="employee.id" class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox
                    :model-value="incentiveForm.selectedEmployeeIds.includes(employee.id)"
                    @update:model-value="toggleIncentiveEmployee(employee.id)"
                  />
                  {{ employee.name }}
                  <span class="text-xs text-muted-foreground">· {{ employee.position }}</span>
                </label>
              </div>
              <p v-else class="text-xs text-muted-foreground">
                Project ini belum punya owner/tim yang tertaut ke data karyawan.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Periode</Label>
                <Input v-model="incentiveForm.period" placeholder="2026-07" />
              </div>
              <div class="space-y-1.5">
                <Label>Nominal per Orang (IDR)</Label>
                <Input v-model.number="incentiveForm.amountIdr" type="number" placeholder="0" />
                <p v-if="incentiveRatePreview !== undefined" class="text-xs text-muted-foreground">
                  Setara {{ incentiveRatePreview }}% dari nilai kontrak project ({{ formatCurrencyIdr(incentiveSelectedProject?.quotationAmountIdr ?? 0) }}).
                </p>
              </div>
            </div>

            <div class="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input v-model="incentiveForm.note" placeholder="mis. Bonus penutupan project tepat waktu" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="isIncentiveFormOpen = false">
              Batal
            </Button>
            <Button :disabled="!isIncentiveFormValid" @click="submitIncentiveForm">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
