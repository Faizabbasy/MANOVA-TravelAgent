<script setup lang="ts">
import { Wand2 } from 'lucide-vue-next'
import { dueInfo } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'
import type { AllocationTarget } from '~/lib/finance/types'
import { suggestAllocation } from '~/lib/finance/allocation'

/**
 * Which open invoices a payment settles. By default it fills oldest-due first as the amount is typed; the
 * moment the user edits a line it stops guessing. Whatever is not allocated stays as the customer's advance
 * (or vendor deposit) — shown explicitly so nothing silently disappears. The server re-checks every figure.
 */

const props = defineProps<{
  targets: AllocationTarget[]
  /** Payment amount (minor units string). */
  amount: string
  modelValue: Record<string, string>
  today: string
  loading?: boolean
  leftoverLabel: string
  /** Invoice to settle first (e.g. opened from that invoice). */
  focusId?: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string>] }>()

const auto = ref(true)
const big = (v: string | undefined) => BigInt(v || '0')

function autoFill () {
  emit('update:modelValue', suggestAllocation(props.targets, props.amount, props.focusId))
}

watch(() => [props.amount, props.targets], () => { if (auto.value) { autoFill() } }, { immediate: true })

function setLine (id: string, value: string) {
  auto.value = false
  const next = { ...props.modelValue }
  if (value && value !== '0') { next[id] = value } else { delete next[id] }
  emit('update:modelValue', next)
}

function toggle (id: string, on: boolean) {
  auto.value = false
  const next = { ...props.modelValue }
  if (!on) {
    delete next[id]
  } else {
    const used = Object.entries(next).reduce((s, [, v]) => s + big(v), 0n)
    const free = big(props.amount) - used
    const target = props.targets.find(t => t.id === id)
    const take = target ? (free < big(target.outstandingMinor) ? free : big(target.outstandingMinor)) : 0n
    next[id] = (take > 0n ? take : big(target?.outstandingMinor)).toString()
  }
  emit('update:modelValue', next)
}

function resetAuto () {
  auto.value = true
  autoFill()
}

const allocated = computed(() => Object.values(props.modelValue).reduce((s, v) => s + big(v), 0n))
const leftover = computed(() => big(props.amount) - allocated.value)
const overLine = (t: AllocationTarget) => big(props.modelValue[t.id]) > big(t.outstandingMinor)
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-[13px] font-medium">
        Untuk tagihan mana?
      </p>
      <button v-if="!auto && targets.length" type="button" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" @click="resetAuto">
        <Wand2 class="h-3.5 w-3.5" /> Isi otomatis
      </button>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 2" :key="i" class="h-14 animate-pulse rounded-lg bg-muted" />
    </div>
    <p v-else-if="!targets.length" class="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
      Tidak ada tagihan terbuka. Seluruh nominal akan dicatat sebagai {{ leftoverLabel.toLowerCase() }}.
    </p>

    <ul v-else class="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
      <li v-for="t in targets" :key="t.id" class="px-3 py-2.5" :class="modelValue[t.id] && 'bg-primary/[0.03]'">
        <div class="flex items-start gap-2.5">
          <Checkbox
            :id="`alloc-${t.id}`"
            :model-value="!!modelValue[t.id]"
            class="mt-0.5"
            :aria-label="`Alokasikan ke ${t.title}`"
            @update:model-value="v => toggle(t.id, !!v)"
          />
          <label :for="`alloc-${t.id}`" class="min-w-0 flex-1 cursor-pointer">
            <span class="flex items-baseline justify-between gap-3">
              <span class="truncate text-sm font-medium">{{ t.title }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">sisa <FinanceAmount :value="t.outstandingMinor" class="font-medium text-foreground" /></span>
            </span>
            <span class="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
              <span class="truncate">{{ t.subtitle }}</span>
              <span class="shrink-0" :class="dueInfo(t.dueDate, today).tone === 'destructive' && 'font-medium text-destructive'">{{ dueInfo(t.dueDate, today).label }}</span>
            </span>
          </label>
        </div>
        <div v-if="modelValue[t.id] !== undefined" class="mt-2 pl-6">
          <FinanceMoneyInput
            :model-value="modelValue[t.id] ?? ''"
            :invalid="overLine(t)"
            class="h-9"
            :aria-label="`Nominal untuk ${t.title}`"
            @update:model-value="v => setLine(t.id, v)"
          />
          <p v-if="overLine(t)" class="mt-1 text-xs font-medium text-destructive">
            Melebihi sisa tagihan ({{ formatMoneyMinor(t.outstandingMinor) }}).
          </p>
        </div>
      </li>
    </ul>

    <div v-if="amount" class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
      <span class="text-muted-foreground">Dialokasikan <FinanceAmount :value="allocated.toString()" class="font-medium text-foreground" /></span>
      <span v-if="leftover > 0n" class="text-muted-foreground">{{ leftoverLabel }} <FinanceAmount :value="leftover.toString()" class="font-semibold text-foreground" /></span>
      <span v-else-if="leftover < 0n" class="font-medium text-destructive" role="alert">Alokasi melebihi nominal sebesar {{ formatMoneyMinor((-leftover).toString()) }}</span>
      <span v-else class="font-medium text-success">Seluruh nominal teralokasi</span>
    </div>
  </div>
</template>
