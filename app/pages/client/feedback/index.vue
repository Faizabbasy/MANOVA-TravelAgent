<script setup lang="ts">
import { computed } from 'vue'
import { Star } from 'lucide-vue-next'
import { getProjectsByParty, getFeedbackByProject } from '~/data'
import { FEEDBACK_STATUSES, findStatusOption } from '~/constants/status'
import { formatDateRange } from '~/utils/format'

/**
 * Feedback & Evaluation — List (Repair Phase Section 7 — Insights & Company, Master Prompt bagian 17).
 * Satu `Feedback` per Project Order (`getFeedbackByProject`, existing selector Section 1) — list ini
 * menampilkan seluruh Project Order company dengan status feedback masing-masing.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Feedback & Evaluation' })

const { canView, clientScopeId } = usePermissions()

const rows = computed(() => {
  const projects = clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []
  return projects
    .map(project => ({ project, feedback: getFeedbackByProject(project.id) }))
    .sort((a, b) => b.project.travelStartDate.localeCompare(a.project.travelStartDate))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Feedback & Evaluation"
      description="Berikan penilaian atas layanan yang sudah Anda terima untuk setiap Project Order."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Insights' }, { label: 'Feedback & Evaluation' }]"
    />

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <ul v-if="rows.length" class="divide-y divide-border">
          <li v-for="row in rows" :key="row.project.id">
            <NuxtLink :to="`/client/feedback/${row.project.id}`" class="py-3 flex items-center justify-between gap-3 group block">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ row.project.name }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ row.project.destination }} · {{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span v-if="row.feedback?.overallExperience" class="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star class="h-3.5 w-3.5 fill-warning text-warning" />{{ row.feedback.overallExperience }}/5
                </span>
                <StatusBadge :label="findStatusOption(FEEDBACK_STATUSES, row.feedback?.status ?? 'not-started').label" :tone="findStatusOption(FEEDBACK_STATUSES, row.feedback?.status ?? 'not-started').tone" />
              </div>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="Star" title="Belum ada Project Order" description="Feedback akan tampil di sini setelah Project Order Anda tersedia." />
      </SectionCard>
    </template>
  </div>
</template>
