<script setup lang="ts">
import { MoreHorizontal, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

const projects = [
  {
    id: 'PRJ-001',
    name: 'E-commerce Platform Redesign',
    client: 'TechCorp Inc.',
    budget: 45000,
    spent: 38500,
    status: 'on-track',
    progress: 72,
    health: 'healthy'
  },
  {
    id: 'PRJ-002',
    name: 'Mobile Banking App',
    client: 'FinanceFirst',
    budget: 85000,
    spent: 92000,
    status: 'over-budget',
    progress: 85,
    health: 'at-risk'
  },
  {
    id: 'PRJ-003',
    name: 'Healthcare Portal',
    client: 'MedLife',
    budget: 62000,
    spent: 48000,
    status: 'on-track',
    progress: 58,
    health: 'healthy'
  },
  {
    id: 'PRJ-004',
    name: 'SaaS Analytics Dashboard',
    client: 'DataDriven',
    budget: 38000,
    spent: 35500,
    status: 'at-risk',
    progress: 45,
    health: 'warning'
  },
  {
    id: 'PRJ-005',
    name: 'Restaurant Ordering System',
    client: 'FoodieHub',
    budget: 28000,
    spent: 24000,
    status: 'on-track',
    progress: 92,
    health: 'healthy'
  }
]

const statusConfig = {
  'on-track': { label: 'On Track', className: 'bg-success/10 text-success hover:bg-success/20' },
  'at-risk': { label: 'At Risk', className: 'bg-warning/10 text-warning hover:bg-warning/20' },
  'over-budget': { label: 'Over Budget', className: 'bg-destructive/10 text-destructive hover:bg-destructive/20' }
}

const healthConfig = {
  healthy: { icon: TrendingUp, className: 'text-success' },
  warning: { icon: Minus, className: 'text-warning' },
  'at-risk': { icon: TrendingDown, className: 'text-destructive' }
}
</script>

<template>
  <div class="bg-card rounded-xl card-shadow animate-fade-in">
    <div class="p-6 border-b border-border">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-foreground">
            Active Projects
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            Monitor project health and performance
          </p>
        </div>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
              Project
            </TableHead>
            <TableHead class="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
              Client
            </TableHead>
            <TableHead class="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
              Budget
            </TableHead>
            <TableHead class="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
              Spent
            </TableHead>
            <TableHead class="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
              Progress
            </TableHead>
            <TableHead class="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
              Status
            </TableHead>
            <TableHead class="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
              Health
            </TableHead>
            <TableHead class="px-6 py-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="project in projects"
            :key="project.id"
            class="hover:bg-muted/50 transition-colors"
          >
            <TableCell class="px-6 py-4">
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ project.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ project.id }}
                </p>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span class="text-sm text-foreground">{{ project.client }}</span>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span class="text-sm font-medium text-foreground">${{ project.budget.toLocaleString() }}</span>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span
                :class="cn(
                  'text-sm font-medium',
                  project.spent > project.budget ? 'text-destructive' : 'text-foreground'
                )"
              >
                ${{ project.spent.toLocaleString() }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="flex items-center gap-3">
                <Progress :model-value="project.progress" class="w-24 h-2" />
                <span class="text-sm text-muted-foreground">{{ project.progress }}%</span>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4">
              <Badge variant="secondary" :class="statusConfig[project.status].className">
                {{ statusConfig[project.status].label }}
              </Badge>
            </TableCell>
            <TableCell class="px-6 py-4">
              <component :is="healthConfig[project.health].icon" :class="cn('h-5 w-5', healthConfig[project.health].className)" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <Button variant="ghost" size="icon" class="h-8 w-8">
                <MoreHorizontal class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
