<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'
import type { BankAccountDto } from '~/types/api'
import { todayJakarta } from '~/lib/finance/dates'

/**
 * Maker step: Finance proposes the opening balance from the bank statement. It only counts after a Super Admin
 * verifies it (maker/checker); until then the account shows "Belum tersedia", never Rp0.
 */
const props = defineProps<{ open: boolean; account: BankAccountDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const today = todayJakarta()
const form = reactive({ amount: '', date: today, note: '' })

watch(() => props.open, (open) => {
  if (!open || !props.account) { return }
  action.reset()
  const o = props.account.opening
  form.amount = o.status === 'pending' ? (o.balanceMinor ?? '') : ''
  form.date = o.date ?? today
  form.note = o.note ?? ''
})

const action = useFinanceAction(() => api.finance.submitOpening(props.account!.id, {
  amountMinor: form.amount || '0', openingDate: form.date, note: form.note.trim() || undefined
}))

async function submit () {
  if (!props.account) { return }
  const done = await action.run()
  if (!done) { return }
  showToast('Saldo awal diajukan', `${props.account.code} menunggu verifikasi Super Admin sebelum bisa dipakai.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="account?.opening.status === 'pending' ? `Ubah pengajuan saldo awal ${account?.code}` : `Isi saldo awal ${account?.code ?? ''}`"
    description="Salin saldo dari rekening koran pada tanggal mulai pencatatan. Semua transaksi sebelum tanggal ini dianggap sudah termasuk di saldo awal."
    submit-label="Ajukan untuk diverifikasi"
    :pending="action.pending.value"
    :error="action.error.value"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <FinanceField id="opening-amount" label="Saldo di rekening koran" :error="action.fieldError('amountMinor')">
      <FinanceMoneyInput id="opening-amount" v-model="form.amount" :invalid="!!action.fieldError('amountMinor')" />
    </FinanceField>
    <FinanceField id="opening-date" label="Per tanggal" :error="action.fieldError('openingDate')" hint="Tidak boleh di masa depan.">
      <FinanceDateInput id="opening-date" v-model="form.date" :max="today" :invalid="!!action.fieldError('openingDate')" />
    </FinanceField>
    <FinanceField id="opening-note" label="Catatan untuk pemeriksa" optional>
      <FinanceTextarea id="opening-note" v-model="form.note" :rows="2" placeholder="mis. Rekening koran Agustus, halaman 3" maxlength="500" />
    </FinanceField>
    <template #summary>
      <p class="flex gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Super Admin (orang lain, bukan Anda) akan mencocokkan angka ini dengan rekening koran. Sebelum disetujui,
        saldo rekening tampil "Belum tersedia" dan transaksi baru belum bisa dicatat.
      </p>
    </template>
  </FinanceFormDialog>
</template>
