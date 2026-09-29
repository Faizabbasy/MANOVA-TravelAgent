<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import type { MovementDto } from '~/types/api'
import { KIND_LABEL } from '~/lib/finance/labels'
import { formatBusinessDate } from '~/lib/finance/dates'

/**
 * Cancel a posted movement the only way the cash book allows: a mirrored compensating entry. The original stays
 * visible with a strike-through, so the history is never rewritten.
 */
const props = defineProps<{ open: boolean; movement: MovementDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; reversed: [] }>()

const api = useApi()
const { showToast } = useToast()
const reason = ref('')
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  reason.value = ''
  idempotencyKey = newIdempotencyKey()
})

const isTransfer = computed(() => !!props.movement?.transferId)

const consequence = computed(() => {
  const m = props.movement
  if (!m) { return '' }
  if (isTransfer.value) { return 'Kedua sisi transfer (keluar & masuk) beserta biayanya dibalik sekaligus.' }
  if (m.kind === 'customer_receipt') { return 'Invoice yang dilunasi oleh pembayaran ini kembali terbuka sebesar alokasinya, dan saldo rekening berkurang.' }
  if (m.kind === 'vendor_payment') { return 'Invoice vendor yang dibayar kembali terbuka sebesar alokasinya, dan saldo rekening bertambah kembali.' }
  return m.direction === 'in' ? 'Saldo rekening berkurang sebesar nominal ini.' : 'Saldo rekening bertambah kembali sebesar nominal ini.'
})

const action = useFinanceAction((): Promise<unknown> => {
  const m = props.movement!
  if (m.transferId) { return api.finance.reverseTransfer(m.transferId, reason.value.trim(), idempotencyKey) }
  return api.finance.reverseTransaction(m.id, reason.value.trim(), idempotencyKey)
})

async function submit () {
  const done = await action.run()
  if (!done) { return }
  showToast('Transaksi dibatalkan', 'Transaksi balik sudah dicatat. Riwayat aslinya tetap tersimpan.')
  emit('reversed')
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isTransfer ? 'Batalkan transfer?' : 'Batalkan transaksi?'"
    description="Pembatalan mencatat transaksi balik dengan nominal yang sama. Transaksi asli tidak dihapus dan tetap tampil di riwayat."
    :submit-label="isTransfer ? 'Batalkan transfer' : 'Batalkan transaksi'"
    tone="destructive"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="reason.trim().length < 5"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div v-if="movement" class="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">
          {{ KIND_LABEL[movement.kind] }} · {{ movement.account.code }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ formatBusinessDate(movement.effectiveDate) }}<template v-if="movement.reference">
            · {{ movement.reference }}
          </template>
        </p>
      </div>
      <FinanceAmount :value="movement.amountMinor" :currency="movement.currency" :direction="movement.direction" class="text-base font-semibold" />
    </div>
    <p class="text-sm leading-relaxed text-muted-foreground">
      {{ consequence }}
    </p>
    <FinanceField id="rev-reason" label="Alasan pembatalan" :error="action.fieldError('reason')" hint="Minimal 5 karakter. Tersimpan di jejak audit.">
      <FinanceTextarea id="rev-reason" v-model="reason" :rows="2" placeholder="mis. Salah rekening, transfer ditolak bank" maxlength="500" />
    </FinanceField>
  </FinanceFormDialog>
</template>
