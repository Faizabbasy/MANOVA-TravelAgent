<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { SupplierReceiptMatchInput, SupplierReceiptWorkspaceDto } from '~/types/api'
const props = defineProps<{source:SupplierReceiptWorkspaceDto;today:string;pending:boolean;error?:string}>()
const emit = defineEmits<{save:[input:SupplierReceiptMatchInput];cancel:[]}>()
const form = reactive({ fulfillmentId: '', actualMinor: '', closesReceipt: false, postingDate: '', reason: '', confirmed: false })
const receipt = computed(() => props.source.receipts.find(r => r.id === form.fulfillmentId))
const economicDate = computed(() => receipt.value ? [receipt.value.fulfilledOn, props.source.invoiceDate].sort().at(-1)! : props.source.invoiceDate)
watch(() => form.fulfillmentId, () => {
  const r = receipt.value
  form.closesReceipt = false; form.confirmed = false; form.postingDate = economicDate.value
  form.actualMinor = r ? props.source.remainingMinor : ''
})
const valid = computed(() => {
  const r = receipt.value
  if (!r || !/^\d{1,16}$/.test(form.actualMinor) || form.reason.trim().length < 5 || !form.confirmed) { return false }
  const amount = BigInt(form.actualMinor)
  return amount > 0n && amount <= BigInt(props.source.remainingMinor) && BigInt(r.remainingMinor) > 0n && (form.closesReceipt || amount < BigInt(r.remainingMinor)) && form.postingDate >= economicDate.value && form.postingDate <= props.today
})
function submit () {
  if (props.pending || !valid.value) { return }
  emit('save', { fulfillmentId: form.fulfillmentId, actualMinor: form.actualMinor, closesReceipt: form.closesReceipt, postingDate: form.postingDate, reason: form.reason.trim() })
}
</script>
<template>
  <form aria-label="Cocokkan penerimaan jasa" class="space-y-3 rounded-lg border p-3 text-sm" @submit.prevent="submit">
    <p>Nominal dan tanggal berasal dari invoice serta penerimaan jasa existing. Pencocokan tidak membayar uang.</p>
    <fieldset :disabled="pending" class="space-y-3">
      <label class="block">Penerimaan jasa
        <select v-model="form.fulfillmentId" name="fulfillmentId" required class="mt-1 block h-10 w-full rounded border bg-background px-2"><option value="" disabled>Pilih sumber yang sama</option><option v-for="r in source.receipts.filter(r=>BigInt(r.remainingMinor)>0n)" :key="r.id" :value="r.id">{{ r.id }} · {{ r.fulfilledOn }} · sisa Rp{{ r.remainingMinor }}</option></select>
      </label>
      <p v-if="receipt" class="break-words text-xs text-muted-foreground">
        {{ receipt.evidence }} · Estimasi sumber Rp{{ receipt.amountMinor }} · invoice {{ source.invoiceDate }}
      </p>
      <label class="block">Bagian invoice untuk jasa ini (rupiah)
        <input
          v-model="form.actualMinor"
          name="actualMinor"
          required
          inputmode="numeric"
          pattern="[0-9]+"
          maxlength="16"
          class="mt-1 block h-10 w-full rounded border bg-background px-3"
        >
      </label>
      <label class="flex items-start gap-2"><input v-model="form.closesReceipt" name="closesReceipt" type="checkbox" class="mt-1">Ini tagihan terakhir untuk penerimaan jasa tersebut. Tutup sisa estimasi dan akui selisih aktualnya.</label>
      <label class="block">Tanggal pembukuan
        <input
          v-model="form.postingDate"
          name="postingDate"
          type="date"
          required
          :min="economicDate"
          :max="today"
          class="mt-1 block h-10 w-full rounded border bg-background px-3"
        >
      </label>
      <p class="text-xs text-muted-foreground">
        Tanggal asli invoice/jasa tetap. Bila periode terkunci, tinjau koreksi dan pilih periode terbuka yang sah.
      </p>
      <label class="block">Dasar pencocokan<textarea
        v-model="form.reason"
        name="reason"
        required
        minlength="5"
        maxlength="500"
        class="mt-1 block w-full rounded border bg-background p-2"
      /></label>
      <label class="flex items-start gap-2"><input v-model="form.confirmed" name="confirmed" type="checkbox" class="mt-1">Saya memeriksa bahwa invoice ini menagih jasa yang dipilih.</label>
    </fieldset>
    <p v-if="error" role="alert" class="text-destructive">
      {{ error }}
    </p>
    <div class="flex flex-wrap gap-2">
      <Button type="submit" :disabled="pending || !valid">
        Simpan pencocokan
      </Button><Button type="button" variant="outline" :disabled="pending" @click="emit('cancel')">
        Batal
      </Button>
    </div>
  </form>
</template>
