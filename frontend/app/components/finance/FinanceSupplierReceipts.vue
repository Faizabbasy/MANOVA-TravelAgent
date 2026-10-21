<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import type { SupplierReceiptMatchInput } from '~/types/api'
const props = defineProps<{invoiceId:string;status:string}>()
const api = useApi(); const session = useServerSession()
const data = useFinanceQuery(async () => (await api.finance.supplierReceiptMatches(props.invoiceId)).data, { watch: [() => props.invoiceId, () => props.status], enabled: () => session.can('finance.view-project-finance') })
const editing = ref(false); const voidId = ref<string|null>(null)
let previous = ''; let key = newIdempotencyKey()
function requestKey (input:unknown) { const next = JSON.stringify(input); if (next !== previous) { previous = next; key = newIdempotencyKey() } return key }
const save = useFinanceAction((input:SupplierReceiptMatchInput) => api.finance.matchSupplierReceipt(props.invoiceId, input, requestKey({ id: props.invoiceId, input })))
async function submit (input:SupplierReceiptMatchInput) { if (await save.run(input)) { editing.value = false } }
const cancel = useFinanceAction((input:{reason:string}) => api.finance.voidSupplierReceiptMatch(voidId.value!, input.reason, requestKey({ id: voidId.value, input })))
async function voidMatch (input:{reason:string}) { if (await cancel.run(input)) { voidId.value = null } }
</script>
<template>
  <section v-if="session.can('finance.view-project-finance')" class="space-y-3" aria-label="Pencocokan jasa supplier">
    <h3 class="text-sm font-semibold">
      Jasa yang ditagih
    </h3>
    <FinanceErrorState v-if="data.error.value" :error="data.error.value" compact @retry="data.refresh" />
    <p v-else-if="!data.data.value" role="status" class="text-sm">
      Memuat penerimaan jasa…
    </p>
    <template v-else>
      <p v-if="data.data.value.mode==='unconfigured'" class="text-sm text-muted-foreground">
        Pencocokan terstruktur belum dikonfigurasi. Lengkapi kebijakan supplier; sumber lama perlu review mapping/koreksi.
      </p>
      <p v-else class="text-sm">
        Belum ditautkan ke jasa: <FinanceAmount :value="data.data.value.remainingMinor" />. Persetujuan invoice belum membuktikan jasa diterima.
      </p>
      <article v-for="m in data.data.value.matches" :key="m.id" class="space-y-1 rounded-lg border p-3 text-sm">
        <p>{{ m.fulfillmentId }} · <FinanceAmount :value="m.actualMinor" /> · {{ m.status==='void' ? 'Dibatalkan' : m.closesReceipt ? 'Tagihan terakhir' : 'Tagihan parsial' }}</p>
        <p class="text-xs text-muted-foreground">
          {{ m.reason }} · dibukukan {{ m.postingDate }}<span v-if="m.voidReason"> · {{ m.voidReason }}</span>
        </p>
        <AccountingSourceStatus source-type="vendor_fulfillment_match" :source-id="m.id" />
        <Button v-if="m.status==='recorded' && session.can('finance.manage-payables')" size="sm" variant="outline" @click="voidId=m.id;cancel.reset()">
          Batalkan pencocokan
        </Button>
      </article>
      <p v-if="data.data.value.truncated" class="text-xs">
        Daftar dibatasi 100 sumber; persempit invoice ke service order/booking yang ditagih.
      </p>
      <FinanceSupplierReceiptForm
        v-if="editing"
        :source="data.data.value"
        :today="todayJakarta()"
        :pending="save.pending.value"
        :error="save.error.value?.message"
        @save="submit"
        @cancel="editing=false"
      />
      <Button v-else-if="status==='approved' && data.data.value.mode==='receipt-links' && BigInt(data.data.value.remainingMinor)>0n && session.can('finance.manage-payables')" variant="outline" @click="editing=true;save.reset()">
        Cocokkan penerimaan jasa
      </Button>
    </template>
    <FinanceReasonDialog
      :open="!!voidId"
      title="Batalkan pencocokan jasa?"
      description="Selisih biaya dibalik dan sisa invoice/estimasi dibuka kembali. Invoice serta pembayaran tetap mengikuti sumber existing."
      confirm-label="Batalkan pencocokan"
      :pending="cancel.pending.value"
      :error="cancel.error.value"
      @update:open="v=>{if(!v){voidId=null}}"
      @confirm="voidMatch"
    />
  </section>
</template>
