<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Prospects' })
</script>

<template>
  <ModulePlaceholder
    title="Prospects"
    description="Daftar Party dengan lifecycle status Prospect."
    :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Prospects' }]"
    phase="CRM"
  />
</template>
