<script setup lang="ts">
import { ref, computed } from 'vue'
import { cn } from '~/lib/utils'
import { Plus, Search, MoreHorizontal, Calendar, Flag, SlidersHorizontal, X, ChevronDown } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const tasks = [
  {
    id: 1,
    title: 'Complete wireframes for mobile app',
    description: 'Create high-fidelity wireframes for all main screens',
    project: 'Mobile Banking App',
    priority: 'high',
    status: 'in-progress',
    dueDate: 'Today',
    assignee: { name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop&crop=face', initials: 'SC' },
    labels: ['Design', 'Mobile'],
  },
  {
    id: 2,
    title: 'Review API documentation',
    description: 'Go through the API specs and provide feedback',
    project: 'E-commerce Platform',
    priority: 'medium',
    status: 'pending',
    dueDate: 'Tomorrow',
    assignee: { name: 'Mike Johnson', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face', initials: 'MJ' },
    labels: ['Development', 'API'],
  },
  {
    id: 3,
    title: 'Client presentation prep',
    description: 'Prepare slides and demo for stakeholder meeting',
    project: 'Healthcare Portal',
    priority: 'high',
    status: 'pending',
    dueDate: 'Jan 18',
    assignee: { name: 'Emily Davis', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face', initials: 'ED' },
    labels: ['Meeting', 'Presentation'],
  },
  {
    id: 4,
    title: 'Bug fixes for checkout flow',
    description: 'Fix payment validation and cart update issues',
    project: 'E-commerce Platform',
    priority: 'critical',
    status: 'overdue',
    dueDate: 'Overdue',
    assignee: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face', initials: 'AT' },
    labels: ['Bug', 'Critical'],
  },
  {
    id: 5,
    title: 'User testing session',
    description: 'Conduct usability testing with 5 participants',
    project: 'SaaS Dashboard',
    priority: 'medium',
    status: 'pending',
    dueDate: 'Jan 20',
    assignee: { name: 'Jessica Lee', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=32&h=32&fit=crop&crop=face', initials: 'JL' },
    labels: ['Research', 'UX'],
  },
  {
    id: 6,
    title: 'Database optimization',
    description: 'Optimize slow queries and add proper indexing',
    project: 'Healthcare Portal',
    priority: 'low',
    status: 'completed',
    dueDate: 'Completed',
    assignee: { name: 'Mike Johnson', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face', initials: 'MJ' },
    labels: ['Backend', 'Performance'],
  },
]

const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'text-destructive' },
  high:     { label: 'High',     className: 'text-warning' },
  medium:   { label: 'Medium',   className: 'text-primary' },
  low:      { label: 'Low',      className: 'text-muted-foreground' },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  'in-progress': { label: 'In Progress', className: 'bg-primary/10 text-primary' },
  'pending':     { label: 'Pending',     className: 'bg-muted text-muted-foreground' },
  'overdue':     { label: 'Overdue',     className: 'bg-destructive/10 text-destructive' },
  'completed':   { label: 'Completed',  className: 'bg-success/10 text-success' },
}

const projects = [...new Set(tasks.map(t => t.project))]

// ── Filter state ───────────────────────────────────────────────────────────
const searchQuery      = ref('')
const selectedStatus   = ref('all')
const selectedPriority = ref('all')
const selectedProject  = ref('all')
const showFilters      = ref(false)

const activeFilterCount = computed(() =>
  (selectedStatus.value !== 'all' ? 1 : 0) +
  (selectedPriority.value !== 'all' ? 1 : 0) +
  (selectedProject.value !== 'all' ? 1 : 0)
)

const filteredTasks = computed(() => {
  let result = tasks

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.project.toLowerCase().includes(q) ||
      t.assignee.name.toLowerCase().includes(q)
    )
  }

  if (selectedStatus.value !== 'all')
    result = result.filter(t => t.status === selectedStatus.value)

  if (selectedPriority.value !== 'all')
    result = result.filter(t => t.priority === selectedPriority.value)

  if (selectedProject.value !== 'all')
    result = result.filter(t => t.project === selectedProject.value)

  return result
})

function clearFilters() {
  searchQuery.value      = ''
  selectedStatus.value   = 'all'
  selectedPriority.value = 'all'
  selectedProject.value  = 'all'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">Tasks</h1>
        <p class="text-sm text-muted-foreground mt-1">Track and manage all your tasks</p>
      </div>
      <Button class="gap-2">
        <Plus class="h-4 w-4" />
        New Task
      </Button>
    </div>

    <!-- Search + Filter bar -->
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <div class="relative flex-1 max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            v-model="searchQuery"
            placeholder="Search tasks..."
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
        <div v-if="showFilters" class="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Filter by</span>

          <!-- Status -->
          <div class="relative">
            <select
              v-model="selectedStatus"
              class="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="in-progress">In Progress</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
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

          <!-- Project -->
          <div class="relative">
            <select
              v-model="selectedProject"
              class="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="all">All Projects</option>
              <option v-for="p in projects" :key="p" :value="p">{{ p }}</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <!-- Active chips -->
          <div class="flex items-center gap-2 flex-wrap">
            <span
              v-if="selectedStatus !== 'all'"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium"
            >
              {{ statusConfig[selectedStatus]?.label }}
              <button @click="selectedStatus = 'all'"><X class="h-3 w-3" /></button>
            </span>
            <span
              v-if="selectedPriority !== 'all'"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-warning/10 text-warning font-medium"
            >
              {{ priorityConfig[selectedPriority]?.label }}
              <button @click="selectedPriority = 'all'"><X class="h-3 w-3" /></button>
            </span>
            <span
              v-if="selectedProject !== 'all'"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground font-medium"
            >
              {{ selectedProject }}
              <button @click="selectedProject = 'all'"><X class="h-3 w-3" /></button>
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Results count -->
    <div v-if="searchQuery || activeFilterCount > 0" class="flex items-center gap-2">
      <p class="text-sm text-muted-foreground">
        Showing <span class="font-medium text-foreground">{{ filteredTasks.length }}</span> of
        <span class="font-medium text-foreground">{{ tasks.length }}</span> tasks
      </p>
    </div>

    <!-- Task List -->
    <div class="bg-card rounded-xl card-shadow">
      <!-- Empty state -->
      <div v-if="filteredTasks.length === 0" class="flex flex-col items-center justify-center py-20">
        <div class="p-4 rounded-full bg-muted mb-4">
          <Search class="h-8 w-8 text-muted-foreground" />
        </div>
        <p class="text-sm font-medium text-foreground">No tasks found</p>
        <p class="text-xs text-muted-foreground mt-1 mb-4">Try adjusting your search or filters</p>
        <button @click="clearFilters" class="text-xs text-primary hover:underline font-medium">Clear all filters</button>
      </div>

      <div v-else class="divide-y divide-border">
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          class="p-4 hover:bg-muted/50 transition-colors animate-fade-in"
        >
          <div class="flex items-start gap-4">
            <Checkbox :checked="task.status === 'completed'" class="mt-1" />
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 :class="cn(
                    'text-sm font-medium',
                    task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'
                  )">
                    {{ task.title }}
                  </h3>
                  <p class="text-sm text-muted-foreground mt-1">{{ task.description }}</p>
                  <div class="flex items-center gap-3 mt-3">
                    <span class="text-xs text-muted-foreground">{{ task.project }}</span>
                    <div class="flex items-center gap-1.5">
                      <Badge
                        v-for="label in task.labels"
                        :key="label"
                        variant="secondary"
                        class="text-xs bg-muted hover:bg-muted"
                      >
                        {{ label }}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-4 shrink-0">
                  <Flag :class="cn('h-4 w-4', priorityConfig[task.priority].className)" />
                  <Badge variant="secondary" :class="statusConfig[task.status].className">
                    {{ statusConfig[task.status].label }}
                  </Badge>
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar class="h-4 w-4" />
                    <span :class="cn(task.status === 'overdue' && 'text-destructive font-medium')">
                      {{ task.dueDate }}
                    </span>
                  </div>
                  <Avatar class="h-8 w-8">
                    <AvatarImage :src="task.assignee.avatar" />
                    <AvatarFallback>{{ task.assignee.initials }}</AvatarFallback>
                  </Avatar>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <MoreHorizontal class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
