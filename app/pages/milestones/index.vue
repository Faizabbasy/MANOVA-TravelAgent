<script setup lang="ts">
import MilestonesPanel from '~/components/operations/MilestonesPanel.vue'

/** Menu sidebar baru "Milestones" — agregasi `PROJECT_MILESTONES` lintas SEMUA project (data sudah
 * global, tidak ada entity baru), dengan drill-down ke tab Milestone tiap project. Halaman tipis, logic
 * di `MilestonesPanel.vue` (pola sama `BookingCalendarPanel.vue` untuk menu Kalender). */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Milestones' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Milestones"
      description="Semua milestone project, lintas project, dalam satu tempat."
      :breadcrumb="[{ label: 'Milestones' }]"
    />

    <MilestonesPanel />
  </div>
</template>
