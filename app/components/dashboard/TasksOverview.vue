<script setup lang="ts">
import { CheckCircle2, Clock, AlertTriangle, Circle } from 'lucide-vue-next'
import { cn } from '~/lib/utils'

const tasks = [
  {
    id: 1,
    title: 'Complete wireframes for mobile app',
    project: 'Mobile Banking App',
    priority: 'high',
    dueDate: 'Today',
    status: 'in-progress'
  },
  {
    id: 2,
    title: 'Review API documentation',
    project: 'E-commerce Platform',
    priority: 'medium',
    dueDate: 'Tomorrow',
    status: 'pending'
  },
  {
    id: 3,
    title: 'Client presentation prep',
    project: 'Healthcare Portal',
    priority: 'high',
    dueDate: 'Jan 18',
    status: 'pending'
  },
  {
    id: 4,
    title: 'Bug fixes for checkout flow',
    project: 'E-commerce Platform',
    priority: 'critical',
    dueDate: 'Overdue',
    status: 'overdue'
  },
  {
    id: 5,
    title: 'User testing session',
    project: 'SaaS Dashboard',
    priority: 'medium',
    dueDate: 'Jan 20',
    status: 'pending'
  }
]

const priorityConfig = {
  critical: { label: 'Critical', className: 'bg-destructive/10 text-destructive' },
  high: { label: 'High', className: 'bg-warning/10 text-warning' },
  medium: { label: 'Medium', className: 'bg-primary/10 text-primary' },
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' }
}

const statusConfig = {
  'in-progress': { icon: Clock, className: 'text-primary' },
  pending: { icon: Circle, className: 'text-muted-foreground' },
  overdue: { icon: AlertTriangle, className: 'text-destructive' },
  completed: { icon: CheckCircle2, className: 'text-success' }
}
</script>

<template>
  <div class="bg-card rounded-xl card-shadow animate-fade-in">
    <div class="p-6 border-b border-border">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-foreground">
            Upcoming Tasks
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            Your priority tasks for this week
          </p>
        </div>
        <span class="text-sm text-muted-foreground">5 tasks</span>
      </div>
    </div>

    <div class="divide-y divide-border">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <div class="flex items-start gap-3">
          <component
            :is="statusConfig[task.status].icon"
            :class="cn('h-5 w-5 mt-0.5', statusConfig[task.status].className)"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-foreground">
              {{ task.title }}
            </p>
            <p class="text-xs text-muted-foreground mt-1">
              {{ task.project }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span :class="cn('text-xs font-medium px-2 py-1 rounded-full', priorityConfig[task.priority].className)">
              {{ priorityConfig[task.priority].label }}
            </span>
            <span
              :class="cn(
                'text-xs',
                task.status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'
              )"
            >
              {{ task.dueDate }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
