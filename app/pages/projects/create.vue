<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2,
  Briefcase, Calendar, DollarSign, Target,
  AlertCircle, ChevronDown
} from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const router = useRouter()

// ── Steps config ─────────────────────────────────────────────────────────────
const steps = [
  { id: 1, label: 'Basics', icon: Briefcase, description: 'Project name & info' },
  { id: 2, label: 'Planning', icon: Target, description: 'Timeline & priority' },
  { id: 3, label: 'Budget', icon: DollarSign, description: 'Financial details' }
]

const currentStep = ref(1)
const isSubmitting = ref(false)
const submitted = ref(false)

// ── Form state ────────────────────────────────────────────────────────────────
const form = ref({
  // Step 1
  name: '',
  description: '',
  client: '',
  category: '',
  department: '',

  // Step 2
  pm: '',
  status: 'planning',
  priority: 'medium',
  startDate: '',
  dueDate: '',
  objectives: [''],

  // Step 3
  contractValue: '',
  budget: ''
})

// ── Validation ────────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})

function validateStep (step: number): boolean {
  errors.value = {}
  if (step === 1) {
    if (!form.value.name.trim()) { errors.value.name = 'Project name is required' }
    if (!form.value.description.trim()) { errors.value.description = 'Description is required' }
    if (!form.value.client.trim()) { errors.value.client = 'Client name is required' }
    if (!form.value.category) { errors.value.category = 'Please select a category' }
  }
  if (step === 2) {
    if (!form.value.startDate) { errors.value.startDate = 'Start date is required' }
    if (!form.value.dueDate) { errors.value.dueDate = 'Due date is required' }
    if (form.value.startDate && form.value.dueDate && form.value.dueDate <= form.value.startDate) { errors.value.dueDate = 'Due date must be after start date' }
  }
  if (step === 3) {
    if (!form.value.budget) { errors.value.budget = 'Budget is required' }
    const b = parseFloat(form.value.budget)
    if (isNaN(b) || b <= 0) { errors.value.budget = 'Enter a valid budget amount' }
  }
  return Object.keys(errors.value).length === 0
}

// ── Navigation ────────────────────────────────────────────────────────────────
function nextStep () {
  if (!validateStep(currentStep.value)) { return }
  if (currentStep.value < steps.length) { currentStep.value++ }
}

function prevStep () {
  if (currentStep.value > 1) { currentStep.value-- }
}

// ── Objectives ────────────────────────────────────────────────────────────────
const filledObjectives = computed(() =>
  form.value.objectives.filter(o => o.trim())
)

function addObjective () {
  if (form.value.objectives.length < 6) { form.value.objectives.push('') }
}

function removeObjective (i: number) {
  if (form.value.objectives.length > 1) { form.value.objectives.splice(i, 1) }
}

