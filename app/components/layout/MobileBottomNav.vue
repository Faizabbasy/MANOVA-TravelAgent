<script setup lang="ts">
import { ref } from 'vue'
import { Menu } from 'lucide-vue-next'
import { useMobileTabs } from '~/composables/useMobileTabs'

const { tabs, isTabActive } = useMobileTabs()
const isMoreOpen = ref(false)
</script>

<template>
  <nav
    class="md:hidden fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors"
      :class="isTabActive(tab) ? 'text-sidebar-accent-foreground font-semibold' : 'text-muted-foreground'"
    >
      <component :is="tab.icon" class="h-5 w-5" />
      <span class="truncate px-1">{{ tab.label }}</span>
    </NuxtLink>

    <button
      type="button"
      class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground transition-colors"
      :class="isMoreOpen && 'text-sidebar-accent-foreground font-semibold'"
      @click="isMoreOpen = true"
    >
      <Menu class="h-5 w-5" />
      <span>Lainnya</span>
    </button>
  </nav>

  <MobileMoreSheet v-model:open="isMoreOpen" />
</template>
