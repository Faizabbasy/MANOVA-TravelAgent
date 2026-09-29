<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — konten halaman ini (3.040 baris, 8 tab) sudah dipindah PENUH ke
 * `/project-orders/[id]/index.vue`, digabung dengan stepper 6-step yang dulu ada di sana. Tab query
 * (`?tab=overview|itinerary-services|travelers|vendors|finance|tasks|documents|activity-changes`) sama
 * persis di kedua sisi, jadi diteruskan apa adanya. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: `/project-orders/${route.params.id}`, query: route.query })
</script>

<template>
  <div />
</template>
