<script setup lang="ts">
import { HandCoins, Undo2, Wallet } from 'lucide-vue-next'
import type { SupplierClaimDto } from '~/types/api'
import { formatBusinessDate } from '~/lib/finance/dates'

/** Money suppliers owe back on this project: claim recorded → received (separate from customer refunds). */
const props = defineProps<{ projectId?: string; salesOrderId?:string }>()

const api = useApi()
const session = useServerSession()
const claims = useFinanceQuery<SupplierClaimDto[]>(async () => (await api.finance.supplierClaims({ projectId: props.projectId, salesOrderId: props.salesOrderId })).data, { watch: [() => props.projectId, () => props.salesOrderId] })

const showCreate = ref(false)
const evidenceId = ref<string|null>(null)
const receiving = ref<SupplierClaimDto | null>(null)
const receiveOpen = computed({ get: () => !!receiving.value, set: (v: boolean) => { if (!v) { receiving.value = null } } })
const voiding = ref<SupplierClaimDto | null>(null)
const voidAction = useFinanceAction((reason: string) => api.finance.voidSupplierClaim(voiding.value!.id, reason))
async function confirmVoid (value: { reason: string }) {
  if (await voidAction.run(value.reason)) { voiding.value = null }
}
const BASIS: Record<SupplierClaimDto['basis'], string> = { 'cost-recovery': 'Pemulihan biaya', 'deposit-recovery': 'Pengembalian deposit' }
</script>

<template>
  <section class="rounded-xl border border-border bg-card p-5 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-[15px] font-semibold">
          Klaim ke supplier
        </h3>
        <p class="text-xs text-muted-foreground">
          Terpisah dari refund ke customer. Nilai dan waktunya bisa berbeda.
        </p>
      </div>
      <Button v-if="session.can('finance.manage-payables')" size="sm" variant="outline" @click="showCreate = true">
        <HandCoins class="mr-1.5 h-4 w-4" /> Catat klaim
      </Button>
    </div>
    <FinanceErrorState v-if="claims.error.value && !claims.data.value" :error="claims.error.value" compact class="mt-4" @retry="claims.refresh" />
    <div v-else-if="!claims.data.value" class="mt-4 h-12 animate-pulse rounded-lg bg-muted" />
    <p v-else-if="!claims.data.value.length" class="mt-4 text-sm text-muted-foreground">
      Tidak ada klaim ke supplier.
    </p>
    <div v-else class="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
      <div v-for="c in claims.data.value" :key="c.id" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" :class="c.status === 'void' && 'opacity-60'">
        <div class="min-w-0">
          <p class="truncate font-medium">
            {{ c.vendorName }} · {{ BASIS[c.basis] }}<span v-if="c.status === 'void'" class="text-xs font-normal text-muted-foreground"> · dibatalkan</span>
          </p>
          <p class="truncate text-xs text-muted-foreground">
            {{ formatBusinessDate(c.recognizedOn) }} · {{ c.reason }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" @click="evidenceId=c.id">
            Bukti asli
          </Button>
          <span class="text-right">
            <FinanceAmount :value="c.amountMinor" class="block font-medium" />
            <span v-if="c.status === 'recorded'" class="block text-xs text-muted-foreground">sisa <FinanceAmount :value="c.outstandingMinor" /></span>
          </span>
          <Button
            v-if="c.status === 'recorded' && c.outstandingMinor !== '0' && session.can('finance.post-cash')"
            size="sm"
            variant="outline"
            @click="receiving = c"
          >
            <Wallet class="mr-1.5 h-3.5 w-3.5" /> Terima
          </Button>
          <Button
            v-if="c.status === 'recorded' && c.settledMinor === '0' && session.can('finance.manage-payables')"
            size="icon"
            variant="ghost"
            class="h-7 w-7"
            :aria-label="`Batalkan klaim ${c.id}`"
            @click="voiding = c"
          >
            <Undo2 class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <PrivateEvidenceSheet v-model:source-id="evidenceId" source-type="supplier_claim" :can-upload="session.can('finance.post-cash')" />
    <FinanceSupplierClaimDialog v-model:open="showCreate" :project-id="projectId" :sales-order-id="salesOrderId" />
    <FinanceVendorRefundDialog v-model:open="receiveOpen" :claim="receiving" />
    <FinanceReasonDialog
      :open="!!voiding"
      title="Batalkan klaim supplier"
      description="Klaim tetap tercatat sebagai riwayat; dampak accounting dibalik dan deposit kembali tersedia."
      confirm-label="Batalkan klaim"
      tone="destructive"
      :pending="voidAction.pending.value"
      :error="voidAction.error.value"
      @update:open="v => { if (!v) voiding = null }"
      @confirm="confirmVoid"
    />
  </section>
</template>
