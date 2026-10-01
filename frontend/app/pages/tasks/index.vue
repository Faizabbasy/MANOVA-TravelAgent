<script setup lang="ts">
import TasksPanel from '~/components/operations/TasksPanel.vue'

/** Menu sidebar baru "Tugas" — agregasi `TASKS` lintas SEMUA project (data sudah global, tidak ada
 * entity baru), read-only + drill-down ke tab Tasks tiap project (tambah/edit tetap di sana, supaya
 * tidak ada dua tempat mengelola task yang sama). */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Tugas' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Tugas"
      description="Papan tugas lintas seluruh project — geser kartu antar kolom untuk ubah status."
      :breadcrumb="[{ label: 'Tugas' }]"
    />

    <TasksPanel />
  </div>
</template>
