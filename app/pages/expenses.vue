<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { cn } from '~/lib/utils'
import {
  Plus, Search, MoreHorizontal, DollarSign, TrendingUp, TrendingDown,
  Clock, Receipt, Download, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, X, FileCheck, AlertCircle, Trash2,
  Eye, Pencil, Copy, CheckCircle2, XCircle, CheckCheck,
  Tag, Building2, FolderOpen, CalendarDays, Banknote,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

// ── Types ──────────────────────────────────────────────────────────────────
type Status = 'paid' | 'pending' | 'rejected'
type Category =
  | 'Software' | 'Travel' | 'Office' | 'Marketing'
  | 'Hardware' | 'Meals' | 'Training' | 'Contractors'

interface Expense {
  id: string
  date: string
  description: string
  vendor: string
  category: Category
  project: string
  amount: number
  status: Status
  hasReceipt: boolean
}

// ── Mock Data ──────────────────────────────────────────────────────────────
const allExpenses: Expense[] = [
  { id: 'EXP-001', date: '2025-01-15', description: 'Adobe Creative Cloud', vendor: 'Adobe Systems', category: 'Software', project: 'E-commerce Redesign', amount: 599.88, status: 'paid', hasReceipt: true },
  { id: 'EXP-002', date: '2025-01-14', description: 'Flight to NYC client meeting', vendor: 'Delta Airlines', category: 'Travel', project: 'Mobile Banking App', amount: 842.50, status: 'paid', hasReceipt: true },
  { id: 'EXP-003', date: '2025-01-13', description: 'Office supplies Q1', vendor: 'Staples', category: 'Office', project: 'Internal', amount: 234.75, status: 'pending', hasReceipt: false },
  { id: 'EXP-004', date: '2025-01-12', description: 'Google Ads campaign', vendor: 'Google LLC', category: 'Marketing', project: 'SaaS Dashboard', amount: 1500.00, status: 'paid', hasReceipt: true },
  { id: 'EXP-005', date: '2025-01-11', description: 'MacBook Pro M3', vendor: 'Apple Store', category: 'Hardware', project: 'Internal', amount: 2499.00, status: 'pending', hasReceipt: true },
  { id: 'EXP-006', date: '2025-01-10', description: 'Team lunch — sprint review', vendor: 'The Capital Grille', category: 'Meals', project: 'Healthcare Portal', amount: 387.20, status: 'paid', hasReceipt: true },
  { id: 'EXP-007', date: '2025-01-09', description: 'React Advanced Conference', vendor: 'GitNation', category: 'Training', project: 'Internal', amount: 749.00, status: 'rejected', hasReceipt: false },
  { id: 'EXP-008', date: '2025-01-08', description: 'Freelance UI designer', vendor: 'Dribble Hire', category: 'Contractors', project: 'E-commerce Redesign', amount: 3200.00, status: 'paid', hasReceipt: true },
  { id: 'EXP-009', date: '2025-01-07', description: 'Figma Organization', vendor: 'Figma Inc.', category: 'Software', project: 'E-commerce Redesign', amount: 360.00, status: 'paid', hasReceipt: true },
  { id: 'EXP-010', date: '2025-01-06', description: 'Hotel — client onsite', vendor: 'Marriott Bonvoy', category: 'Travel', project: 'Mobile Banking App', amount: 654.80, status: 'paid', hasReceipt: true },
  { id: 'EXP-011', date: '2025-01-05', description: 'AWS EC2 instances Jan', vendor: 'Amazon Web Services', category: 'Software', project: 'Healthcare Portal', amount: 1128.44, status: 'paid', hasReceipt: true },
  { id: 'EXP-012', date: '2025-01-04', description: 'Whiteboard & markers', vendor: 'IKEA', category: 'Office', project: 'Internal', amount: 129.99, status: 'paid', hasReceipt: false },
  { id: 'EXP-013', date: '2025-01-03', description: 'LinkedIn Ads — Q1 leads', vendor: 'LinkedIn Corp.', category: 'Marketing', project: 'SaaS Dashboard', amount: 2200.00, status: 'pending', hasReceipt: true },
  { id: 'EXP-014', date: '2025-01-03', description: 'Ergonomic chair x2', vendor: 'Herman Miller', category: 'Hardware', project: 'Internal', amount: 1890.00, status: 'pending', hasReceipt: true },
  { id: 'EXP-015', date: '2025-01-02', description: 'Working dinner — client', vendor: 'Nobu Restaurant', category: 'Meals', project: 'Mobile Banking App', amount: 523.40, status: 'rejected', hasReceipt: false },
  { id: 'EXP-016', date: '2025-01-02', description: 'Backend dev (40h)', vendor: 'Toptal LLC', category: 'Contractors', project: 'Healthcare Portal', amount: 5600.00, status: 'paid', hasReceipt: true },
  { id: 'EXP-017', date: '2025-01-01', description: 'Notion Teams annual', vendor: 'Notion Labs', category: 'Software', project: 'Internal', amount: 480.00, status: 'paid', hasReceipt: true },
  { id: 'EXP-018', date: '2024-12-31', description: 'GraphQL Summit ticket', vendor: 'Apollo GraphQL', category: 'Training', project: 'Internal', amount: 995.00, status: 'paid', hasReceipt: true },
  { id: 'EXP-019', date: '2024-12-30', description: 'Uber Eats — overtime team', vendor: 'Uber Eats', category: 'Meals', project: 'E-commerce Redesign', amount: 218.60, status: 'pending', hasReceipt: false },
  { id: 'EXP-020', date: '2024-12-28', description: 'Content writer (20h)', vendor: 'Upwork Inc.', category: 'Contractors', project: 'SaaS Dashboard', amount: 1800.00, status: 'paid', hasReceipt: true },
]

// ── Config maps ────────────────────────────────────────────────────────────
const statusConfig: Record<Status, { label: string; className: string; dot: string }> = {
  paid:     { label: 'Paid',     className: 'bg-success/10 text-success hover:bg-success/20',         dot: 'bg-success' },
  pending:  { label: 'Pending',  className: 'bg-warning/10 text-warning hover:bg-warning/20',         dot: 'bg-warning' },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive hover:bg-destructive/20', dot: 'bg-destructive' },
}

const categoryConfig: Record<Category, { color: string; bg: string }> = {
  Software:    { color: 'text-primary',            bg: 'bg-primary/10' },
  Travel:      { color: 'text-[hsl(var(--chart-5))]', bg: 'bg-[hsl(var(--chart-5)/0.1)]' },
  Office:      { color: 'text-muted-foreground',   bg: 'bg-muted' },
  Marketing:   { color: 'text-[hsl(var(--chart-4))]', bg: 'bg-[hsl(var(--chart-4)/0.1)]' },
  Hardware:    { color: 'text-warning',            bg: 'bg-warning/10' },
  Meals:       { color: 'text-success',            bg: 'bg-success/10' },
  Training:    { color: 'text-[hsl(var(--chart-3))]', bg: 'bg-[hsl(var(--chart-3)/0.1)]' },
  Contractors: { color: 'text-destructive',        bg: 'bg-destructive/10' },
}

const categories: Category[] = ['Software', 'Travel', 'Office', 'Marketing', 'Hardware', 'Meals', 'Training', 'Contractors']

// ── Reactive State ─────────────────────────────────────────────────────────
const searchQuery    = ref('')
const selectedCategory = ref<'all' | Category>('all')
const selectedStatus   = ref<'all' | Status>('all')
const sortColumn    = ref<string>('date')
const sortDirection  = ref<'asc' | 'desc'>('desc')
const currentPage   = ref(1)
const pageSize      = 8
const selectedRows  = ref<Set<string>>(new Set())

// ── Computed ───────────────────────────────────────────────────────────────
const filteredExpenses = computed(() => {
  let result = [...allExpenses]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(e =>
      e.description.toLowerCase().includes(q) ||
      e.vendor.toLowerCase().includes(q) ||
      e.project.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q)
    )
  }

  if (selectedCategory.value !== 'all') {
    result = result.filter(e => e.category === selectedCategory.value)
  }

  if (selectedStatus.value !== 'all') {
    result = result.filter(e => e.status === selectedStatus.value)
  }

  result.sort((a, b) => {
    const aVal = a[sortColumn.value]
    const bVal = b[sortColumn.value]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection.value === 'asc' ? aVal - bVal : bVal - aVal
    }
    const cmp = String(aVal).localeCompare(String(bVal))
    return sortDirection.value === 'asc' ? cmp : -cmp
  })

  return result
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredExpenses.value.length / pageSize)))

