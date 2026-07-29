<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Master Data' })
</script>

<template>
  <ModulePlaceholder
    title="Master Data"
    description="Kelola daftar master (kategori, unit, dsb.) lintas modul."
    :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Master Data' }]"
    phase="Administration"
  />
</template>
