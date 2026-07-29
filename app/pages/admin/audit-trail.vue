<script setup lang="ts">
import { ACTIVITIES, getProjectById } from '~/data'
import { formatDateTime } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Audit Trail' })

const { canView } = usePermissions()

const entries = [...ACTIVITIES].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Audit Trail"
      description="Log aktivitas lintas-project (basis: Activity & Changes tiap Project Detail)."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Audit Trail' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <SectionCard v-else>
      <EmptyState v-if="entries.length === 0" title="Belum ada aktivitas" />
      <ul v-else class="divide-y divide-border">
        <li v-for="entry in entries" :key="entry.id" class="py-3 flex items-start justify-between gap-4">
          <div>
            <p class="text-sm text-foreground">{{ entry.message }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ getProjectById(entry.projectId)?.name }} · {{ formatDateTime(entry.createdAt) }}
            </p>
          </div>
          <StatusBadge v-if="entry.isChange" label="Change" tone="warning" />
        </li>
      </ul>
    </SectionCard>
  </div>
</template>
