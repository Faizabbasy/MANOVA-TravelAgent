<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { PrepaidExpenseInput } from '~/types/api'

const props = defineProps<{ today: string; accounts: { value: string; label: string }[]; pending: boolean; error?: string | null; fieldErrors?: Record<string, string> }>()
const emit = defineEmits<{ submit: [input: PrepaidExpenseInput]; cancel: [] }>()
const form = reactive({ bankAccountId: '', amountMinor: '', effectiveDate: props.today, description: '', evidenceRef: '', startMonth: '', months: 12, method: '' })
const ready = computed(() => !props.pending && form.bankAccountId && /^\d+$/.test(form.amountMinor) && form.description.trim().length >= 3 && form.evidenceRef.trim().length >= 3 && form.startMonth && form.method === 'equal-months' && Number.isInteger(form.months) && form.months >= 1 && form.months <= 120)
function submit () {
  if (!ready.value) { return }
  emit('submit', {
    bankAccountId: form.bankAccountId,
    amountMinor: form.amountMinor,
    effectiveDate: form.effectiveDate,
    description: form.description.trim(),
    evidenceRef: form.evidenceRef.trim(),
    startMonth: form.startMonth,
    months: form.months,
    method: 'equal-months'
  })
}
</script>

<template>
  <form class="space-y-4 rounded-lg border p-4" aria-label="Bayar biaya kantor di muka" @submit.prevent="submit">
    <p class="text-sm text-muted-foreground">
      Kas keluar sekali. Biaya dibebankan saat setiap bulan manfaat berakhir. Pembayaran setelah masa manfaat mulai memakai alur biaya/utang, bukan form ini.
    </p>
    <fieldset :disabled="pending" class="grid gap-3 sm:grid-cols-2">
      <label class="space-y-1 text-sm">Keterangan
        <input
          v-model="form.description"
          name="description"
          required
          minlength="3"
          maxlength="200"
          class="block h-10 w-full rounded-md border bg-background px-3"
        >
        <span v-if="fieldErrors?.description" class="text-destructive">{{ fieldErrors.description }}</span>
      </label>
      <label class="space-y-1 text-sm">Referensi bukti unik
        <input
          v-model="form.evidenceRef"
          name="evidenceRef"
          required
          minlength="3"
          maxlength="200"
          class="block h-10 w-full rounded-md border bg-background px-3"
          aria-describedby="prepaid-proof-help"
        >
        <span id="prepaid-proof-help" class="block text-xs text-muted-foreground">Nomor kontrak/bukti pembayaran. Ini referensi, bukan unggahan file.</span>
        <span v-if="fieldErrors?.evidenceRef" class="text-destructive">{{ fieldErrors.evidenceRef }}</span>
      </label>
      <label class="space-y-1 text-sm">Rekening pembayaran
        <select v-model="form.bankAccountId" name="bankAccountId" required class="block h-10 w-full rounded-md border bg-background px-3">
          <option value="" disabled>Pilih rekening</option>
          <option v-for="a in accounts" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
        <span v-if="fieldErrors?.bankAccountId" class="text-destructive">{{ fieldErrors.bankAccountId }}</span>
      </label>
      <label class="space-y-1 text-sm">Nominal pembayaran (rupiah)
        <input
          v-model="form.amountMinor"
          name="amountMinor"
          required
          inputmode="numeric"
          pattern="[0-9]+"
          maxlength="16"
          class="block h-10 w-full rounded-md border bg-background px-3"
        >
        <span v-if="fieldErrors?.amountMinor" class="text-destructive">{{ fieldErrors.amountMinor }}</span>
      </label>
      <label class="space-y-1 text-sm">Tanggal pembayaran aktual
        <input
          v-model="form.effectiveDate"
          name="effectiveDate"
          type="date"
          :max="today"
          required
          class="block h-10 w-full rounded-md border bg-background px-3"
        >
        <span v-if="fieldErrors?.effectiveDate" class="text-destructive">{{ fieldErrors.effectiveDate }}</span>
      </label>
      <label class="space-y-1 text-sm">Bulan manfaat pertama (mulai tanggal 1)
        <input v-model="form.startMonth" name="startMonth" type="month" required class="block h-10 w-full rounded-md border bg-background px-3">
        <span v-if="fieldErrors?.startMonth" class="text-destructive">{{ fieldErrors.startMonth }}</span>
      </label>
      <label class="space-y-1 text-sm">Jumlah bulan manfaat
        <input
          v-model.number="form.months"
          name="months"
          type="number"
          min="1"
          max="120"
          required
          class="block h-10 w-full rounded-md border bg-background px-3"
        >
        <span v-if="fieldErrors?.months" class="text-destructive">{{ fieldErrors.months }}</span>
      </label>
      <label class="space-y-1 text-sm">Metode pembebanan
        <select v-model="form.method" name="method" required class="block h-10 w-full rounded-md border bg-background px-3">
          <option value="" disabled>Pilih sesuai kebijakan yang berlaku</option>
          <option value="equal-months">Sama besar per bulan; sisa pembulatan di bulan terakhir</option>
        </select>
        <span v-if="fieldErrors?.method" class="text-destructive">{{ fieldErrors.method }}</span>
      </label>
    </fieldset>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <div class="flex flex-wrap gap-2">
      <button type="submit" :disabled="!ready" class="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
        {{ pending ? 'Mencatat…' : 'Catat pembayaran & jadwal' }}
      </button>
      <button type="button" :disabled="pending" class="h-10 rounded-md border px-4 text-sm" @click="emit('cancel')">
        Batal
      </button>
    </div>
  </form>
</template>
