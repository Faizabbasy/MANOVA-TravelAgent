<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { basisPointsToPercent, percentToBasisPoints } from '~/lib/finance/fee-rules'
import { todayJakarta } from '~/lib/finance/dates'
import type { FinanceOption } from '~/lib/finance/types'
import { cn } from '~/lib/utils'
import type { TransferFeeRuleDto } from '~/types/api'

/**
 * Add or edit the fee for one transfer direction (A → B). B → A is a separate rule. Direction is fixed once
 * saved; to change the fee from a date, end the old rule and add a new one so earlier transfers keep theirs.
 */
const props = defineProps<{ open: boolean; rule?: TransferFeeRuleDto | null; fromAccountId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const isEdit = computed(() => !!props.rule)

const form = reactive({
  from: null as string | null,
  to: null as string | null,
  feeType: 'fixed' as 'fixed' | 'percent',
  fixed: '',
  percent: '',
  min: '',
  max: '',
  effectiveFrom: todayJakarta(),
  effectiveTo: '',
  isActive: true,
  note: ''
})

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  const r = props.rule
  Object.assign(form, {
    from: r?.fromAccountId ?? props.fromAccountId ?? null,
    to: r?.toAccountId ?? null,
    feeType: r?.feeType ?? 'fixed',
    fixed: r?.fixedMinor ?? '',
    percent: r?.percentBasisPoints ? basisPointsToPercent(r.percentBasisPoints) : '',
    min: r?.minMinor ?? '',
    max: r?.maxMinor ?? '',
    effectiveFrom: r?.effectiveFrom ?? todayJakarta(),
    effectiveTo: r?.effectiveTo ?? '',
    isActive: r?.isActive ?? true,
    note: r?.note ?? ''
  })
})

const accountOptions = computed<FinanceOption[]>(() => (lookups.accounts.data.value ?? [])
  .filter(a => a.isActive || a.id === form.from || a.id === form.to)
  .map(a => ({ value: a.id, label: `${a.bankName} · ${a.code}` })))
const toOptions = computed(() => accountOptions.value.filter(o => o.value !== form.from))
const code = (id: string | null) => lookups.accounts.data.value?.find(a => a.id === id)?.code ?? '…'

const percentBp = computed(() => percentToBasisPoints(form.percent))
const percentError = computed(() => form.feeType === 'percent' && form.percent !== '' && percentBp.value === null
  ? 'Isi persen antara 0,01 dan 100, mis. 0,1.'
  : null)

const action = useFinanceAction(async () => {
  const shape = form.feeType === 'fixed'
    ? { feeType: 'fixed' as const, fixedMinor: form.fixed || null, percentBasisPoints: null, minMinor: null, maxMinor: null }
    : { feeType: 'percent' as const, fixedMinor: null, percentBasisPoints: percentBp.value, minMinor: form.min || null, maxMinor: form.max || null }
  const common = { ...shape, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null, note: form.note.trim() || null }
  if (props.rule) {
    return (await api.finance.updateFeeRule(props.rule.id, { ...common, isActive: form.isActive })).data
  }
  return (await api.finance.createFeeRule({ ...common, fromAccountId: form.from!, toAccountId: form.to! })).data
})

async function submit () {
  const saved = await action.run()
  if (!saved) { return }
  showToast(isEdit.value ? 'Aturan biaya diperbarui' : 'Aturan biaya ditambahkan', `Transfer ${code(saved.fromAccountId)} → ${code(saved.toAccountId)} memakai aturan ini mulai ${saved.effectiveFrom}.`)
  emit('update:open', false)
}

