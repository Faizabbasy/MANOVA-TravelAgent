<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

/** Footer pagination generik (label total + rows-per-page + range + prev/next) — pasangan `usePagination`. */
defineProps<{
  total: number
  itemLabel: string
  pageSize: number
  currentPage: number
  totalPages: number
  rangeLabel: string
}>()

const emit = defineEmits<{
  'update:pageSize': [number]
  'update:currentPage': [number]
}>()

const PAGE_SIZE_OPTIONS = [10, 25, 50]
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
    <p class="text-xs text-muted-foreground">
      Total {{ total }} {{ itemLabel }}
    </p>
    <div v-if="total > 0" class="flex flex-wrap items-center gap-4">
      <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
        Rows per page
        <select
          :value="pageSize"
          class="appearance-none rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
      </label>
      <span class="text-xs text-muted-foreground">{{ rangeLabel }}</span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          :disabled="currentPage <= 1"
          @click="emit('update:currentPage', currentPage - 1)"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          :disabled="currentPage >= totalPages"
          @click="emit('update:currentPage', currentPage + 1)"
        >
          <ChevronRight class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
