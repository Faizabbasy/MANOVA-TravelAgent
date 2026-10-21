<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import AccountingPolicySettings from './AccountingPolicySettings.vue'
import type { AccountingPolicyInput } from '~/types/api'
const props = defineProps<{purpose:'rehearsal'|'production';pending:boolean;error?:string;resetToken?:number}>()
const emit = defineEmits<{save:[input:AccountingPolicyInput]}>()
const policy = reactive<AccountingPolicyInput>({ sourceKind: 'customer_billing', effectiveFrom: '', principalAgent: 'unknown', recognition: 'unknown', taxTreatment: 'unknown', rationale: '', settings: {} })
const kinds = [['customer_billing', 'Tagihan customer'], ['fulfillment', 'Jasa diberikan'], ['vendor_billing', 'Tagihan supplier'], ['supplier_fulfillment', 'Jasa supplier diterima'], ['manual_cash', 'Transaksi uang umum'], ['customer_receipt', 'Customer membayar'], ['customer_allocation', 'Alokasi penerimaan'], ['vendor_payment', 'Bayar supplier'], ['vendor_allocation', 'Alokasi pembayaran supplier'], ['transfer', 'Transfer rekening'], ['refund', 'Refund/koreksi tagihan'], ['payroll', 'Gaji'], ['commission', 'Komisi'], ['employee_advance', 'Kasbon dan bukti staf'], ['asset', 'Aset dan penyusutan'], ['loan', 'Pinjaman'], ['owner_funds', 'Dana owner'], ['tax', 'Pajak'], ['supplier_claim', 'Klaim supplier'], ['prepaid_opex', 'Biaya kantor dibayar di muka'], ['company_expense', 'Biaya kantor belum ditagih']]
const recognition = computed(() => ['customer_billing', 'fulfillment'].includes(policy.sourceKind) ? ['fulfillment', 'Saat jasa diberikan'] : ['vendor_billing', 'supplier_fulfillment'].includes(policy.sourceKind) ? ['supplier-fulfillment', 'Saat jasa supplier diterima'] : ['source-confirmed', 'Sesuai kejadian sumber yang dikonfirmasi'])
watch(() => policy.sourceKind, () => { policy.settings = {}; policy.recognition = 'unknown'; policy.principalAgent = 'unknown' })
watch(() => props.resetToken, () => { policy.rationale = '' })
function submit () {
  if (props.pending || !policy.effectiveFrom || policy.rationale.trim().length < 5) { return }
  emit('save', { ...policy, rationale: policy.rationale.trim(), settings: { ...policy.settings, ...(policy.settings?.classifications ? { classifications: { ...policy.settings.classifications } } : {}) } })
}
</script>
<template>
  <form aria-label="Usulan kebijakan accounting" class="mt-6 grid gap-3 sm:grid-cols-2" @submit.prevent="submit">
    <p class="text-sm text-muted-foreground sm:col-span-2">
      Simpan usulan dengan dasar yang jelas. Yang belum diputuskan tetap unknown. Pengujian rehearsal membuat versi TEST_ONLY; usulan ini tidak mengaktifkan buku produksi.
    </p>
    <fieldset :disabled="pending" class="contents">
      <label class="text-sm">Sumber<select v-model="policy.sourceKind" name="sourceKind" class="mt-1 block h-10 w-full rounded border bg-background px-3"><option v-for="[value,label] in kinds" :key="value" :value="value">{{ label }}</option></select></label>
      <label class="text-sm">Mulai berlaku<input v-model="policy.effectiveFrom" name="effectiveFrom" type="date" required class="mt-1 block h-10 w-full rounded border bg-background px-3"></label>
      <label class="text-sm">Peran kontrak<select v-model="policy.principalAgent" name="principalAgent" class="mt-1 block h-10 w-full rounded border bg-background px-3"><option value="unknown">Belum diputuskan</option><option value="principal">Penyedia utama/prinsipal</option><option value="agent">Perantara/agen</option><option value="mixed">Campuran per komponen</option><option value="not-applicable">Tidak relevan untuk sumber ini</option></select></label>
      <label class="text-sm">Waktu pengakuan<select v-model="policy.recognition" name="recognition" class="mt-1 block h-10 w-full rounded border bg-background px-3"><option value="unknown">Belum diputuskan</option><option :value="recognition[0]">{{ recognition[1] }}</option></select></label>
      <label class="text-sm">Perlakuan pajak<input
        v-if="purpose==='production'"
        v-model="policy.taxTreatment"
        name="taxTreatment"
        maxlength="500"
        placeholder="Belum divalidasi"
        class="mt-1 block h-10 w-full rounded border bg-background px-3"
      ><select v-else v-model="policy.taxTreatment" name="taxTreatment" class="mt-1 block h-10 w-full rounded border bg-background px-3"><option value="unknown">Belum diputuskan</option><option value="TEST_ONLY_EXCLUDED">Fixture fiktif: pajak tidak disimulasikan</option></select></label>
      <label class="text-sm">Dasar usulan<input
        v-model="policy.rationale"
        name="rationale"
        required
        minlength="5"
        maxlength="500"
        class="mt-1 block h-10 w-full rounded border bg-background px-3"
      ></label>
      <AccountingPolicySettings v-model="policy.settings" :source-kind="policy.sourceKind" />
    </fieldset>
    <p v-if="error" role="alert" class="text-sm text-destructive sm:col-span-2">
      {{ error }}
    </p>
    <Button type="submit" :disabled="pending">
      Simpan usulan kebijakan
    </Button>
  </form>
</template>
