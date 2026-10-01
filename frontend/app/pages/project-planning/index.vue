<script setup lang="ts">
import ProjectPlanningPanel from '~/components/operations/ProjectPlanningPanel.vue'

/** Menu Operasional > Perencanaan Project — dulu tab "Perencanaan Peta" di halaman Kalender, sekarang
 * dipisah jadi menu sendiri per permintaan. Isinya dipindah apa adanya ke `ProjectPlanningPanel.vue`. */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Perencanaan Project' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Perencanaan Project"
      description="Peta perencanaan lokasi/destinasi lintas project."
      :breadcrumb="[{ label: 'Perencanaan Project' }]"
    />

    <ProjectPlanningPanel />
  </div>
</template>
