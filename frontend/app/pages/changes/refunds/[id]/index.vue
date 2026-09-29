<script setup lang="ts">
/**
 * Redirect: refund requests were mock records here. Since Phase 5 refunds are cancellation cases in the Finance
 * API (decided and paid by Finance); the Changes screen lists them under the Refunds tab.
 */
definePageMeta({ redirect: '/changes?tab=refunds' })
</script>

<template>
  <div />
</template>
