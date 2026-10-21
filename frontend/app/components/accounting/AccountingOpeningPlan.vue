<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { OpeningDecisionsInput, OpeningPlanDto } from '~/types/api'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Saldo awal per cutover, derived from Finance (not typed in). The owner answers only what is a business judgement —
 * was this invoice's service already delivered, was this supplier cost already incurred, how much of equity is paid-in
 * capital — starting from the shown suggestion. Anything unanswered stays visible as "belum direkonsiliasi".
 */
const props = defineProps<{ plan: OpeningPlanDto; canDecide: boolean; pending: boolean; error?: string | null }>()
const emit = defineEmits<{ preview: [decisions: OpeningDecisionsInput]; confirm: [input: { planHash: string; decisions: OpeningDecisionsInput; reason: string }] }>()

const LABEL: Record<string, string> = { earned: 'Jasa sudah diberikan', unearned: 'Jasa belum diberikan', incurred: 'Biaya sudah terjadi', prepaid: 'Belum terjadi (dibayar di muka)' }
const choices = reactive<Record<string, string>>({})
const form = reactive({ capital: '', reason: '' })
watch(() => props.plan.decisions, (list) => { for (const d of list) { choices[d.key] ??= d.suggestion } }, { immediate: true })

const decisions = computed<OpeningDecisionsInput>(() => {
  const out: OpeningDecisionsInput = { invoices: {}, vendorInvoices: {} }
  for (const d of props.plan.decisions) {
    const v = choices[d.key]
    if (d.kind === 'customer-invoice' && (v === 'earned' || v === 'unearned')) { out.invoices![d.sourceId] = v }
    if (d.kind === 'vendor-invoice' && (v === 'incurred' || v === 'prepaid')) { out.vendorInvoices![d.sourceId] = v }
  }
  if (/^\d+$/.test(form.capital)) { out.equity = { capitalMinor: form.capital } }
  return out
})
const groups = computed(() => {
  const map = new Map<string, OpeningPlanDto['items']>()
  for (const i of props.plan.items) { map.set(i.group, [...(map.get(i.group) ?? []), i]) }
  return [...map.entries()]
})
const clearing = computed(() => props.plan.items.find(i => i.role === 'opening-clearing') ?? null)
</script>

<template>
  <section class="space-y-4 rounded-xl border bg-card p-5" aria-label="Saldo awal">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold">
          Saldo awal per {{ plan.cutoverDate }}
        </h2>
        <p class="text-sm text-muted-foreground">
          Diambil dari transaksi Finance sebelum tanggal mulai buku. Tidak ada transaksi kas yang diulang.
        </p>
      </div>
      <span class="rounded-md bg-muted px-3 py-1 text-sm">{{ plan.confirmed ? (plan.confirmed.validated ? 'Sudah disahkan' : 'Diposting, belum lengkap') : 'Pratinjau' }}</span>
    </div>
    <ul v-if="plan.exceptions.length" class="space-y-1 text-sm text-warning" aria-label="Perlu diperiksa">
      <li v-for="e in plan.exceptions" :key="e.code + e.message">
        {{ e.message }}
      </li>
    </ul>
    <div v-for="[group, rows] in groups" :key="group" class="text-sm">
      <h3 class="font-medium">
        {{ group }}
      </h3>
      <ul class="mt-1 space-y-0.5 text-muted-foreground">
        <li v-for="r in rows" :key="r.key" class="flex justify-between gap-3">
          <span>{{ r.label }}</span><span class="tabular-nums">{{ r.side === 'credit' ? '−' : '' }}{{ formatMoneyMinor(r.amountMinor) }}</span>
        </li>
      </ul>
    </div>
    <p v-if="clearing" role="status" class="text-sm font-medium text-warning">
      Belum direkonsiliasi {{ formatMoneyMinor(clearing.amountMinor) }} — jawab pertanyaan di bawah agar menjadi nol.
    </p>

    <form v-if="canDecide && !plan.confirmed" class="space-y-3 border-t pt-4" @submit.prevent="emit('confirm', { planHash: plan.planHash, decisions, reason: form.reason.trim() })">
      <fieldset v-for="d in plan.decisions" :key="d.key" class="text-sm">
        <legend class="font-medium">
          {{ d.label }} · {{ formatMoneyMinor(d.amountMinor) }}
        </legend>
        <label v-for="o in d.options" :key="o" class="mr-4 inline-flex items-center gap-1.5">
          <input v-model="choices[d.key]" type="radio" :name="d.key" :value="o"> {{ LABEL[o] }}<span v-if="o === d.suggestion" class="text-xs text-muted-foreground">(saran)</span>
        </label>
      </fieldset>
      <label class="block text-sm">Modal disetor (rupiah) — sisanya menjadi saldo laba s.d. cutover
        <input v-model="form.capital" name="capital" inputmode="numeric" class="mt-1 h-10 w-full max-w-xs rounded-md border bg-background px-3">
      </label>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="h-9 rounded-md border px-4 text-sm" :disabled="pending" @click="emit('preview', decisions)">
          Hitung ulang
        </button>
      </div>
      <label class="block text-sm">Dasar saldo awal
        <input v-model="form.reason" name="reason" maxlength="500" placeholder="mis. rekening koran per 31 Agustus" class="mt-1 h-10 w-full rounded-md border bg-background px-3">
      </label>
      <p v-if="error" role="alert" class="text-sm font-medium text-destructive">
        {{ error }}
      </p>
      <button type="submit" class="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50" :disabled="pending || !plan.canConfirm || form.reason.trim().length < 5">
        Posting saldo awal (rehearsal)
      </button>
      <p v-if="!plan.canConfirm" class="text-xs text-muted-foreground">
        Saldo awal produksi diposting saat cutover yang diinstruksikan; halaman ini hanya pratinjau.
      </p>
    </form>
  </section>
</template>
