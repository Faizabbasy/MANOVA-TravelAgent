<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Reports' })
</script>

<template>
  <ModulePlaceholder
    title="Reports"
    description="Sales Pipeline, Project Performance, Cost and Margin, Finance Summary."
    :breadcrumb="[{ label: 'Reports' }]"
    phase="Reporting"
  />
</template>
