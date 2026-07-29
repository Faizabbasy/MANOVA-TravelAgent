<script setup lang="ts">
import { ref, computed } from 'vue'
import { cn } from '~/lib/utils'
import { Plus, Search, Filter, MoreHorizontal, Calendar, Users, DollarSign, X, SlidersHorizontal, ChevronDown } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const projects = [
  {
    id: 'PRJ-001',
    name: 'E-commerce Platform Redesign',
    description: 'Complete redesign of the shopping experience with modern UI/UX',
    client: 'TechCorp Inc.',
    status: 'in-progress',
    priority: 'high',
    budget: 45000,
    spent: 38500,
    progress: 72,
    dueDate: 'Feb 15, 2025',
    team: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face',
    ],
    tasks: { completed: 24, total: 32 },
  },
  {
    id: 'PRJ-002',
    name: 'Mobile Banking App',
    description: 'iOS and Android banking application with biometric authentication',
    client: 'FinanceFirst',
    status: 'at-risk',
    priority: 'critical',
    budget: 85000,
    spent: 92000,
    progress: 85,
    dueDate: 'Jan 30, 2025',
    team: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=32&h=32&fit=crop&crop=face',
    ],
    tasks: { completed: 45, total: 52 },
  },
  {
    id: 'PRJ-003',
    name: 'Healthcare Portal',
    description: 'Patient management system with appointment scheduling',
    client: 'MedLife',
    status: 'in-progress',
    priority: 'medium',
    budget: 62000,
    spent: 48000,
    progress: 58,
    dueDate: 'Mar 20, 2025',
    team: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face',
    ],
    tasks: { completed: 18, total: 38 },
  },
  {
    id: 'PRJ-004',
    name: 'SaaS Analytics Dashboard',
    description: 'Real-time analytics platform with custom reporting',
    client: 'DataDriven',
    status: 'planning',
    priority: 'low',
    budget: 38000,
    spent: 5500,
    progress: 15,
    dueDate: 'Apr 10, 2025',
    team: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=32&h=32&fit=crop&crop=face',
    ],
    tasks: { completed: 5, total: 42 },
  },
]

const statusConfig: Record<string, { label: string; className: string }> = {
  'in-progress': { label: 'In Progress', className: 'bg-primary/10 text-primary' },
  'at-risk':     { label: 'At Risk',     className: 'bg-destructive/10 text-destructive' },
  'planning':    { label: 'Planning',    className: 'bg-muted text-muted-foreground' },
  'completed':   { label: 'Completed',  className: 'bg-success/10 text-success' },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-destructive/10 text-destructive' },
  high:     { label: 'High',     className: 'bg-warning/10 text-warning' },
  medium:   { label: 'Medium',   className: 'bg-primary/10 text-primary' },
  low:      { label: 'Low',      className: 'bg-muted text-muted-foreground' },
}

// ── Filter state ───────────────────────────────────────────────────────────
const searchQuery      = ref('')
const selectedStatus   = ref('all')
const selectedPriority = ref('all')
const showFilters      = ref(false)

const activeFilterCount = computed(() =>
  (selectedStatus.value !== 'all' ? 1 : 0) +
  (selectedPriority.value !== 'all' ? 1 : 0)
)

const filteredProjects = computed(() => {
  let result = projects

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  }

  if (selectedStatus.value !== 'all') {
    result = result.filter(p => p.status === selectedStatus.value)
  }

  if (selectedPriority.value !== 'all') {
    result = result.filter(p => p.priority === selectedPriority.value)
  }

  return result
})

