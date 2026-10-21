<script setup lang="ts">
const props = defineProps<{ salesOrderId: string }>()
const api = useApi()
const session = useServerSession()
const cursor = ref<string|null>(null)
const summary = useFinanceQuery(async () => (await api.accounting.orderSummary(props.salesOrderId)).data, { watch: [() => props.salesOrderId] })
const invoices = useFinanceQuery(() => api.finance.payables({ salesOrderId: props.salesOrderId, view: 'all', cursor: cursor.value ?? undefined }), { watch: [() => props.salesOrderId, cursor] })
const createInvoice = ref(false)
const invoiceId = ref<string|null>(null)
const cancelOpen = ref(false)
watch(() => props.salesOrderId, () => { cursor.value = null; invoiceId.value = null })
</script>
<template>
  <section class="space-y-4" aria-label="Keuangan order mandiri">
    <section class="space-y-3 rounded-xl border bg-card p-5">
      <h3 class="font-semibold">
        Hasil accounting order
      </h3>
      <FinanceErrorState v-if="summary.error.value" :error="summary.error.value" @retry="summary.refresh" />
      <p v-else-if="!summary.data.value" role="status">
        Memuat hasil order…
      </p>
      <template v-else>
        <dl v-if="summary.data.value.figures" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt class="text-xs text-muted-foreground">
              Pendapatan diakui
            </dt><dd><FinanceAmount :value="summary.data.value.figures.revenueMinor" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Biaya langsung diakui
            </dt><dd><FinanceAmount :value="summary.data.value.figures.directCostMinor" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Kontribusi sebelum overhead/pajak
            </dt><dd><FinanceAmount :value="summary.data.value.figures.contributionMinor" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Utang invoice supplier
            </dt><dd><FinanceAmount :value="summary.data.value.figures.payableMinor" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Biaya belum ditagih
            </dt><dd><FinanceAmount :value="summary.data.value.figures.accruedCostMinor" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Biaya dibayar di muka
            </dt><dd><FinanceAmount :value="summary.data.value.figures.prepaidCostMinor" /></dd>
          </div>
        </dl>
        <p v-for="reason in summary.data.value.reasons" :key="reason.code" class="text-xs text-muted-foreground">
          {{ reason.message }}
        </p>
      </template>
    </section>
    <FinanceFulfillmentCard :sales-order-id="salesOrderId" />
    <section class="space-y-2 rounded-xl border bg-card p-5">
      <h3 class="font-semibold">
        Pembatalan tagihan & refund customer
      </h3>
      <p class="text-xs text-muted-foreground">
        Kasus keuangan tidak otomatis menyatakan uang sudah dibayar atau mengubah jasa yang sudah diberikan. Pembatalan operasional order yang sudah ditagih membuat kasus ini secara otomatis.
      </p>
      <Button v-if="session.can('project-order.request-cancellation')" size="sm" variant="outline" @click="cancelOpen=true">
        Ajukan pembatalan tagihan/refund
      </Button>
      <FinanceRefundCaseList :sales-order-id="salesOrderId" />
    </section>
    <section class="space-y-3 rounded-xl border bg-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-semibold">
          Invoice supplier order
        </h3><Button v-if="session.can('finance.manage-payables')" size="sm" variant="outline" @click="createInvoice=true">
          Catat invoice asli
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">
        Invoice tidak otomatis menjadi biaya jasa atau pembayaran. Review dan bayar lewat alur Utang Vendor yang sama.
      </p>
      <FinanceErrorState v-if="invoices.error.value" :error="invoices.error.value" @retry="invoices.refresh" />
      <p v-else-if="!invoices.data.value" role="status">
        Memuat invoice supplier…
      </p>
      <template v-else>
        <p v-if="!invoices.data.value.data.length" class="text-sm text-muted-foreground">
          Belum ada invoice supplier tertaut.
        </p>
        <button v-for="i in invoices.data.value.data" :key="i.id" type="button" class="flex w-full flex-wrap justify-between gap-2 rounded-lg border p-3 text-left text-sm" @click="invoiceId=i.id">
          <span>{{ i.vendorInvoiceNumber }} · {{ i.vendor.name }} · {{ i.status }}</span><FinanceAmount :value="i.totalMinor" />
        </button>
        <Button v-if="invoices.data.value.meta.pagination?.nextCursor" size="sm" variant="outline" @click="cursor=invoices.data.value!.meta.pagination!.nextCursor!">
          Berikutnya
        </Button>
        <Button v-if="cursor" size="sm" variant="outline" @click="cursor=null">
          Halaman pertama
        </Button>
      </template>
    </section>
    <FinanceSupplierClaimsCard :sales-order-id="salesOrderId" />
    <FinanceVendorInvoiceDialog v-model:open="createInvoice" :sales-order-id="salesOrderId" />
    <FinanceVendorInvoiceSheet v-model:invoice-id="invoiceId" />
    <FinanceCancellationDialog v-model:open="cancelOpen" :subject="{type:'sales_order',id:salesOrderId,label:`Order ${salesOrderId}`}" />
  </section>
</template>
