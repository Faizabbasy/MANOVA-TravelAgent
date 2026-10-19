<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import { proofVerifyDefaults } from '~/lib/finance/payment-proofs'
import { formatMoneyMinor } from '~/lib/money'
import type { PaymentProofDto } from '~/types/api'

/**
 * S12c-1: Finance verify a client's payment proof by posting the receipt it describes (account chosen here; amount and
 * date prefilled from the proof but Finance's values are the official ones), or reject it with a reason.
 */
const props = defineProps<{ open: boolean; proof: PaymentProofDto | null; mode: 'verify' | 'reject' }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open && props.mode === 'verify')
const today = todayJakarta()
const form = reactive({ accountId: null as string | null, amount: '', date: today, reference: '', reason: '' })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open || !props.proof) { return }
  idempotencyKey = newIdempotencyKey()
  const d = proofVerifyDefaults(props.proof, today)
  Object.assign(form, { accountId: lookups.accountOptions.value[0]?.value ?? null, amount: d.amount, date: d.date, reference: d.reference, reason: '' })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
})

const verify = useFinanceAction(() => api.finance.verifyPaymentProof(props.proof!.id, {
  bankAccountId: form.accountId!, amountMinor: form.amount, effectiveDate: form.date, reference: form.reference.trim() || undefined
}, idempotencyKey))
const reject = useFinanceAction(() => api.finance.rejectPaymentProof(props.proof!.id, form.reason.trim()))
const action = computed(() => (props.mode === 'verify' ? verify : reject))

async function submit () {
  const result = await action.value.run()
  if (!result) { return }
  if (props.mode === 'verify') {
    showToast('Bukti bayar diverifikasi', `${formatMoneyMinor(form.amount)} dicatat untuk ${props.proof?.invoiceNumber ?? props.proof?.invoiceId}.`)
  } else {
    showToast('Bukti bayar ditolak', 'Client diberi tahu alasannya.')
  }
  emit('update:open', false)
  emit('done')
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="mode === 'verify' ? 'Verifikasi bukti bayar' : 'Tolak bukti bayar'"
    :description="mode === 'verify'
      ? 'Catat uang yang benar-benar masuk ke rekening. Nominal dan tanggal di bawah adalah yang resmi — boleh dikoreksi dari bukti client.'
      : 'Client akan melihat alasan ini dan bisa mengirim bukti yang benar.'"
    :submit-label="mode === 'verify' ? 'Verifikasi & catat pembayaran' : 'Tolak bukti'"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="mode === 'verify' ? !form.accountId || !form.amount || !form.date : !form.reason.trim()"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div v-if="proof" class="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p class="font-medium text-foreground">
        {{ proof.partyName }} — {{ proof.invoiceNumber ?? proof.invoiceId }}
      </p>
      <p class="text-muted-foreground">
        Ref. {{ proof.reference }} · {{ formatMoneyMinor(proof.amountMinor) }} · transfer {{ proof.transferDate }}{{ proof.senderBank ? ` · ${proof.senderBank}` : '' }}{{ proof.fileName ? ` · ${proof.fileName}` : '' }}
      </p>
      <p v-if="proof.note" class="text-muted-foreground">
        Catatan client: {{ proof.note }}
      </p>
    </div>

    <div v-if="mode === 'verify'" class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="pp-amount" label="Nominal diterima" :error="verify.fieldError('amountMinor')">
        <FinanceMoneyInput id="pp-amount" v-model="form.amount" :invalid="!!verify.fieldError('amountMinor')" />
      </FinanceField>
      <FinanceField id="pp-date" label="Tanggal uang masuk" :error="verify.fieldError('effectiveDate')">
        <FinanceDateInput id="pp-date" v-model="form.date" :max="today" />
      </FinanceField>
      <FinanceField id="pp-account" label="Masuk ke rekening" :error="verify.fieldError('bankAccountId')">
        <FinanceSelect id="pp-account" v-model="form.accountId" :options="lookups.accountOptions.value" placeholder="Pilih rekening" />
      </FinanceField>
      <FinanceField id="pp-ref" label="No. referensi bank" optional>
        <Input id="pp-ref" v-model="form.reference" class="h-10" maxlength="120" />
      </FinanceField>
    </div>
    <FinanceField v-else id="pp-reason" label="Alasan penolakan" :error="reject.fieldError('reason')">
      <Input id="pp-reason" v-model="form.reason" class="h-10" maxlength="500" placeholder="mis. Dana belum masuk ke rekening" />
    </FinanceField>
  </FinanceFormDialog>
</template>
