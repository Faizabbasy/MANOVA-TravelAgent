<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Clients' })
</script>

<template>
  <ModulePlaceholder
    title="Clients"
    description="Daftar Party dengan lifecycle status Client."
    :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Clients' }]"
    phase="CRM"
  />
</template>
