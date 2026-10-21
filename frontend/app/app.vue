<script setup lang="ts">
import '../assets/css/tailwind.css'
useHead({ titleTemplate: title => title && title !== 'MANOVA' ? `${title} · MANOVA` : 'MANOVA — Travel Operations Platform' })
</script>

<template>
  <div>
    <LoadingBar />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
