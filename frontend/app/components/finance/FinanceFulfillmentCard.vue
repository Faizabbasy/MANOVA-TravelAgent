<script setup lang="ts">
import { PackageCheck, Truck, Undo2 } from 'lucide-vue-next'
import type { FulfillmentDto, FulfillmentOverviewDto, FulfillmentSide } from '~/types/api'
import { formatBusinessDate } from '~/lib/finance/dates'

/**
 * Operational vs accounting status, kept apart: what service was actually delivered to the customer and received
 * from suppliers, by date and evidence. Booking/SO status is shown as a hint, never as automatic recognition.
 */
const props = defineProps<{ projectId?: string; salesOrderId?:string }>()

const api = useApi()
const session = useServerSession()
const overview = useFinanceQuery<FulfillmentOverviewDto>(async () => (await api.finance.fulfillments({ projectId: props.projectId, salesOrderId: props.salesOrderId })).data, { watch: [() => props.projectId, () => props.salesOrderId] })

const dialogSide = ref<FulfillmentSide | null>(null)
const dialogOpen = computed({ get: () => dialogSide.value !== null, set: (v: boolean) => { if (!v) { dialogSide.value = null } } })
const voiding = ref<FulfillmentDto | null>(null)
const voidAction = useFinanceAction((reason: string) => api.finance.voidFulfillment(voiding.value!.id, reason))
async function confirmVoid (value: { reason: string }) {
  if (await voidAction.run(value.reason)) { voiding.value = null }
}

const recorded = computed(() => (overview.data.value?.items ?? []).filter(i => i.status === 'recorded'))
const pendingHints = computed(() => (overview.data.value?.bookingPrefills ?? []).filter(b => b.operationallyDone).length)
</script>

<template>
  <section class="rounded-xl border border-border bg-card p-5 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-[15px] font-semibold">
          Jasa diberikan & diterima
        </h3>
        <p class="text-xs text-muted-foreground">
          Dasar pengakuan pendapatan dan biaya. Terpisah dari status operasional dan dari pembayaran.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button v-if="session.can('finance.manage-receivables')" size="sm" variant="outline" :disabled="!overview.data.value" @click="dialogSide = 'customer'">
          <PackageCheck class="mr-1.5 h-4 w-4" /> Jasa diberikan
        </Button>
        <Button v-if="session.can('finance.manage-payables')" size="sm" variant="outline" :disabled="!overview.data.value" @click="dialogSide = 'supplier'">
          <Truck class="mr-1.5 h-4 w-4" /> Jasa supplier diterima
        </Button>
      </div>
    </div>

    <FinanceErrorState v-if="overview.error.value && !overview.data.value" :error="overview.error.value" compact class="mt-4" @retry="overview.refresh" />
    <div v-else-if="!overview.data.value" class="mt-4 h-20 animate-pulse rounded-lg bg-muted" />
    <template v-else>
      <dl class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt class="text-xs text-muted-foreground">
            Hak kontrak
          </dt>
          <dd><FinanceAmount :value="overview.data.value.contract.limitMinor" class="font-semibold" /></dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Jasa sudah diberikan
          </dt>
          <dd><FinanceAmount :value="overview.data.value.contract.recognizedMinor" class="font-semibold" /></dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Belum diberikan
          </dt>
          <dd><FinanceAmount :value="overview.data.value.contract.remainingMinor" class="font-semibold" /></dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Jasa supplier diterima
          </dt>
          <dd><FinanceAmount :value="overview.data.value.supplierReceivedMinor" class="font-semibold" /></dd>
        </div>
      </dl>
      <p v-if="pendingHints && !recorded.length" class="mt-2 text-xs text-muted-foreground">
        {{ pendingHints }} booking sudah selesai/terbit secara operasional. Konfirmasi jasa yang diberikan bila memang sudah terpenuhi.
      </p>
      <div v-if="overview.data.value.items.length" class="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
        <div v-for="item in overview.data.value.items" :key="item.id" class="flex items-center justify-between gap-3 px-4 py-3 text-sm" :class="item.status === 'void' && 'opacity-60'">
          <div class="min-w-0">
            <p class="truncate font-medium">
              {{ item.side === 'customer' ? 'Jasa diberikan' : `Jasa ${item.vendorName ?? 'supplier'} diterima` }}
              <span v-if="item.basis === 'estimate'" class="text-xs font-normal text-warning"> · estimasi</span>
              <span v-if="item.isFinal" class="text-xs font-normal text-muted-foreground"> · selesai</span>
              <span v-if="item.status === 'void'" class="text-xs font-normal text-muted-foreground"> · dibatalkan</span>
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ formatBusinessDate(item.fulfilledOn) }} · {{ item.evidence }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <FinanceAmount :value="item.amountMinor" class="font-medium" :class="item.status === 'void' && 'line-through'" />
            <Button
              v-if="item.status === 'recorded' && session.can(item.side === 'customer' ? 'finance.manage-receivables' : 'finance.manage-payables')"
              size="icon"
              variant="ghost"
              class="h-7 w-7"
              :aria-label="`Batalkan pencatatan ${item.id}`"
              @click="voiding = item"
            >
              <Undo2 class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <p v-else class="mt-4 rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
        Belum ada jasa yang dicatat diberikan atau diterima.
      </p>
    </template>

    <FinanceFulfillmentDialog v-model:open="dialogOpen" :side="dialogSide ?? 'customer'" :project-id="projectId" :sales-order-id="salesOrderId" :overview="overview.data.value ?? null" />
    <FinanceReasonDialog
      :open="!!voiding"
      title="Batalkan pencatatan jasa"
      description="Catatan tetap tersimpan; dampak accounting dibalik dengan jurnal koreksi, bukan dihapus."
      confirm-label="Batalkan pencatatan"
      tone="destructive"
      :pending="voidAction.pending.value"
      :error="voidAction.error.value"
      @update:open="v => { if (!v) voiding = null }"
      @confirm="confirmVoid"
    />
  </section>
</template>
