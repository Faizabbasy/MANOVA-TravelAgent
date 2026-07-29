<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Invoices' })
</script>

<template>
  <ModulePlaceholder
    title="Invoices"
    description="Daftar invoice lintas-project, termasuk filter Outstanding."
    :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]"
    phase="Finance"
  />
</template>
