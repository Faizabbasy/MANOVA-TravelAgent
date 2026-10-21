<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { CompanyExpenseInput, CompanyScheduleInput, CompanyExpenseWorkspaceDto } from '~/types/api'
const props = defineProps<{ mode:'schedule'|'expense'; today:string; vendors:{value:string;label:string}[]; schedules:CompanyExpenseWorkspaceDto['schedules']; pending:boolean; error?:string; fieldErrors?:Record<string, string[]> }>()
const emit = defineEmits<{schedule:[input:CompanyScheduleInput];expense:[input:CompanyExpenseInput];cancel:[]}>()
const form = reactive({ scheduleId: '', vendorId: '', description: '', category: '', amountMinor: '', reference: '', period: props.today.slice(0, 7), months: '', dueDay: '', incurredOn: props.today, dueDate: '', basis: '', confirmed: false })
watch(() => form.scheduleId, (id) => {
  const s = props.schedules.find(s => s.id === id)
  if (s) { form.vendorId = s.vendorId; form.description = s.description; form.amountMinor = s.amountMinor }
})
function submit () {
  if (props.pending || !form.confirmed) { return }
  if (props.mode === 'schedule') {
    emit('schedule', { vendorId: form.vendorId, description: form.description.trim(), contractRef: form.reference.trim(), category: form.category, amountMinor: form.amountMinor, startMonth: form.period, months: Number(form.months), dueDay: Number(form.dueDay) })
  } else {
    emit('expense', {
      ...(form.scheduleId ? { scheduleId: form.scheduleId, period: form.period } : { vendorId: form.vendorId, description: form.description.trim(), category: form.category }),
      amountMinor: form.amountMinor,
      incurredOn: form.incurredOn,
      ...(form.dueDate ? { dueDate: form.dueDate } : {}),
      evidenceRef: form.reference.trim(),
      basis: form.basis
    })
  }
}
</script>
<template>
  <form class="space-y-4 rounded-lg border p-4" :aria-label="mode === 'schedule' ? 'Rencana biaya rutin' : 'Biaya kantor terjadi'" @submit.prevent="submit">
    <p class="text-sm text-muted-foreground">
      {{ mode === 'schedule' ? 'Rencana kontrak masuk forecast. Belum menjadi biaya, invoice, atau pembayaran.' : 'Konfirmasi jasa/biaya sudah terjadi dengan bukti atau estimasi andal. Menjadi beban dan utang belum ditagih; tidak membayar uang.' }}
    </p>
    <fieldset :disabled="pending" class="grid gap-3 sm:grid-cols-2">
      <label v-if="mode === 'expense'" class="text-sm">Dari jadwal rutin (opsional)
        <select v-model="form.scheduleId" name="scheduleId" class="block h-10 w-full rounded-md border bg-background px-3"><option value="">Biaya sekali terjadi</option><option v-for="s in schedules" :key="s.id" :value="s.id">{{ s.description }} · {{ s.vendorName }}</option></select>
      </label>
      <template v-if="!form.scheduleId">
        <label class="text-sm">Vendor sebenarnya
          <select v-model="form.vendorId" name="vendorId" required class="block h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Pilih vendor</option><option v-for="v in vendors" :key="v.value" :value="v.value">{{ v.label }}</option></select>
        </label>
        <label class="text-sm">Keterangan<input
          v-model="form.description"
          name="description"
          required
          minlength="3"
          maxlength="200"
          class="block h-10 w-full rounded-md border bg-background px-3"
        ></label>
        <label class="text-sm">Kategori<select v-model="form.category" name="category" required class="block h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Pilih kategori</option><option value="office">Kantor/sewa</option><option value="utilities">Utilitas</option><option value="marketing">Marketing</option><option value="other">Lainnya</option></select></label>
      </template>
      <label class="text-sm">Nominal (rupiah)<input
        v-model="form.amountMinor"
        name="amountMinor"
        required
        pattern="[0-9]+"
        inputmode="numeric"
        maxlength="16"
        class="block h-10 w-full rounded-md border bg-background px-3"
      ></label>
      <label class="text-sm">{{ mode === 'schedule' ? 'Referensi kontrak unik' : 'Referensi bukti unik' }}<input
        v-model="form.reference"
        name="reference"
        required
        minlength="3"
        maxlength="200"
        class="block h-10 w-full rounded-md border bg-background px-3"
      ><span class="text-xs text-muted-foreground">Referensi dokumen, bukan unggahan file.</span></label>
      <label v-if="mode === 'schedule' || form.scheduleId" class="text-sm">{{ mode === 'schedule' ? 'Bulan pertama kontrak' : 'Bulan jadwal' }}<input v-model="form.period" name="period" type="month" required class="block h-10 w-full rounded-md border bg-background px-3"></label>
      <template v-if="mode === 'schedule'">
        <label class="text-sm">Jumlah bulan<input
          v-model="form.months"
          name="months"
          type="number"
          required
          min="1"
          max="120"
          class="block h-10 w-full rounded-md border bg-background px-3"
        ></label>
        <label class="text-sm">Tanggal rencana bayar setiap bulan (1–28)<input
          v-model="form.dueDay"
          name="dueDay"
          type="number"
          required
          min="1"
          max="28"
          class="block h-10 w-full rounded-md border bg-background px-3"
        ></label>
      </template>
      <template v-else>
        <label class="text-sm">Tanggal biaya benar-benar terjadi<input
          v-model="form.incurredOn"
          name="incurredOn"
          type="date"
          required
          :max="today"
          class="block h-10 w-full rounded-md border bg-background px-3"
        ></label>
        <label class="text-sm">Perkiraan jatuh tempo {{ form.scheduleId ? '(kosong = jadwal)' : '' }}<input v-model="form.dueDate" name="dueDate" type="date" :required="!form.scheduleId" class="block h-10 w-full rounded-md border bg-background px-3"></label>
        <label class="text-sm">Dasar nominal<select v-model="form.basis" name="basis" required class="block h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Pilih dasar</option><option value="estimate">Estimasi andal dengan evidence</option><option value="actual">Nilai aktual</option></select></label>
      </template>
      <label class="flex gap-2 text-sm sm:col-span-2"><input v-model="form.confirmed" name="confirmed" type="checkbox" required><span>{{ mode === 'schedule' ? 'Rencana ini sesuai kontrak; belum menyatakan layanan terjadi atau uang dibayar.' : 'Biaya ini sudah terjadi. Saya telah memeriksa nominal dan referensi buktinya.' }}</span></label>
    </fieldset>
    <div v-if="error" role="alert" class="text-sm text-destructive">
      <p>{{ error }}</p><p v-for="(messages, field) in fieldErrors" :key="field">
        {{ field }}: {{ messages.join(' ') }}
      </p>
    </div>
    <div class="flex gap-2">
      <button type="submit" :disabled="pending || !form.confirmed" class="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
        {{ pending ? 'Menyimpan…' : mode === 'schedule' ? 'Simpan rencana' : 'Catat beban & accrual' }}
      </button><button type="button" :disabled="pending" class="h-10 rounded-md border px-4 text-sm" @click="emit('cancel')">
        Batal
      </button>
    </div>
  </form>
</template>
