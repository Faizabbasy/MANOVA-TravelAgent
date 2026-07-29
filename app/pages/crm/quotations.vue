<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Quotations' })
</script>

<template>
  <ModulePlaceholder
    title="Quotations"
    description="Daftar quotation lintas seluruh opportunity."
    :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Quotations' }]"
    phase="CRM"
  />
</template>
