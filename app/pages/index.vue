<script setup lang="ts">
import { FolderKanban, DollarSign, TrendingUp, AlertTriangle } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Cards Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <StatsCard
        title="Active Projects"
        value="12"
        :change="{ value: '2 new', trend: 'up' }"
        :icon="FolderKanban"
        icon-color="primary"
      />
      <StatsCard
        title="Total Budget"
        value="$284,500"
        :change="{ value: '12.5%', trend: 'up' }"
        :icon="DollarSign"
        icon-color="success"
      />
      <StatsCard
        title="Amount Spent"
        value="$198,240"
        :icon="TrendingUp"
        icon-color="warning"
        subtitle="69.7% of budget"
      />
      <StatsCard
        title="Net Profit"
        value="$86,260"
        :change="{ value: '8.2%', trend: 'up' }"
        :icon="DollarSign"
        icon-color="success"
      />
      <StatsCard
        title="Overdue Tasks"
        value="7"
        :change="{ value: '3 more', trend: 'down' }"
        :icon="AlertTriangle"
        icon-color="destructive"
      />
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <BudgetChart />
      </div>
      <ExpenseCategories />
    </div>

    <!-- Projects Table -->
    <ProjectsTable />

    <!-- Bottom Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <TasksOverview />
      <RecentActivity />
      <div class="space-y-6">
        <TeamMetrics />
        <AIAssistant />
      </div>
    </div>
  </div>
</template>