function clearFilters() {
  searchQuery.value      = ''
  selectedStatus.value   = 'all'
  selectedPriority.value = 'all'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">Projects</h1>
        <p class="text-sm text-muted-foreground mt-1">Manage and track all your agency projects</p>
      </div>
      <NuxtLink to="/projects/create">
        <Button class="gap-2 cursor-pointer">
          <Plus class="h-4 w-4" />
          New Project
        </Button>
      </NuxtLink>
    </div>

    <!-- Search + Filter bar -->
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <div class="relative flex-1 max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            v-model="searchQuery"
            placeholder="Search projects..."
            class="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
          />
        </div>

        <button
          @click="showFilters = !showFilters"
          :class="cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
            showFilters || activeFilterCount > 0
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-border hover:bg-muted text-foreground'
          )"
        >
          <SlidersHorizontal class="h-4 w-4" />
          Filters
          <span
            v-if="activeFilterCount > 0"
            class="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
          >
            {{ activeFilterCount }}
          </span>
        </button>

        <button
          v-if="activeFilterCount > 0 || searchQuery"
          @click="clearFilters"
          class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X class="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      <!-- Filter panel -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="showFilters" class="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Filter by</span>

          <!-- Status -->
          <div class="relative">
            <select
              v-model="selectedStatus"
              class="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="in-progress">In Progress</option>
              <option value="at-risk">At Risk</option>
              <option value="planning">Planning</option>
              <option value="completed">Completed</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <!-- Priority -->
          <div class="relative">
            <select
              v-model="selectedPriority"
              class="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <!-- Active filter chips -->
          <div class="flex items-center gap-2 flex-wrap">
            <span
              v-if="selectedStatus !== 'all'"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium"
            >
              {{ statusConfig[selectedStatus]?.label }}
              <button @click="selectedStatus = 'all'" class="hover:text-primary/70"><X class="h-3 w-3" /></button>
            </span>
            <span
              v-if="selectedPriority !== 'all'"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning/10 text-warning font-medium"
            >
              {{ priorityConfig[selectedPriority]?.label }}
              <button @click="selectedPriority = 'all'" class="hover:text-warning/70"><X class="h-3 w-3" /></button>
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Results count -->
    <div v-if="searchQuery || activeFilterCount > 0" class="flex items-center gap-2">
      <p class="text-sm text-muted-foreground">
        Showing <span class="font-medium text-foreground">{{ filteredProjects.length }}</span> of
        <span class="font-medium text-foreground">{{ projects.length }}</span> projects
      </p>
    </div>

    <!-- Project Grid -->
    <div v-if="filteredProjects.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <NuxtLink
        v-for="project in filteredProjects"
        :key="project.id"
        :to="`/projects/${project.id}`"
        class="bg-card rounded-xl p-6 card-shadow hover:card-shadow-lg transition-shadow cursor-pointer animate-fade-in block"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <Badge variant="secondary" :class="statusConfig[project.status].className">
                {{ statusConfig[project.status].label }}
              </Badge>
              <Badge variant="secondary" :class="priorityConfig[project.priority].className">
                {{ priorityConfig[project.priority].label }}
              </Badge>
            </div>
            <h3 class="text-lg font-semibold text-foreground">{{ project.name }}</h3>
            <p class="text-sm text-muted-foreground mt-1">{{ project.description }}</p>
          </div>
          <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" @click.prevent.stop>
            <MoreHorizontal class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Progress</span>
            <span class="font-medium text-foreground">{{ project.progress }}%</span>
          </div>
          <Progress :model-value="project.progress" class="h-2" />

          <div class="grid grid-cols-3 gap-4 pt-2">
            <div class="flex items-center gap-2">
              <DollarSign class="h-4 w-4 text-muted-foreground" />
              <div>
                <p class="text-xs text-muted-foreground">Budget</p>
                <p class="text-sm font-medium text-foreground">${{ (project.budget / 1000).toFixed(0) }}k</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Calendar class="h-4 w-4 text-muted-foreground" />
              <div>
                <p class="text-xs text-muted-foreground">Due</p>
                <p class="text-sm font-medium text-foreground">{{ project.dueDate.split(',')[0] }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Users class="h-4 w-4 text-muted-foreground" />
              <div>
                <p class="text-xs text-muted-foreground">Tasks</p>
                <p class="text-sm font-medium text-foreground">{{ project.tasks.completed }}/{{ project.tasks.total }}</p>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-border">
            <div class="flex -space-x-2">
              <img
                v-for="(avatar, i) in project.team.slice(0, 4)"
                :key="i"
                :src="avatar"
                alt=""
                class="w-8 h-8 rounded-full border-2 border-card"
              />
              <div
                v-if="project.team.length > 4"
                class="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground"
              >
                +{{ project.team.length - 4 }}
              </div>
            </div>
            <span class="text-sm text-muted-foreground">{{ project.client }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center py-20 bg-card rounded-xl card-shadow">
      <div class="p-4 rounded-full bg-muted mb-4">
        <Search class="h-8 w-8 text-muted-foreground" />
      </div>
      <p class="text-sm font-medium text-foreground">No projects found</p>
      <p class="text-xs text-muted-foreground mt-1 mb-4">Try adjusting your search or filters</p>
      <button @click="clearFilters" class="text-xs text-primary hover:underline font-medium">Clear all filters</button>
    </div>
  </div>
</template>
