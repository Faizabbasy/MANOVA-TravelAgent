<script setup lang="ts">
import { computed, reactive } from 'vue'
import FinanceMoneyInput from './FinanceMoneyInput.vue'
import type { ChangeBillingDto, ChangeBillingInput } from '~/types/api'
import { formatMoneyMinor } from '~/lib/money'
const props = defineProps<{ source: ChangeBillingDto; pending: boolean; error?: string }>()
const emit = defineEmits<{ save: [input: ChangeBillingInput]; cancel: [] }>()
const form = reactive({ mode: '', basis: '', reason: '', confirmed: false, allocations: [{ target: '', amount: '', dueDate: '' }] })
const total = computed(() => form.mode === 'no-charge' ? '0' : form.basis === 'commercial' ? props.source.commercialMinor : form.basis === 'fee' ? props.source.feeMinor : form.basis === 'separate' ? (BigInt(props.source.commercialMinor) + BigInt(props.source.feeMinor)).toString() : null)
const allocated = computed(() => form.allocations.reduce((n, a) => n + (/^\d+$/.test(a.amount) ? BigInt(a.amount) : 0n), 0n).toString())
const valid = computed(() => form.confirmed && form.reason.trim().length >= 5 && (form.mode === 'no-charge' || (form.mode === 'charge' && total.value !== null && BigInt(total.value) > 0n && total.value === allocated.value && form.allocations.every(a => a.target !== '' && /^\d+$/.test(a.amount) && BigInt(a.amount) > 0n && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)) && new Set(form.allocations.map(a => a.target)).size === form.allocations.length)))
function submit () {
  if (props.pending || !valid.value) { return }
  emit('save', { mode: form.mode as ChangeBillingInput['mode'], basis: form.mode === 'no-charge' ? 'none' : form.basis as ChangeBillingInput['basis'], reason: form.reason.trim(), allocations: form.mode === 'no-charge' ? [] : form.allocations.map(a => ({ ...(a.target === 'project' ? {} : { salesOrderId: a.target }), amountMinor: a.amount, dueDate: a.dueDate })) })
}
</script>
<template>
  <form class="space-y-4 rounded-lg border p-4" aria-label="Rencana tagihan perubahan" @submit.prevent="submit">
    <p class="text-sm">
      Komersial {{ formatMoneyMinor(source.commercialMinor) }} · fee {{ formatMoneyMinor(source.feeMinor) }}. Pilih komponen sesuai persetujuan customer. Pilih keduanya hanya jika dua komponen terpisah.
    </p>
    <fieldset :disabled="pending" class="space-y-3">
      <label class="block text-sm">Keputusan penagihan
        <select v-model="form.mode" name="mode" required class="block h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Pilih keputusan</option><option value="charge">Ditagihkan</option><option value="no-charge">Tanpa tagihan</option></select>
      </label>
      <template v-if="form.mode==='charge'">
        <label class="block text-sm">Komponen yang disetujui
          <select v-model="form.basis" name="basis" required class="block h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Pilih komponen</option><option value="commercial">Nilai komersial saja</option><option value="fee">Fee saja</option><option value="separate">Komersial dan fee terpisah</option></select>
        </label>
        <p class="text-sm">
          Total sumber: {{ total===null ? 'Belum dipilih' : formatMoneyMinor(total) }} · total pembagian: {{ formatMoneyMinor(allocated) }}
        </p>
        <div v-for="(a,i) in form.allocations" :key="i" class="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          <label class="text-sm">Customer sumber
            <select v-model="a.target" :name="`target-${i}`" required class="block h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Pilih project atau peserta</option><option v-for="t in source.targets" :key="t.salesOrderId ?? 'project'" :value="t.salesOrderId ?? 'project'">{{ t.partyName }} · {{ t.salesOrderId ?? 'Kontrak project' }}</option></select>
          </label>
          <label class="text-sm">Nominal pembagian<FinanceMoneyInput v-model="a.amount" :name="`amount-${i}`" required /></label>
          <label class="text-sm">Jatuh tempo<input v-model="a.dueDate" type="date" :name="`due-${i}`" required class="block h-10 w-full rounded-md border bg-background px-3"></label>
          <button v-if="form.allocations.length>1" type="button" class="text-sm text-destructive" @click="form.allocations.splice(i,1)">
            Hapus pembagian
          </button>
        </div>
        <Button v-if="form.allocations.length<source.targets.length" type="button" variant="outline" @click="form.allocations.push({target:'',amount:'',dueDate:''})">
          Tambah customer
        </Button>
      </template>
      <label class="block text-sm">Alasan / referensi persetujuan<textarea
        v-model="form.reason"
        name="reason"
        required
        minlength="5"
        maxlength="500"
        class="block min-h-20 w-full rounded-md border bg-background p-3"
      /></label>
      <label class="flex items-start gap-2 text-sm"><input v-model="form.confirmed" name="confirmed" type="checkbox">Saya memastikan komponen dan customer sudah benar. Persetujuan CR membuat draft serta menambah kontrak sesuai alokasi; belum menerima uang atau mengakui jasa.</label>
    </fieldset>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <div class="flex gap-2">
      <Button type="submit" :disabled="pending || !valid">
        Simpan rencana
      </Button><Button type="button" variant="outline" :disabled="pending" @click="emit('cancel')">
        Batal
      </Button>
    </div>
  </form>
</template>