const paginatedExpenses = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredExpenses.value.slice(start, start + pageSize)
})

// Stats
const totalAmount   = computed(() => allExpenses.reduce((s, e) => s + e.amount, 0))
const paidAmount    = computed(() => allExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0))
const pendingCount  = computed(() => allExpenses.filter(e => e.status === 'pending').length)
const pendingAmount = computed(() => allExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0))
const avgAmount     = computed(() => totalAmount.value / allExpenses.length)

const hasActiveFilters = computed(() =>
  searchQuery.value.trim() !== '' ||
  selectedCategory.value !== 'all' ||
  selectedStatus.value !== 'all'
)

const allPageSelected = computed(() =>
  paginatedExpenses.value.length > 0 &&
  paginatedExpenses.value.every(e => selectedRows.value.has(e.id))
)

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function toggleSort(col: string) {
  if (sortColumn.value === col) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = col
    sortDirection.value = 'desc'
  }
  currentPage.value = 1
}

function clearFilters() {
  searchQuery.value = ''
  selectedCategory.value = 'all'
  selectedStatus.value = 'all'
  currentPage.value = 1
}

function toggleRow(id: string) {
  if (selectedRows.value.has(id)) {
    selectedRows.value.delete(id)
  } else {
    selectedRows.value.add(id)
  }
}