// ── Priority & Status options ─────────────────────────────────────────────────
const priorityOptions = [
  { value: 'critical', label: 'Critical', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30' },
  { value: 'high', label: 'High', color: 'text-warning', bg: 'bg-warning/10 border-warning/30' },
  { value: 'medium', label: 'Medium', color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
  { value: 'low', label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted border-border' }
]

const statusOptions = [
  { value: 'planning', label: 'Planning' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'at-risk', label: 'At Risk' },
  { value: 'completed', label: 'Completed' }
]

const categoryOptions = [
  'Web Development',
  'Mobile App',
  'UI/UX Design',
  'Data Analytics',
  'Infrastructure',
  'Marketing',
  'Consulting',
  'Other'
]

const departmentOptions = [
  'Engineering',
  'Design',
  'Marketing',
  'Product',
  'Operations',
  'Finance',
  'Sales'
]

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit () {
  if (!validateStep(3)) { return }
  isSubmitting.value = true
  await new Promise(resolve => setTimeout(resolve, 1200))
  isSubmitting.value = false
  submitted.value = true
  await new Promise(resolve => setTimeout(resolve, 900))
  router.push('/projects')
}

// ── Progress ──────────────────────────────────────────────────────────────────
const progressPercent = computed(() =>
  ((currentStep.value - 1) / (steps.length - 1)) * 100
)

</script>

<template>
  <div class="max-w-3xl mx-auto py-2 pb-12">
    <!-- ── Back link ─────────────────────────────────────────────────────── -->
    <NuxtLink
      to="/projects"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to Projects
    </NuxtLink>

    <!-- ── Page title ─────────────────────────────────────────────────────── -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-foreground">
        Create New Project
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Fill in the details below to set up your new project.
      </p>
    </div>

    <!-- ── Step indicator ─────────────────────────────────────────────────── -->
    <div class="mb-8">
      <!-- Progress bar -->
      <div class="relative mb-6">
        <div class="h-1 bg-border rounded-full overflow-hidden">
          <div
            class="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
      </div>

      <!-- Step pills -->
      <div class="flex items-start gap-2">
        <div
          v-for="step in steps"
          :key="step.id"
          class="flex-1"
        >
          <div
            class="flex flex-col items-center gap-1.5 cursor-default"
            @click="step.id < currentStep && (currentStep = step.id)"
          >
            <!-- Circle -->
            <div
              :class="[
                'flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300 text-sm font-semibold',
                step.id < currentStep
                  ? 'border-primary bg-primary text-primary-foreground cursor-pointer'
                  : step.id === currentStep
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]'
                    : 'border-border bg-card text-muted-foreground',
              ]"
            >
              <Check v-if="step.id < currentStep" class="h-4 w-4" />
              <span v-else>{{ step.id }}</span>
            </div>
            <!-- Label -->
            <div class="text-center">
              <p
                :class="[
                  'text-xs font-semibold leading-tight',
                  step.id <= currentStep ? 'text-foreground' : 'text-muted-foreground',
                ]"
              >
                {{ step.label }}
              </p>
              <p class="text-[11px] text-muted-foreground leading-tight hidden sm:block">
                {{ step.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Form card ──────────────────────────────────────────────────────── -->
    <div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <!-- Step 1 — Basics ──────────────────────────────────────────────────── -->
      <Transition name="slide-fade" mode="out-in">
        <div v-if="currentStep === 1" key="step1" class="p-6 sm:p-8">
          <div class="flex items-center gap-3 mb-6">
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Briefcase class="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 class="text-base font-semibold text-foreground">
                Project Basics
              </h2>
              <p class="text-xs text-muted-foreground">
                Core information about your project
              </p>
            </div>
          </div>

          <div class="space-y-5">
            <!-- Project Name -->
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-foreground flex items-center gap-1">
                Project Name
                <span class="text-destructive">*</span>
              </label>
              <div class="relative">
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="e.g. E-commerce Platform Redesign"
                  maxlength="80"
                  :class="[
                    'w-full px-3 py-2.5 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all',
                    errors.name
                      ? 'border-destructive focus:ring-destructive/20'
                      : 'border-input focus:ring-primary/20 focus:border-primary',
                  ]"
                  @input="delete errors.name"
                >
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  {{ form.name.length }}/80
                </span>
              </div>
              <p v-if="errors.name" class="text-xs text-destructive flex items-center gap-1">
                <AlertCircle class="h-3 w-3" /> {{ errors.name }}
              </p>
            </div>

            <!-- Description -->
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-foreground flex items-center gap-1">
                Description
                <span class="text-destructive">*</span>
              </label>
              <textarea
                v-model="form.description"
                rows="3"
                maxlength="300"
                placeholder="Briefly describe the project scope and goals…"
                :class="[
                  'w-full px-3 py-2.5 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all resize-none',
                  errors.description
                    ? 'border-destructive focus:ring-destructive/20'
                    : 'border-input focus:ring-primary/20 focus:border-primary',
                ]"
                @input="delete errors.description"
              />
              <div class="flex items-start justify-between">
                <p v-if="errors.description" class="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle class="h-3 w-3" /> {{ errors.description }}
                </p>
                <span class="text-[11px] text-muted-foreground ml-auto">{{ form.description.length }}/300</span>
              </div>
            </div>

            <!-- Client -->
            <div class="space-y-1.5">
              <label class="text-sm font-medium text-foreground flex items-center gap-1">
                Client
                <span class="text-destructive">*</span>
              </label>
              <input
                v-model="form.client"
                type="text"
                placeholder="e.g. TechCorp Inc."
                :class="[
                  'w-full px-3 py-2.5 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all',
                  errors.client
                    ? 'border-destructive focus:ring-destructive/20'
                    : 'border-input focus:ring-primary/20 focus:border-primary',
                ]"
                @input="delete errors.client"
              >
              <p v-if="errors.client" class="text-xs text-destructive flex items-center gap-1">
                <AlertCircle class="h-3 w-3" /> {{ errors.client }}
              </p>
            </div>

            <!-- Category + Department (2 cols) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Category -->
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground flex items-center gap-1">
                  Category
                  <span class="text-destructive">*</span>
                </label>
                <div class="relative">
                  <select
                    v-model="form.category"
                    :class="[
                      'w-full appearance-none px-3 py-2.5 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 transition-all cursor-pointer',
                      !form.category ? 'text-muted-foreground' : '',
                      errors.category
                        ? 'border-destructive focus:ring-destructive/20'
                        : 'border-input focus:ring-primary/20 focus:border-primary',
                    ]"
                    @change="delete errors.category"
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    <option v-for="opt in categoryOptions" :key="opt" :value="opt">
                      {{ opt }}
                    </option>
                  </select>
                  <ChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p v-if="errors.category" class="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle class="h-3 w-3" /> {{ errors.category }}
                </p>
              </div>

              <!-- Department -->
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">Department</label>
                <div class="relative">
                  <select
                    v-model="form.department"
                    class="w-full appearance-none px-3 py-2.5 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                    :class="{ 'text-muted-foreground': !form.department }"
                  >
                    <option value="">
                      Select department
                    </option>
                    <option v-for="opt in departmentOptions" :key="opt" :value="opt">
                      {{ opt }}
                    </option>
                  </select>
                  <ChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Step 2 — Planning ────────────────────────────────────────────────── -->
      <Transition name="slide-fade" mode="out-in">
        <div v-if="currentStep === 2" key="step2" class="p-6 sm:p-8">
          <div class="flex items-center gap-3 mb-6">
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Target class="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 class="text-base font-semibold text-foreground">
                Planning
              </h2>
              <p class="text-xs text-muted-foreground">
                Timeline, priority and project objectives
              </p>
            </div>
          </div>

          <div class="space-y-5">
            <!-- PM + Status (2 cols) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">Project Manager</label>
                <input
                  v-model="form.pm"
                  type="text"
                  placeholder="e.g. Sarah Johnson"
                  class="w-full px-3 py-2.5 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
              </div>
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">Status</label>
                <div class="relative">
                  <select
                    v-model="form.status"
                    class="w-full appearance-none px-3 py-2.5 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  >
                    <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                  <ChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <!-- Priority — card radio group -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-foreground">Priority</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="opt in priorityOptions"
                  :key="opt.value"
                  type="button"
                  :class="[
                    'flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer',
                    form.priority === opt.value
                      ? `${opt.bg} ${opt.color}`
                      : 'border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted/50',
                  ]"
                  @click="form.priority = opt.value"
                >
                  <div
                    :class="[
                      'w-2.5 h-2.5 rounded-full',
                      opt.value === 'critical' ? 'bg-destructive' :
                      opt.value === 'high' ? 'bg-warning' :
                      opt.value === 'medium' ? 'bg-primary' : 'bg-muted-foreground',
                    ]"
                  />
                  {{ opt.label }}
                  <Check
                    v-if="form.priority === opt.value"
                    :class="['h-3 w-3', opt.color]"
                  />
                </button>
              </div>
            </div>

            <!-- Start Date + Due Date -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground flex items-center gap-1">
                  Start Date <span class="text-destructive">*</span>
                </label>
                <div class="relative">
                  <Calendar class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    v-model="form.startDate"
                    type="date"
                    :class="[
                      'w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 transition-all cursor-pointer',
                      errors.startDate
                        ? 'border-destructive focus:ring-destructive/20'
                        : 'border-input focus:ring-primary/20 focus:border-primary',
                    ]"
                    @change="delete errors.startDate"
                  >
                </div>
                <p v-if="errors.startDate" class="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle class="h-3 w-3" /> {{ errors.startDate }}
                </p>
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground flex items-center gap-1">
                  Due Date <span class="text-destructive">*</span>
                </label>
                <div class="relative">
                  <Calendar class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    v-model="form.dueDate"
                    type="date"
                    :min="form.startDate"
                    :class="[
                      'w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 transition-all cursor-pointer',
                      errors.dueDate
                        ? 'border-destructive focus:ring-destructive/20'
                        : 'border-input focus:ring-primary/20 focus:border-primary',
                    ]"
                    @change="delete errors.dueDate"
                  >
                </div>
                <p v-if="errors.dueDate" class="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle class="h-3 w-3" /> {{ errors.dueDate }}
                </p>
              </div>
            </div>

            <!-- Objectives -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-foreground">Objectives</label>
                <span class="text-xs text-muted-foreground">{{ filledObjectives.length }} added</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="(_, i) in form.objectives"
                  :key="i"
                  class="flex items-center gap-2 group"
                >
                  <div
                    class="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0"
                  >
                    {{ i + 1 }}
                  </div>
                  <input
                    v-model="form.objectives[i]"
                    type="text"
                    :placeholder="`Objective ${i + 1}…`"
                    class="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                  <button
                    v-if="form.objectives.length > 1"
                    type="button"
                    class="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                    @click="removeObjective(i)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <button
                v-if="form.objectives.length < 6"
                type="button"
                class="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer mt-1"
                @click="addObjective"
              >
                <Plus class="h-3.5 w-3.5" />
                Add objective
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Step 3 — Budget ──────────────────────────────────────────────────── -->
      <Transition name="slide-fade" mode="out-in">
        <div v-if="currentStep === 3" key="step3" class="p-6 sm:p-8">
          <div class="flex items-center gap-3 mb-6">
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <DollarSign class="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 class="text-base font-semibold text-foreground">
                Budget
              </h2>
              <p class="text-xs text-muted-foreground">
                Financial details and contract value
              </p>
            </div>
          </div>

          <div class="space-y-5">
            <!-- Contract Value + Budget -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">Contract Value</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">$</span>
                  <input
                    v-model="form.contractValue"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    class="w-full pl-7 pr-3 py-2.5 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                </div>
                <p class="text-xs text-muted-foreground">
                  Total contract amount with client
                </p>
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground flex items-center gap-1">
                  Project Budget <span class="text-destructive">*</span>
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">$</span>
                  <input
                    v-model="form.budget"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    :class="[
                      'w-full pl-7 pr-3 py-2.5 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all',
                      errors.budget
                        ? 'border-destructive focus:ring-destructive/20'
                        : 'border-input focus:ring-primary/20 focus:border-primary',
                    ]"
                    @input="delete errors.budget"
                  >
                </div>
                <p v-if="errors.budget" class="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle class="h-3 w-3" /> {{ errors.budget }}
                </p>
                <p v-else class="text-xs text-muted-foreground">
                  Internal budget allocated for this project
                </p>
              </div>
            </div>

            <!-- Summary card -->
            <div class="rounded-xl border border-border bg-muted/40 p-5 space-y-4">
              <h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
                <div class="w-1 h-4 bg-primary rounded-full" />
                Project Summary
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div class="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                  <span class="text-muted-foreground shrink-0">Name</span>
                  <span class="font-medium text-foreground text-right truncate max-w-[160px]">{{ form.name || '—' }}</span>
                </div>
                <div class="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                  <span class="text-muted-foreground shrink-0">Client</span>
                  <span class="font-medium text-foreground text-right truncate max-w-[160px]">{{ form.client || '—' }}</span>
                </div>
                <div class="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                  <span class="text-muted-foreground shrink-0">Category</span>
                  <span class="font-medium text-foreground text-right">{{ form.category || '—' }}</span>
                </div>
                <div class="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                  <span class="text-muted-foreground shrink-0">Priority</span>
                  <span
                    :class="[
                      'font-medium capitalize',
                      form.priority === 'critical' ? 'text-destructive' :
                      form.priority === 'high' ? 'text-warning' :
                      form.priority === 'medium' ? 'text-primary' : 'text-muted-foreground',
                    ]"
                  >{{ form.priority }}</span>
                </div>
                <div class="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                  <span class="text-muted-foreground shrink-0">Start</span>
                  <span class="font-medium text-foreground">{{ form.startDate || '—' }}</span>
                </div>
                <div class="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                  <span class="text-muted-foreground shrink-0">Due</span>
                  <span class="font-medium text-foreground">{{ form.dueDate || '—' }}</span>
                </div>
                <div class="flex items-start justify-between gap-2 sm:col-span-2 border-b border-border/50 pb-2">
                  <span class="text-muted-foreground shrink-0">Objectives</span>
                  <span class="font-medium text-foreground">{{ filledObjectives.length }} defined</span>
                </div>
              </div>
            </div>

            <!-- Budget margin indicator -->
            <div
              v-if="form.contractValue && form.budget"
              class="rounded-xl border border-border p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-muted-foreground">Budget vs Contract</span>
                <span
                  :class="[
                    'text-xs font-semibold',
                    parseFloat(form.budget) <= parseFloat(form.contractValue) ? 'text-success' : 'text-destructive',
                  ]"
                >
                  {{ parseFloat(form.budget) <= parseFloat(form.contractValue) ? 'Within contract' : 'Exceeds contract!' }}
                </span>
              </div>
              <div class="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  :class="[
                    'h-full rounded-full transition-all duration-500',
                    parseFloat(form.budget) <= parseFloat(form.contractValue) ? 'bg-success' : 'bg-destructive',
                  ]"
                  :style="{ width: Math.min((parseFloat(form.budget) / parseFloat(form.contractValue)) * 100, 100) + '%' }"
                />
              </div>
              <div class="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
                <span>Budget: ${{ parseFloat(form.budget).toLocaleString() }}</span>
                <span>Contract: ${{ parseFloat(form.contractValue).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ── Footer navigation ──────────────────────────────────────────────── -->
      <div class="px-6 sm:px-8 py-5 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
        <!-- Back / Cancel -->
        <button
          v-if="currentStep === 1"
          type="button"
          class="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 rounded-lg transition-all cursor-pointer"
          @click="router.push('/projects')"
        >
          Cancel
        </button>
        <button
          v-else
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 rounded-lg transition-all cursor-pointer"
          @click="prevStep"
        >
          <ArrowLeft class="h-4 w-4" />
          Back
        </button>

        <!-- Step counter (center) -->
        <span class="text-xs text-muted-foreground">Step {{ currentStep }} of {{ steps.length }}</span>

        <!-- Next / Submit -->
        <button
          v-if="currentStep < steps.length"
          type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
          @click="nextStep"
        >
          Continue
          <ArrowRight class="h-4 w-4" />
        </button>
        <button
          v-else
          type="button"
          :disabled="isSubmitting || submitted"
          :class="[
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer shadow-sm',
            submitted
              ? 'bg-success text-white'
              : isSubmitting
                ? 'bg-primary/70 text-primary-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
          ]"
          @click="handleSubmit"
        >
          <template v-if="submitted">
            <Check class="h-4 w-4" />
            Created!
          </template>
          <template v-else-if="isSubmitting">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creating…
          </template>
          <template v-else>
            <Check class="h-4 w-4" />
            Create Project
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

/* Date input color fix for dark mode */
input[type="date"]::-webkit-calendar-picker-indicator {
  opacity: 0.5;
  cursor: pointer;
  filter: invert(var(--tw-invert, 0));
}

/* Remove number input arrows */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] { -moz-appearance: textfield; }
</style>
