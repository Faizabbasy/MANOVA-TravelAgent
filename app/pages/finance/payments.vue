<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Payments' })
</script>

<template>
  <ModulePlaceholder
    title="Payments"
    description="Daftar payment lintas-project."
    :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Payments' }]"
    phase="Finance"
  />
</template>