function toggleAllPage() {
  if (allPageSelected.value) {
    paginatedExpenses.value.forEach(e => selectedRows.value.delete(e.id))
  } else {
    paginatedExpenses.value.forEach(e => selectedRows.value.add(e.id))
  }
}

watch([searchQuery, selectedCategory, selectedStatus], () => {
  currentPage.value = 1
})

// ── Toast ──────────────────────────────────────────────────────────────────
interface Toast {
  id: number
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}
const toasts = ref<Toast[]>([])
let _toastId = 0

function showToast(title: string, message: string, type: Toast['type'] = 'success') {
  const id = ++_toastId
  toasts.value.push({ id, title, message, type })
  setTimeout(() => removeToast(id), 4000)
}
function removeToast(id: number) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

// ── Detail Modal ───────────────────────────────────────────────────────────
const detailExpense = ref<Expense | null>(null)
const isDetailOpen  = ref(false)

function openDetail(expense: Expense) {
  detailExpense.value = expense
  isDetailOpen.value  = true
}

// ── Delete Confirmation ────────────────────────────────────────────────────
const confirmDeleteExpense = ref<Expense | null>(null)
const isConfirmDeleteOpen  = ref(false)

function requestDelete(expense: Expense) {
  confirmDeleteExpense.value = expense
  isConfirmDeleteOpen.value  = true
}

function confirmDelete() {
  const expense = confirmDeleteExpense.value
  if (!expense) return
  isConfirmDeleteOpen.value  = false
  isDetailOpen.value         = false
  showToast(
    'Expense deleted',
    `${expense.id} · ${expense.description} has been removed.`,
    'error'
  )
  confirmDeleteExpense.value = null
}

function cancelDelete() {
  isConfirmDeleteOpen.value  = false
  confirmDeleteExpense.value = null
}

function handleDuplicate(expense: Expense) {
  showToast(
    'Expense duplicated',
    `A copy of ${expense.id} has been created as a draft.`,
    'info'
  )
}

function handleMarkPaid(expense: Expense) {
  showToast(
    'Status updated',
    `${expense.id} marked as paid.`,
    'success'
  )
}

