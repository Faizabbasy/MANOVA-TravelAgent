<script setup lang="ts">
import { cn } from '~/lib/utils'
import { shiftDate, startOfMonth, todayJakarta } from '~/lib/finance/dates'
import type { PeriodPreset } from '~/lib/finance/types'

/** Period presets people actually use, plus a custom range. Model: `{ from, to }` business dates. */

const props = defineProps<{ from: string; to: string; preset: PeriodPreset }>()
const emit = defineEmits<{ 'update:from': [v: string]; 'update:to': [v: string]; 'update:preset': [v: PeriodPreset] }>()

const today = todayJakarta()
const presets: { key: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { key: 'this-month', label: 'Bulan ini' },
  { key: 'last-month', label: 'Bulan lalu' },
  { key: '30d', label: '30 hari' },
  { key: '90d', label: '90 hari' }
]

function rangeOf (key: Exclude<PeriodPreset, 'custom'>): { from: string; to: string } {
  if (key === 'this-month') { return { from: startOfMonth(today), to: today } }
  if (key === 'last-month') {
    const end = shiftDate(startOfMonth(today), -1)
    return { from: startOfMonth(end), to: end }
  }
  return { from: shiftDate(today, key === '30d' ? -29 : -89), to: today }
}

function choose (key: PeriodPreset) {
  emit('update:preset', key)
  if (key !== 'custom') {
    const r = rangeOf(key)
    emit('update:from', r.from)
    emit('update:to', r.to)
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="inline-flex flex-wrap rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Pilih periode">
      <button
        v-for="p in presets"
        :key="p.key"
        type="button"
        :aria-pressed="props.preset === p.key"
        :class="cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', props.preset === p.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')"
        @click="choose(p.key)"
      >
        {{ p.label }}
      </button>
      <button
        type="button"
        :aria-pressed="props.preset === 'custom'"
        :class="cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', props.preset === 'custom' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')"
        @click="choose('custom')"
      >
        Pilih tanggal
      </button>
    </div>
    <div v-if="props.preset === 'custom'" class="flex items-center gap-2">
      <FinanceDateInput :model-value="from" :max="to" class="h-9 w-[9.5rem]" aria-label="Dari tanggal" @update:model-value="v => v && emit('update:from', v)" />
      <span class="text-xs text-muted-foreground">s/d</span>
      <FinanceDateInput
        :model-value="to"
        :min="from"
        :max="today"
        class="h-9 w-[9.5rem]"
        aria-label="Sampai tanggal"
        @update:model-value="v => v && emit('update:to', v)"
      />
    </div>
  </div>
</template>
