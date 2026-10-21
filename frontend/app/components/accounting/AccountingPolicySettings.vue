<script setup lang="ts">
import { computed } from 'vue'
import type { AccountingPolicyInput } from '~/types/api'
type Settings = NonNullable<AccountingPolicyInput['settings']>
const props = defineProps<{sourceKind:string;modelValue:Settings}>()
const emit = defineEmits<{ 'update:modelValue':[value:Settings] }>()
function change (key:keyof Settings, value:string) {
  const next = { ...props.modelValue }
  if (!value) { delete next[key] } else { Object.assign(next, { [key]: value }) }
  emit('update:modelValue', next)
}
const categories = computed(() => props.sourceKind === 'company_expense'
  ? [['office', 'Kantor/sewa'], ['utilities', 'Utilitas'], ['marketing', 'Marketing'], ['other', 'Biaya lainnya']]
  : props.sourceKind === 'employee_advance'
    ? [['office', 'Kantor'], ['marketing', 'Marketing'], ['travel', 'Perjalanan dinas'], ['other', 'Biaya lainnya']]
    : [['office', 'Kantor'], ['marketing', 'Marketing'], ['technology', 'Teknologi'], ['travel', 'Perjalanan dinas'], ['professional', 'Jasa profesional'], ['bank_fee', 'Biaya bank'], ['transportation', 'Transportasi'], ['meals', 'Konsumsi'], ['supplies', 'Perlengkapan'], ['accommodation', 'Akomodasi'], ['emergency', 'Darurat'], ['other', 'Biaya lainnya'], ['other_income', 'Penerimaan lain']])
function classify (category:string, value:string) {
  const classifications = { ...props.modelValue.classifications }
  if (!value) { delete classifications[category] } else { classifications[category] = value }
  const next = { ...props.modelValue }; if (Object.keys(classifications).length) { next.classifications = classifications } else { delete next.classifications }
  emit('update:modelValue', next)
}
const cls = 'mt-1 block h-10 w-full rounded border bg-background px-3'
</script>
<template>
  <fieldset class="space-y-3 sm:col-span-2" aria-label="Metode sumber">
    <label v-if="['vendor_billing','supplier_fulfillment'].includes(sourceKind)" class="block text-sm">Pencocokan biaya supplier<select name="costMatching" :value="modelValue.costMatching ?? ''" :class="cls" @change="change('costMatching', ($event.target as HTMLSelectElement).value)"><option value="">Belum diputuskan</option><option value="receipt-links">Invoice ke penerimaan jasa tertentu</option></select></label>
    <label v-if="sourceKind==='vendor_billing'" class="block text-sm">Perlakuan invoice<select name="invoiceTreatment" :value="modelValue.invoiceTreatment ?? ''" :class="cls" @change="change('invoiceTreatment', ($event.target as HTMLSelectElement).value)"><option value="">Belum diputuskan</option><option value="prepaid">Menunggu pencocokan jasa</option></select></label>
    <label v-if="sourceKind==='customer_billing'" class="block text-sm">Hak tagih<select name="billingRight" :value="modelValue.billingRight ?? ''" :class="cls" @change="change('billingRight', ($event.target as HTMLSelectElement).value)"><option value="">Belum diputuskan</option><option value="unconditional">Hak tagih tanpa syarat telah timbul</option></select></label>
    <label v-if="sourceKind==='prepaid_opex' || sourceKind==='asset'" class="block text-sm">Metode pembebanan<select name="method" :value="modelValue.method ?? ''" :class="cls" @change="change('method', ($event.target as HTMLSelectElement).value)"><option value="">Belum diputuskan</option><option v-if="sourceKind==='prepaid_opex'" value="equal-months">Sama besar per bulan</option><option v-else value="straight-line">Penyusutan garis lurus</option></select></label>
    <template v-if="['manual_cash','company_expense','employee_advance'].includes(sourceKind)">
      <p class="text-sm text-muted-foreground">
        Pilih sifat kategori yang memang telah diputuskan. Gaji, aset dan pajak memakai sumber khususnya. Pilihan kosong tetap membutuhkan review.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <label v-for="[key,label] in categories" :key="key" class="text-sm">{{ label }}<select :name="`classification-${key}`" :value="modelValue.classifications?.[key] ?? ''" :class="cls" @change="classify(key, ($event.target as HTMLSelectElement).value)"><option value="">Belum diputuskan</option><option v-if="key==='other_income'" value="other-revenue">Pendapatan lain</option><template v-else><option value="office-expense">Biaya perusahaan</option><option v-if="sourceKind!=='company_expense'" value="direct-cost">Biaya langsung perjalanan</option><option v-if="sourceKind!=='company_expense'" value="bank-fee">Biaya bank</option></template></select></label>
      </div>
    </template>
    <template v-if="sourceKind==='owner_funds'">
      <p class="text-sm text-muted-foreground">
        Ikuti bentuk usaha dan dasar transaksi owner. Pilihan ini belum mengesahkan kebijakan produksi.
      </p>
      <label v-for="[key,label] in ([['contributionRole','Setoran owner'],['withdrawalRole','Pengambilan owner']] as const)" :key="key" class="block text-sm">{{ label }}<select :name="key" :value="modelValue[key] ?? ''" :class="cls" @change="change(key, ($event.target as HTMLSelectElement).value)"><option value="">Belum diputuskan</option><option value="capital">Modal</option><option value="owner-funds">Dana owner/prive</option><option value="loan" disabled>Pinjaman: gunakan Catat Pinjaman beserta syaratnya</option></select></label>
    </template>
  </fieldset>
</template>
