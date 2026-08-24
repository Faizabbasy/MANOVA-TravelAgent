<script setup lang="ts">
import type { TabsListProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TabsList } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>()
const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <TabsList
    v-bind="delegatedProps"
    :class="cn(
      'inline-flex h-12 items-center justify-start gap-1.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-xl bg-slate-200/70 dark:bg-slate-800/80 p-1.5 text-muted-foreground border border-slate-300/70 dark:border-slate-700/70 shadow-inner max-w-full',
      props.class,
    )"
  >
    <slot />
  </TabsList>
</template>
