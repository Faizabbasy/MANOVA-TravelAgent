<script setup lang="ts">
const isMobile = useIsMobile()
</script>

<template>
  <div class="min-h-screen flex w-full bg-background">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <TopHeader />
      <main class="flex-1 p-6 overflow-auto" :class="isMobile ? 'p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]' : ''">
        <slot />
      </main>
    </div>
    <MobileBottomNav v-if="isMobile" />
    <ToastContainer />
  </div>
</template>
