<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import type { ChangeBillingInput } from '~/types/api'
const props = defineProps<{ changeRequestId: string; status: string }>()
const api = useApi(); const session = useServerSession()
const data = useFinanceQuery(async () => (await api.finance.changeBilling(props.changeRequestId)).data, { watch: [() => props.changeRequestId, () => props.status], enabled: () => session.can('finance.view-cash') })
const editing = ref(false); const invoiceId = ref<string|null>(null)
let previous = ''; let key = newIdempotencyKey()
function requestKey (body: unknown) { const next = JSON.stringify(body); if (next !== previous) { previous = next; key = newIdempotencyKey() } return key }
const save = useFinanceAction((input: ChangeBillingInput) => api.finance.configureChangeBilling(props.changeRequestId, input, requestKey({ id: props.changeRequestId, input })))
async function submit (input: ChangeBillingInput) { if (await save.run(input)) { editing.value = false } }
const voidId = ref<string|null>(null)
const cancel = useFinanceAction((v: { reason: string }) => api.finance.voidChangeBilling(voidId.value!, v.reason, requestKey({ id: voidId.value, reason: v.reason })))
async function voidPlan (value: { reason: string }) { if (await cancel.run(value)) { voidId.value = null } }
</script>
<template>
  <SectionCard v-if="session.can('finance.view-cash')" title="Tagihan dari perubahan">
    <p class="mb-3 text-sm text-muted-foreground">
      Rencana yang dikonfirmasi Finance membuat draft otomatis saat CR disetujui. Terbitkan dan terima pembayaran melalui invoice existing.
    </p>
    <FinanceErrorState v-if="data.error.value" :error="data.error.value" @retry="data.refresh" />
    <p v-else-if="!data.data.value" role="status">
      Memuat sumber perubahan…
    </p>
    <template v-else>
      <p v-if="data.data.value.needsDecision" role="status" class="mb-3 text-sm">
        Dampak biaya belum mempunyai keputusan penagihan.
      </p>
      <article v-for="p in data.data.value.plans" :key="p.id" class="mb-3 space-y-2 rounded-lg border p-3 text-sm">
        <p>{{ p.id }} · {{ p.status==='draft' ? 'Menunggu persetujuan CR' : p.status==='void' ? 'Dibatalkan' : 'Diterapkan' }} · <FinanceAmount :value="p.totalMinor" /></p>
        <p>{{ p.reason }}<span v-if="p.voidReason"> · Pembatalan: {{ p.voidReason }}</span></p>
        <div v-for="a in p.allocations" :key="a.id" class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ a.partyName }} · {{ a.salesOrderId ?? 'Kontrak project' }} · <FinanceAmount :value="a.amountMinor" /> · jatuh tempo {{ a.dueDate }}</span>
          <Button v-if="a.invoiceId && a.invoiceStatus" size="sm" variant="outline" @click="invoiceId=a.invoiceId">
            Buka invoice · {{ a.invoiceStatus }}
          </Button>
        </div>
        <Button v-if="p.status!=='void' && session.can('finance.manage-receivables')" size="sm" variant="outline" @click="voidId=p.id;cancel.reset()">
          Batalkan rencana
        </Button>
      </article>
      <FinanceChangeBillingForm
        v-if="editing"
        :source="data.data.value"
        :pending="save.pending.value"
        :error="save.error.value?.message"
        @save="submit"
        @cancel="editing=false"
      />
      <Button v-else-if="session.can('finance.manage-receivables') && !['rejected','cancelled'].includes(data.data.value.changeStatus) && !data.data.value.plans.some(p=>p.status!=='void')" variant="outline" @click="editing=true;save.reset()">
        Tentukan penagihan
      </Button>
    </template>
    <FinanceReasonDialog
      :open="!!voidId"
      title="Batalkan rencana tagihan?"
      description="Invoice issued harus di-void lebih dulu. Tambahan kontrak dikembalikan tepat sekali; hak jasa yang sudah dipenuhi perlu dikoreksi pada sumbernya."
      confirm-label="Batalkan rencana"
      :pending="cancel.pending.value"
      :error="cancel.error.value"
      @update:open="v=>{if(!v){voidId=null}}"
      @confirm="voidPlan"
    />
    <FinanceInvoiceSheet v-model:invoice-id="invoiceId" />
  </SectionCard>
</template>
