<script setup lang="ts">
import { cn } from '~/lib/utils'
import { formatMoneyMinor } from '~/lib/money'
import type { MoneyMinor } from '~/types/api'

/**
 * A money figure as the server sent it (`MoneyMinor`). Tabular digits so columns align; direction shown by
 * sign AND colour (never colour alone); `null` renders an explicit "not available" instead of Rp0.
 */
const props = withDefaults(defineProps<{
  value: MoneyMinor | null | undefined
  currency?: string
  /** in → "+Rp…" green, out → "−Rp…"; omit for a plain figure. */
  direction?: 'in' | 'out' | null
  /** Strike-through (e.g. a reversed movement). */
  muted?: boolean
  /** Grey, no strike-through (e.g. the compensating entry of a reversal). */
  subdued?: boolean
  unavailableLabel?: string
  class?: string
}>(), { currency: 'IDR', direction: null, muted: false, subdued: false, unavailableLabel: 'Belum tersedia', class: '' })

const text = computed(() => {
  if (props.value === null || props.value === undefined) { return props.unavailableLabel }
  const plain = formatMoneyMinor(props.value, props.currency)
  if (props.direction === 'in') { return `+${plain}` }
  if (props.direction === 'out') { return `−${plain}` }
  return plain
})
</script>

<template>
  <span
    :class="cn(
      'whitespace-nowrap tabular-nums',
      value === null || value === undefined ? 'text-muted-foreground' : '',
      direction === 'in' && !muted && !subdued && 'text-success',
      subdued && 'text-muted-foreground',
      muted && 'text-muted-foreground line-through decoration-muted-foreground/60',
      props.class
    )"
  >{{ text }}</span>
</template>
