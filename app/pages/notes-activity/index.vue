<script setup lang="ts">
import NotesActivityPanel from '~/components/operations/NotesActivityPanel.vue'

/** Menu sidebar baru "Catatan/Aktivitas" — feed gabungan `ACTIVITIES` (Activity & Changes) dan
 * `SHIFT_NOTES` (On-Trip Updates) lintas SEMUA project (keduanya data yang sudah ada, tidak ada entity
 * baru), read-only + drill-down ke tab Activity & Changes tiap project. */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Catatan/Aktivitas' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Catatan/Aktivitas"
      description="Aktivitas, perubahan, dan shift note dari semua project, lintas project."
      :breadcrumb="[{ label: 'Catatan/Aktivitas' }]"
    />

    <NotesActivityPanel />
  </div>
</template>
