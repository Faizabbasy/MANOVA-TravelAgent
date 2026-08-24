<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TabsTrigger } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <TabsTrigger
    v-bind="delegatedProps"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/60 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-300/80 dark:data-[state=active]:border-slate-700 data-[state=active]:border-b-2 data-[state=active]:border-b-primary',
      props.class,
    )"
  >
    <slot />
  </TabsTrigger>
</template>
