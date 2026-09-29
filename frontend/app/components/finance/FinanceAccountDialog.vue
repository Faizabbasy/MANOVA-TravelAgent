<script setup lang="ts">
import type { BankAccountDto } from '~/types/api'

/** Add a bank account, or edit its name/holder/number. Code is permanent (it appears on every statement). */
const props = defineProps<{ open: boolean; account?: BankAccountDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [account: BankAccountDto] }>()

const api = useApi()
const { showToast } = useToast()
const isEdit = computed(() => !!props.account)

const form = reactive({ code: '', bankName: '', holderName: '', accountNumber: '' })

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  form.code = props.account?.code ?? ''
  form.bankName = props.account?.bankName ?? ''
  form.holderName = props.account?.holderName ?? 'PT MANOVA Wisata Indonesia'
  form.accountNumber = props.account?.accountNumber ?? ''
})

const action = useFinanceAction(async () => {
  if (props.account) {
    return (await api.finance.updateAccount(props.account.id, {
      bankName: form.bankName.trim(), holderName: form.holderName.trim(), accountNumber: form.accountNumber.trim()
    })).data
  }
  return (await api.finance.createAccount({
    code: form.code.trim().toUpperCase(), bankName: form.bankName.trim(), holderName: form.holderName.trim(), accountNumber: form.accountNumber.trim()
  })).data
})

async function submit () {
  const saved = await action.run()
  if (!saved) { return }
  showToast(isEdit.value ? 'Rekening diperbarui' : 'Rekening ditambahkan',
    isEdit.value ? `${saved.bankName} · ${saved.code} sudah disimpan.` : `${saved.code} siap. Langkah berikutnya: isi saldo awal agar bisa dipakai mencatat transaksi.`)
  emit('saved', saved)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isEdit ? `Ubah rekening ${account?.code}` : 'Tambah rekening bank'"
    :description="isEdit ? 'Kode rekening tidak bisa diubah karena tercatat di setiap transaksi.' : 'Rekening perusahaan tempat uang masuk dan keluar. Saldo awalnya diisi setelah rekening dibuat.'"
    :submit-label="isEdit ? 'Simpan perubahan' : 'Tambah rekening'"
    :pending="action.pending.value"
    :error="action.error.value"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField v-if="!isEdit" id="acc-code" label="Kode rekening" :error="action.fieldError('code')" hint="Singkat & unik, mis. BCA-OPS">
        <Input
          id="acc-code"
          v-model="form.code"
          class="h-10 uppercase"
          maxlength="20"
          required
          autocomplete="off"
        />
      </FinanceField>
      <FinanceField id="acc-bank" label="Nama bank" :error="action.fieldError('bankName')">
        <Input id="acc-bank" v-model="form.bankName" class="h-10" placeholder="BCA, Mandiri, BNI…" required />
      </FinanceField>
      <FinanceField id="acc-number" label="Nomor rekening" :error="action.fieldError('accountNumber')" :class="isEdit ? '' : 'sm:col-span-2'">
        <Input id="acc-number" v-model="form.accountNumber" class="h-10 tabular-nums" inputmode="numeric" required />
      </FinanceField>
      <FinanceField id="acc-holder" label="Atas nama" :error="action.fieldError('holderName')" class="sm:col-span-2">
        <Input id="acc-holder" v-model="form.holderName" class="h-10" required />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