function handleReject(expense: Expense) {
  showToast(
    'Expense rejected',
    `${expense.id} has been rejected.`,
    'warning'
  )
}

function handleDownload(expense: Expense) {
  if (!expense.hasReceipt) {
    showToast('No receipt', `${expense.id} doesn't have a receipt attached.`, 'warning')
    return
  }
  showToast('Downloading', `Receipt for ${expense.id} is being downloaded.`, 'info')
}
</script>

<template>
  <div>
  <div class="space-y-6">

    <!-- ── Page Header ─────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">Expenses</h1>
        <p class="text-sm text-muted-foreground mt-1">Track and manage all your business expenses</p>
      </div>
      <div class="flex items-center gap-3">
        <Button variant="outline" class="gap-2">
          <Download class="h-4 w-4" />
          Export
        </Button>
        <Button class="gap-2">
          <Plus class="h-4 w-4" />
          Add Expense
        </Button>
      </div>
    </div>

    <!-- ── Stats Cards ─────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total Expenses -->
      <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
        <div class="flex items-start justify-between">
          <div class="space-y-3">
            <p class="text-sm font-medium text-muted-foreground">Total Expenses</p>
            <div class="space-y-1">
              <p class="text-2xl font-bold text-foreground">{{ fmt(totalAmount) }}</p>
              <div class="flex items-center gap-1.5">
                <TrendingUp class="h-3.5 w-3.5 text-success" />
                <span class="text-xs font-medium text-success">12.4%</span>
                <span class="text-xs text-muted-foreground">vs last month</span>
              </div>
            </div>
          </div>
          <div class="p-3 rounded-xl bg-primary/10 text-primary">
            <DollarSign class="h-5 w-5" />
          </div>
        </div>
      </div>

      <!-- Paid This Month -->
      <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
        <div class="flex items-start justify-between">
          <div class="space-y-3">
            <p class="text-sm font-medium text-muted-foreground">Paid</p>
            <div class="space-y-1">
              <p class="text-2xl font-bold text-foreground">{{ fmt(paidAmount) }}</p>
              <p class="text-xs text-muted-foreground">{{ allExpenses.filter(e => e.status === 'paid').length }} transactions cleared</p>
            </div>
          </div>
          <div class="p-3 rounded-xl bg-success/10 text-success">
            <FileCheck class="h-5 w-5" />
          </div>
        </div>
      </div>

      <!-- Pending Approvals -->
      <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
        <div class="flex items-start justify-between">
          <div class="space-y-3">
            <p class="text-sm font-medium text-muted-foreground">Pending Approval</p>
            <div class="space-y-1">
              <p class="text-2xl font-bold text-foreground">{{ fmt(pendingAmount) }}</p>
              <div class="flex items-center gap-1.5">
                <span class="inline-flex h-2 w-2 rounded-full bg-warning animate-pulse" />
                <span class="text-xs text-muted-foreground">{{ pendingCount }} awaiting review</span>
              </div>
            </div>
          </div>
          <div class="p-3 rounded-xl bg-warning/10 text-warning">
            <Clock class="h-5 w-5" />
          </div>
        </div>
      </div>

      <!-- Average Transaction -->
      <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
        <div class="flex items-start justify-between">
          <div class="space-y-3">
            <p class="text-sm font-medium text-muted-foreground">Avg Transaction</p>
            <div class="space-y-1">
              <p class="text-2xl font-bold text-foreground">{{ fmt(avgAmount) }}</p>
              <div class="flex items-center gap-1.5">
                <TrendingDown class="h-3.5 w-3.5 text-success" />
                <span class="text-xs font-medium text-success">3.1%</span>
                <span class="text-xs text-muted-foreground">vs last month</span>
              </div>
            </div>
          </div>
          <div class="p-3 rounded-xl bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))]">
            <Receipt class="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>

    <!-- ── Table Card ──────────────────────────────────────────────────── -->
    <div class="bg-card rounded-xl card-shadow animate-fade-in">

      <!-- Toolbar -->
      <div class="p-5 border-b border-border">
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Search -->
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              placeholder="Search by description, vendor, project..."
              class="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-input bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
            />
          </div>

          <!-- Category filter -->
          <div class="relative">
            <select
              v-model="selectedCategory"
              class="w-full appearance-none pl-3 pr-9 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer min-w-36"
            >
              <option value="all">All Categories</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <!-- Status filter -->
          <div class="relative">
            <select
              v-model="selectedStatus"
              class="w-full appearance-none pl-3 pr-9 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer min-w-32"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <!-- Clear filters -->
          <button
            v-if="hasActiveFilters"
            @click="clearFilters"
            class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X class="h-3.5 w-3.5" />
            Clear
          </button>
        </div>

        <!-- Bulk action bar -->
        <div
          v-if="selectedRows.size > 0"
          class="flex items-center gap-3 mt-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg"
        >
          <span class="text-sm font-medium text-primary">{{ selectedRows.size }} selected</span>
          <div class="flex-1" />
          <button class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium">
            <Trash2 class="h-3.5 w-3.5" />
            Delete
          </button>
          <button class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors font-medium">
            <Download class="h-3.5 w-3.5" />
            Export selected
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border">
              <!-- Checkbox -->
              <th class="w-14 px-5 py-3.5 text-left">
                <input
                  type="checkbox"
                  :checked="allPageSelected"
                  @change="toggleAllPage"
                  class="h-4 w-4 rounded border-border text-primary cursor-pointer accent-primary"
                />
              </th>

              <!-- Sortable headers -->
              <th
                v-for="col in [
                  { key: 'date',        label: 'Date' },
                  { key: 'description', label: 'Description' },
                  { key: 'category',    label: 'Category' },
                  { key: 'project',     label: 'Project' },
                  { key: 'amount',      label: 'Amount' },
                  { key: 'status',      label: 'Status' },
                ]"
                :key="col.key"
                class="px-4 py-3.5 text-left"
              >
                <button
                  @click="toggleSort(col.key)"
                  :class="cn(
                    'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors select-none',
                    sortColumn === col.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )"
                >
                  {{ col.label }}
                  <span class="flex flex-col">
                    <ChevronUp
                      :class="cn('h-2.5 w-2.5 -mb-0.5', sortColumn === col.key && sortDirection === 'asc' ? 'text-primary' : 'text-muted-foreground/40')"
                    />
                    <ChevronDown
                      :class="cn('h-2.5 w-2.5', sortColumn === col.key && sortDirection === 'desc' ? 'text-primary' : 'text-muted-foreground/40')"
                    />
                  </span>
                </button>
              </th>

              <!-- Receipt + Actions -->
              <th class="w-20 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                Receipt
              </th>
              <th class="w-14 px-4 py-3.5" />
            </tr>
          </thead>

          <tbody>
            <!-- Empty state -->
            <tr v-if="paginatedExpenses.length === 0">
              <td colspan="9" class="py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="p-4 rounded-full bg-muted">
                    <AlertCircle class="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p class="text-sm font-medium text-foreground">No expenses found</p>
                  <p class="text-xs text-muted-foreground">Try adjusting your search or filters</p>
                  <button
                    @click="clearFilters"
                    class="mt-1 text-xs text-primary hover:underline font-medium"
                  >
                    Clear all filters
                  </button>
                </div>
              </td>
            </tr>

            <!-- Rows -->
            <tr
              v-for="expense in paginatedExpenses"
              :key="expense.id"
              :class="cn(
                'group border-b border-border/60 transition-colors',
                selectedRows.has(expense.id) ? 'bg-primary/[0.03]' : 'hover:bg-muted/40'
              )"
            >
              <!-- Checkbox -->
              <td class="px-5 py-4">
                <input
                  type="checkbox"
                  :checked="selectedRows.has(expense.id)"
                  @change="toggleRow(expense.id)"
                  class="h-4 w-4 rounded border-border text-primary cursor-pointer accent-primary"
                />
              </td>

              <!-- Date -->
              <td class="px-4 py-4 whitespace-nowrap">
                <div>
                  <p class="text-sm font-medium text-foreground">{{ fmtDate(expense.date) }}</p>
                  <p class="text-xs text-muted-foreground">{{ expense.id }}</p>
                </div>
              </td>

              <!-- Description -->
              <td class="px-4 py-4 max-w-[200px]">
                <p class="text-sm font-medium text-foreground truncate">{{ expense.description }}</p>
                <p class="text-xs text-muted-foreground truncate">{{ expense.vendor }}</p>
              </td>

              <!-- Category -->
              <td class="px-4 py-4">
                <span :class="cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  categoryConfig[expense.category].bg,
                  categoryConfig[expense.category].color
                )">
                  {{ expense.category }}
                </span>
              </td>

              <!-- Project -->
              <td class="px-4 py-4 max-w-[160px]">
                <p class="text-sm text-foreground truncate">{{ expense.project }}</p>
              </td>

              <!-- Amount -->
              <td class="px-4 py-4 whitespace-nowrap">
                <span :class="cn(
                  'text-sm font-semibold',
                  expense.status === 'rejected' ? 'text-muted-foreground line-through' : 'text-foreground'
                )">
                  {{ fmt(expense.amount) }}
                </span>
              </td>

              <!-- Status -->
              <td class="px-4 py-4">
                <span :class="cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                  statusConfig[expense.status].className
                )">
                  <span :class="cn('h-1.5 w-1.5 rounded-full', statusConfig[expense.status].dot)" />
                  {{ statusConfig[expense.status].label }}
                </span>
              </td>

              <!-- Receipt -->
              <td class="px-4 py-4 text-center">
                <span v-if="expense.hasReceipt" class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-success/10 text-success mx-auto">
                  <Receipt class="h-3.5 w-3.5" />
                </span>
                <span v-else class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted text-muted-foreground mx-auto">
                  <X class="h-3.5 w-3.5" />
                </span>
              </td>

              <!-- Actions -->
              <td class="px-4 py-4">
                <Popover>
                  <PopoverTrigger as-child>
                    <button :class="cn(
                      'flex items-center justify-center h-8 w-8 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100',
                    )">
                      <MoreHorizontal class="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent class="w-52 p-1.5 shadow-lg" align="end" :side-offset="4">
                    <!-- View Details -->
                    <button
                      @click="openDetail(expense)"
                      class="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-muted transition-colors text-foreground text-left"
                    >
                      <Eye class="h-4 w-4 text-muted-foreground" />
                      View details
                    </button>

                    <!-- Edit -->
                    <button
                      class="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-muted transition-colors text-foreground text-left"
                    >
                      <Pencil class="h-4 w-4 text-muted-foreground" />
                      Edit expense
                    </button>

                    <!-- Duplicate -->
                    <button
                      @click="handleDuplicate(expense)"
                      class="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-muted transition-colors text-foreground text-left"
                    >
                      <Copy class="h-4 w-4 text-muted-foreground" />
                      Duplicate
                    </button>

                    <!-- Download receipt -->
                    <button
                      @click="handleDownload(expense)"
                      :class="cn(
                        'flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md transition-colors text-left',
                        expense.hasReceipt
                          ? 'hover:bg-muted text-foreground'
                          : 'text-muted-foreground/50 cursor-not-allowed'
                      )"
                    >
                      <Download class="h-4 w-4 text-muted-foreground" />
                      Download receipt
                      <span v-if="!expense.hasReceipt" class="ml-auto text-xs text-muted-foreground/50">N/A</span>
                    </button>

                    <div class="my-1 h-px bg-border" />

                    <!-- Mark as Paid (only if not already paid) -->
                    <button
                      v-if="expense.status !== 'paid'"
                      @click="handleMarkPaid(expense)"
                      class="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-success/10 transition-colors text-success text-left"
                    >
                      <CheckCircle2 class="h-4 w-4" />
                      Mark as paid
                    </button>

                    <!-- Reject (only if pending) -->
                    <button
                      v-if="expense.status === 'pending'"
                      @click="handleReject(expense)"
                      class="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-warning/10 transition-colors text-warning text-left"
                    >
                      <XCircle class="h-4 w-4" />
                      Reject
                    </button>

                    <div class="my-1 h-px bg-border" />

                    <!-- Delete -->
                    <button
                      @click="requestDelete(expense)"
                      class="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-md hover:bg-destructive/10 transition-colors text-destructive text-left"
                    >
                      <Trash2 class="h-4 w-4" />
                      Delete
                    </button>
                  </PopoverContent>
                </Popover>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Pagination ─────────────────────────────────────────────────── -->
      <div class="flex items-center justify-between px-5 py-4 border-t border-border">
        <p class="text-sm text-muted-foreground">
          Showing
          <span class="font-medium text-foreground">
            {{ Math.min((currentPage - 1) * pageSize + 1, filteredExpenses.length) }}–{{ Math.min(currentPage * pageSize, filteredExpenses.length) }}
          </span>
          of
          <span class="font-medium text-foreground">{{ filteredExpenses.length }}</span>
          results
        </p>

        <div class="flex items-center gap-1">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            :class="cn(
              'flex items-center justify-center h-8 w-8 rounded-lg text-sm transition-colors',
              currentPage === 1
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>

          <template v-for="page in totalPages" :key="page">
            <button
              v-if="totalPages <= 7 || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1"
              @click="currentPage = page"
              :class="cn(
                'flex items-center justify-center h-8 min-w-8 px-2 rounded-lg text-sm font-medium transition-colors',
                page === currentPage
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )"
            >
              {{ page }}
            </button>
            <span
              v-else-if="(page === 2 && currentPage > 4) || (page === totalPages - 1 && currentPage < totalPages - 3)"
              class="flex items-center justify-center h-8 w-8 text-muted-foreground text-sm"
            >
              …
            </span>
          </template>

          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            :class="cn(
              'flex items-center justify-center h-8 w-8 rounded-lg text-sm transition-colors',
              currentPage === totalPages
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Toast Notifications ────────────────────────────────────────────── -->
  <Teleport to="body">
    <div class="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8 scale-95"
        enter-to-class="opacity-100 translate-x-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0 scale-100"
        leave-to-class="opacity-0 translate-x-8 scale-95"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="cn(
            'pointer-events-auto flex items-start gap-3 w-80 rounded-xl border p-4 shadow-lg',
            toast.type === 'success' && 'bg-card border-success/20',
            toast.type === 'error'   && 'bg-card border-destructive/20',
            toast.type === 'warning' && 'bg-card border-warning/20',
            toast.type === 'info'    && 'bg-card border-primary/20',
          )"
        >
          <!-- Icon -->
          <div :class="cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            toast.type === 'success' && 'bg-success/10 text-success',
            toast.type === 'error'   && 'bg-destructive/10 text-destructive',
            toast.type === 'warning' && 'bg-warning/10 text-warning',
            toast.type === 'info'    && 'bg-primary/10 text-primary',
          )">
            <CheckCheck  v-if="toast.type === 'success'" class="h-4 w-4" />
            <Trash2      v-else-if="toast.type === 'error'"   class="h-4 w-4" />
            <AlertCircle v-else-if="toast.type === 'warning'" class="h-4 w-4" />
            <Receipt     v-else class="h-4 w-4" />
          </div>
          <!-- Content -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-foreground">{{ toast.title }}</p>
            <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">{{ toast.message }}</p>
          </div>
          <!-- Close -->
          <button
            @click="removeToast(toast.id)"
            class="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>

  <!-- ── Delete Confirmation Dialog ───────────────────────────────────── -->
  <Dialog :open="isConfirmDeleteOpen" @update:open="val => { if (!val) cancelDelete() }">
    <DialogContent class="max-w-sm p-0 overflow-hidden gap-0">
      <div class="p-6">
        <!-- Icon -->
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <Trash2 class="h-6 w-6 text-destructive" />
        </div>

        <h3 class="text-base font-semibold text-foreground">Delete expense?</h3>
        <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          <template v-if="confirmDeleteExpense">
            <span class="font-medium text-foreground">{{ confirmDeleteExpense.description }}</span>
            ({{ confirmDeleteExpense.id }}) will be permanently deleted. This action cannot be undone.
          </template>
        </p>

        <div class="flex items-center justify-end gap-2.5 mt-6">
          <button
            @click="cancelDelete"
            class="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors text-foreground"
          >
            Cancel
          </button>
          <button
            @click="confirmDelete"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- ── Expense Detail Modal ───────────────────────────────────────────── -->
  <Dialog :open="isDetailOpen" @update:open="isDetailOpen = $event">
    <DialogContent class="max-w-xl p-0 overflow-hidden gap-0">
      <template v-if="detailExpense">
        <!-- Header -->
        <div class="px-6 pt-6 pb-5 border-b border-border">
          <div class="flex items-start justify-between gap-4 pr-6">
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{{ detailExpense.id }}</p>
              <h2 class="text-lg font-bold text-foreground leading-tight">{{ detailExpense.description }}</h2>
              <p class="text-sm text-muted-foreground mt-0.5">{{ detailExpense.vendor }}</p>
            </div>
            <span :class="cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 mt-1',
              statusConfig[detailExpense.status].className
            )">
              <span :class="cn('h-1.5 w-1.5 rounded-full', statusConfig[detailExpense.status].dot)" />
              {{ statusConfig[detailExpense.status].label }}
            </span>
          </div>

          <!-- Amount — prominent -->
          <div class="mt-5 flex items-end gap-2">
            <span class="text-4xl font-bold text-foreground">{{ fmt(detailExpense.amount) }}</span>
            <span :class="cn(
              'mb-1 text-xs font-medium px-2 py-0.5 rounded-md',
              detailExpense.status === 'rejected'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-success/10 text-success'
            )">
              {{ detailExpense.status === 'rejected' ? 'Not reimbursed' : 'Reimbursable' }}
            </span>
          </div>
        </div>

        <!-- Body -->
        <div class="px-6 py-5 space-y-5">
          <!-- Details grid -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <p class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CalendarDays class="h-3.5 w-3.5" />Date
              </p>
              <p class="text-sm font-medium text-foreground">{{ fmtDate(detailExpense.date) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 class="h-3.5 w-3.5" />Vendor
              </p>
              <p class="text-sm font-medium text-foreground">{{ detailExpense.vendor }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Tag class="h-3.5 w-3.5" />Category
              </p>
              <span :class="cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                categoryConfig[detailExpense.category].bg,
                categoryConfig[detailExpense.category].color
              )">{{ detailExpense.category }}</span>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FolderOpen class="h-3.5 w-3.5" />Project
              </p>
              <p class="text-sm font-medium text-foreground">{{ detailExpense.project }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Banknote class="h-3.5 w-3.5" />Amount
              </p>
              <p class="text-sm font-bold text-foreground">{{ fmt(detailExpense.amount) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Receipt class="h-3.5 w-3.5" />Receipt
              </p>
              <div class="flex items-center gap-1.5">
                <span :class="cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  detailExpense.hasReceipt ? 'text-success' : 'text-muted-foreground'
                )">
                  <CheckCircle2 v-if="detailExpense.hasReceipt" class="h-3.5 w-3.5" />
                  <XCircle v-else class="h-3.5 w-3.5" />
                  {{ detailExpense.hasReceipt ? 'Attached' : 'Not attached' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            @click="requestDelete(detailExpense); isDetailOpen = false"
            class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-destructive hover:bg-destructive/10 transition-colors font-medium"
          >
            <Trash2 class="h-4 w-4" />
            Delete
          </button>
          <div class="flex items-center gap-2">
            <button
              v-if="detailExpense.hasReceipt"
              @click="handleDownload(detailExpense)"
              class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors font-medium text-foreground"
            >
              <Download class="h-4 w-4" />
              Receipt
            </button>
            <button
              class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
            >
              <Pencil class="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>
      </template>
    </DialogContent>
  </Dialog>
  </div>
</template>
