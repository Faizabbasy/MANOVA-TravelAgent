<script setup lang="ts">
import { ref } from 'vue'
import { Menu } from 'lucide-vue-next'
import { useMobileTabs } from '~/composables/useMobileTabs'

const { tabs, isTabActive } = useMobileTabs()
const isMoreOpen = ref(false)
</script>

<template>
  <nav
    class="md:hidden fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch border-t border-border bg-card/95 shadow-[0_-2px_12px_-2px_rgb(0_0_0/0.08)] backdrop-blur pb-[env(safe-area-inset-bottom)]"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      class="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-transform active:scale-90"
      :class="isTabActive(tab) ? 'font-semibold text-sidebar-accent-foreground' : 'text-muted-foreground'"
    >
      <span
        class="flex h-8 w-12 items-center justify-center rounded-full transition-colors"
        :class="isTabActive(tab) && 'bg-sidebar-accent'"
      >
        <component :is="tab.icon" class="h-5 w-5" />
      </span>
      <span class="truncate px-1 leading-none">{{ tab.label }}</span>
    </NuxtLink>

    <button
      type="button"
      class="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-transform active:scale-90"
      :class="isMoreOpen && 'font-semibold text-sidebar-accent-foreground'"
      @click="isMoreOpen = true"
    >
      <span class="flex h-8 w-12 items-center justify-center rounded-full transition-colors" :class="isMoreOpen && 'bg-sidebar-accent'">
        <Menu class="h-5 w-5" />
      </span>
      <span class="leading-none">Lainnya</span>
    </button>
  </nav>

  <MobileMoreSheet v-model:open="isMoreOpen" />
</template>
