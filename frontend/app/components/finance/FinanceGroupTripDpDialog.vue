<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { minimumDpMinor } from '~/lib/finance/group-trip'
import { shiftDate, todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'
import type { GroupTripDpResult } from '~/types/api'

/**
 * Konfirmasi DP satu booking Group Trip (V2 tab Bookings). Finance records the money on the server in one
 * step: a DP invoice for the full booking price to the participant, and the DP received into a bank account.
 * The rest stays open on that invoice. Retrying (double click, network) never records it twice.
 */
const props = defineProps<{ open: boolean; order: { id: string; customerName: string; travelerCount: number; priceMinor: string } | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; confirmed: [value: GroupTripDpResult] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ accountId: null as string | null, amount: '', date: today, dueDate: shiftDate(today, 14) })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { accountId: lookups.accountOptions.value[0]?.value ?? null, amount: '', date: today, dueDate: shiftDate(today, 14) })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const minimum = computed(() => (props.order ? minimumDpMinor(props.order.priceMinor) : '0'))
const tooLow = computed(() => !!form.amount && BigInt(form.amount) < BigInt(minimum.value))
const tooHigh = computed(() => !!form.amount && !!props.order && BigInt(form.amount) > BigInt(props.order.priceMinor))
const remaining = computed(() => (props.order && form.amount && !tooHigh.value ? (BigInt(props.order.priceMinor) - BigInt(form.amount)).toString() : null))

const action = useFinanceAction(() => api.finance.confirmGroupTripDp(props.order!.id, {
  bankAccountId: form.accountId!,
  dpAmountMinor: form.amount,
  effectiveDate: form.date,
  dueDate: form.dueDate
}, idempotencyKey))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  const r = res.data
  showToast('DP dicatat', `${formatMoneyMinor(form.amount)} diterima. ${r.outstandingMinor === '0' ? 'Booking lunas.' : `Sisa tagihan ${formatMoneyMinor(r.outstandingMinor)} (invoice ${r.invoiceNumber}).`}`)
  emit('confirmed', r)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Konfirmasi DP"
    :description="order ? `${order.customerName} · ${order.travelerCount} pax · harga ${formatMoneyMinor(order.priceMinor)}. Invoice DP dibuat atas nama peserta; sisa tagihan tetap terbuka.` : ''"
    submit-label="Catat DP"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!order || !form.accountId || !form.amount || tooLow || tooHigh || !form.dueDate"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="gt-amount" label="Nominal DP diterima" :error="action.fieldError('dpAmountMinor')" :hint="`Minimal ${formatMoneyMinor(minimum)} (30% dari harga).`" class="sm:col-span-2">
        <FinanceMoneyInput id="gt-amount" v-model="form.amount" :invalid="tooLow || tooHigh || !!action.fieldError('dpAmountMinor')" />
        <p v-if="tooLow" class="mt-1 text-xs font-medium text-destructive" role="alert">
          Kurang dari DP minimal {{ formatMoneyMinor(minimum) }}.
        </p>
        <p v-else-if="tooHigh" class="mt-1 text-xs font-medium text-destructive" role="alert">
          Melebihi harga booking.
        </p>
      </FinanceField>
      <FinanceField id="gt-account" label="Masuk ke rekening" :error="action.fieldError('bankAccountId')">
        <FinanceSelect id="gt-account" v-model="form.accountId" :options="lookups.accountOptions.value" placeholder="Pilih rekening" />
      </FinanceField>
      <FinanceField id="gt-date" label="Tanggal diterima" :error="action.fieldError('effectiveDate')">
        <FinanceDateInput id="gt-date" v-model="form.date" :max="today" />
      </FinanceField>
      <FinanceField id="gt-due" label="Jatuh tempo pelunasan" :error="action.fieldError('dueDate')" class="sm:col-span-2">
        <FinanceDateInput id="gt-due" v-model="form.dueDate" :min="form.date" />
      </FinanceField>
    </div>

    <template v-if="remaining !== null" #summary>
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span class="text-muted-foreground">Sisa tagihan setelah DP</span>
        <FinanceAmount :value="remaining" class="font-semibold" />
      </div>
    </template>
  </FinanceFormDialog>
</template>