const incomplete = computed(() => !form.from || !form.to || !form.effectiveFrom ||
  (form.feeType === 'fixed' ? form.fixed === '' : percentBp.value === null))
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isEdit ? `Ubah biaya ${code(form.from)} → ${code(form.to)}` : 'Tambah aturan biaya transfer'"
    :description="isEdit
      ? 'Transfer yang sudah dicatat tetap memakai biaya saat itu. Untuk mengganti biaya mulai tanggal tertentu, isi tanggal akhir di sini lalu tambah aturan baru.'
      : 'Biaya berlaku untuk satu arah. Transfer ke arah sebaliknya punya aturan sendiri.'"
    :submit-label="isEdit ? 'Simpan perubahan' : 'Tambah aturan'"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="incomplete"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <FinanceField id="fr-from" label="Dari rekening" :error="action.fieldError('fromAccountId')">
        <FinanceSelect id="fr-from" v-model="form.from" :options="accountOptions" placeholder="Pilih rekening asal" :disabled="isEdit" />
      </FinanceField>
      <ArrowRight class="mx-auto mb-3 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
      <FinanceField id="fr-to" label="Ke rekening" :error="action.fieldError('toAccountId')">
        <FinanceSelect id="fr-to" v-model="form.to" :options="toOptions" placeholder="Pilih rekening tujuan" :disabled="isEdit || !form.from" />
      </FinanceField>
    </div>

    <fieldset class="space-y-2">
      <legend class="text-sm font-medium">
        Cara menghitung biaya
      </legend>
      <div class="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm" role="group" aria-label="Cara menghitung biaya">
        <button
          v-for="opt in [{ value: 'fixed', label: 'Biaya tetap' }, { value: 'percent', label: 'Persen dari nominal' }] as const"
          :key="opt.value"
          type="button"
          :aria-pressed="form.feeType === opt.value"
          :class="cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', form.feeType === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')"
          @click="form.feeType = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </fieldset>

    <div v-if="form.feeType === 'fixed'" class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="fr-fixed" label="Biaya per transfer" :error="action.fieldError('fixedMinor')" hint="Boleh Rp 0 bila transfer ini gratis.">
        <FinanceMoneyInput id="fr-fixed" v-model="form.fixed" :invalid="!!action.fieldError('fixedMinor')" />
      </FinanceField>
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-3">
      <FinanceField id="fr-percent" label="Persen" :error="percentError ?? action.fieldError('percentBasisPoints')" hint="mis. 0,1 untuk 0,1%">
        <div class="relative">
          <Input
            id="fr-percent"
            v-model="form.percent"
            class="h-10 pr-8 text-right tabular-nums"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0,1"
            :aria-invalid="!!percentError || undefined"
          />
          <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground" aria-hidden="true">%</span>
        </div>
      </FinanceField>
      <FinanceField id="fr-min" label="Minimum" optional :error="action.fieldError('minMinor')">
        <FinanceMoneyInput id="fr-min" v-model="form.min" />
      </FinanceField>
      <FinanceField id="fr-max" label="Maksimum" optional :error="action.fieldError('maxMinor')">
        <FinanceMoneyInput id="fr-max" v-model="form.max" />
      </FinanceField>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="fr-start" label="Berlaku mulai" :error="action.fieldError('effectiveFrom')">
        <FinanceDateInput id="fr-start" v-model="form.effectiveFrom" />
      </FinanceField>
      <FinanceField id="fr-end" label="Sampai" optional :error="action.fieldError('effectiveTo')" hint="Kosongkan bila masih berlaku.">
        <FinanceDateInput id="fr-end" v-model="form.effectiveTo" :min="form.effectiveFrom" />
      </FinanceField>
      <FinanceField id="fr-note" label="Catatan" optional class="sm:col-span-2">
        <Input id="fr-note" v-model="form.note" class="h-10" maxlength="500" placeholder="mis. BI-FAST, tarif per Oktober 2026" />
      </FinanceField>
    </div>

    <label v-if="isEdit" class="flex items-center gap-2 text-sm">
      <input v-model="form.isActive" type="checkbox" class="h-4 w-4 rounded border-input">
      Aturan aktif
    </label>
  </FinanceFormDialog>
</template>
