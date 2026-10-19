<script setup lang="ts">
import { formatMoneyMinor } from '~/lib/money'
import type { PaymentProofDto } from '~/types/api'

/**
 * S12c-1: payment proofs clients sent that wait for Finance — all of them on the receivables page, or one invoice's in
 * its sheet. Verify = post the receipt it describes; reject = with a reason the client sees.
 */
const props = defineProps<{ invoiceId?: string | null; compact?: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const api = useApi()
const { can } = usePermissions()
const canVerify = computed(() => can('finance.post-cash'))
const canReject = computed(() => can('finance.manage-receivables'))

const proofs = useFinanceQuery(async () => (await api.finance.listPaymentProofs({ status: 'submitted', ...(props.invoiceId ? { invoiceId: props.invoiceId } : {}) })).data,
  { watch: [() => props.invoiceId] })

const dialogOpen = ref(false)
const dialogMode = ref<'verify' | 'reject'>('verify')
const selected = ref<PaymentProofDto | null>(null)
function open (proof: PaymentProofDto, mode: 'verify' | 'reject') {
  selected.value = proof
  dialogMode.value = mode
  dialogOpen.value = true
}
async function onDone () {
  await proofs.refresh()
  emit('changed')
}
</script>

<template>
  <div v-if="(proofs.data.value?.length ?? 0) > 0" :class="compact ? 'rounded-lg border border-warning/40 bg-warning/5 p-3' : ''">
    <SectionCard v-if="!compact" title="Bukti Bayar Masuk" description="Bukti pembayaran dari client yang menunggu verifikasi Finance.">
      <div class="divide-y divide-border">
        <div v-for="proof in proofs.data.value" :key="proof.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
          <div class="min-w-0 text-sm">
            <p class="font-medium text-foreground">
              {{ proof.partyName }} — {{ proof.invoiceNumber ?? proof.invoiceId }}
            </p>
            <p class="text-muted-foreground">
              Ref. {{ proof.reference }} · {{ formatMoneyMinor(proof.amountMinor) }} · transfer {{ proof.transferDate }}{{ proof.senderBank ? ` · ${proof.senderBank}` : '' }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button v-if="canVerify" size="sm" @click="open(proof, 'verify')">
              Verifikasi
            </Button>
            <Button v-if="canReject" size="sm" variant="outline" @click="open(proof, 'reject')">
              Tolak
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
    <template v-else>
      <div v-for="proof in proofs.data.value" :key="proof.id" class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p class="text-foreground">
          Client mengirim bukti bayar: Ref. {{ proof.reference }} · {{ formatMoneyMinor(proof.amountMinor) }} · transfer {{ proof.transferDate }}
        </p>
        <div class="flex gap-2">
          <Button v-if="canVerify" size="sm" @click="open(proof, 'verify')">
            Verifikasi
          </Button>
          <Button v-if="canReject" size="sm" variant="outline" @click="open(proof, 'reject')">
            Tolak
          </Button>
        </div>
      </div>
    </template>
    <FinancePaymentProofDialog v-model:open="dialogOpen" :proof="selected" :mode="dialogMode" @done="onDone" />
  </div>
</template>
