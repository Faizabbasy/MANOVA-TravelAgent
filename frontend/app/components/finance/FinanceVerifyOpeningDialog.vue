<script setup lang="ts">
import type { BankAccountDto } from '~/types/api'
import { formatBusinessDateLong, formatInstant } from '~/lib/finance/dates'
import { getUserById } from '~/data'

/**
 * Checker step (Super Admin). Sends back exactly the figure shown here; if the maker changed it meanwhile the
 * server refuses (409) instead of approving a number the checker never saw.
 */
const props = defineProps<{ open: boolean; account: BankAccountDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const confirmed = ref(false)

/** The figure frozen when the dialog opened — what the checker reviews is what gets sent. */
const reviewed = ref<{ balanceMinor: string; openingDate: string } | null>(null)

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  confirmed.value = false
  const o = props.account?.opening
  reviewed.value = o?.balanceMinor && o.date ? { balanceMinor: o.balanceMinor, openingDate: o.date } : null
})

const action = useFinanceAction(() => api.finance.verifyOpening(props.account!.id, reviewed.value!))

const maker = computed(() => {
  const id = props.account?.opening.submittedBy
  return id ? (getUserById(id)?.name ?? id) : '—'
})

async function submit () {
  if (!props.account || !reviewed.value) { return }
  const done = await action.run()
  if (!done) { return }
  showToast('Saldo awal disetujui', `${props.account.code} kini bisa dipakai mencatat transaksi.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="`Verifikasi saldo awal ${account?.code ?? ''}`"
    description="Cocokkan angka di bawah dengan rekening koran. Setelah disetujui, saldo awal terkunci dan tidak bisa diubah."
    submit-label="Setujui saldo awal"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!confirmed || !reviewed"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div v-if="account && reviewed" class="rounded-xl border border-border bg-muted/30 p-4">
      <p class="text-xs text-muted-foreground">
        {{ account.bankName }} · {{ account.accountNumber }} · a.n. {{ account.holderName }}
      </p>
      <FinanceAmount :value="reviewed.balanceMinor" :currency="account.currency" class="mt-2 block text-2xl font-semibold tracking-tight" />
      <p class="mt-1 text-sm text-muted-foreground">
        per {{ formatBusinessDateLong(reviewed.openingDate) }}
      </p>
      <dl class="mt-4 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
        <div>
          <dt class="text-muted-foreground">
            Diajukan oleh
          </dt>
          <dd class="font-medium">
            {{ maker }}
          </dd>
        </div>
        <div v-if="account.opening.submittedAt">
          <dt class="text-muted-foreground">
            Waktu pengajuan
          </dt>
          <dd class="font-medium">
            {{ formatInstant(account.opening.submittedAt) }}
          </dd>
        </div>
        <div v-if="account.opening.note" class="sm:col-span-2">
          <dt class="text-muted-foreground">
            Catatan
          </dt>
          <dd>{{ account.opening.note }}</dd>
        </div>
      </dl>
    </div>

    <label class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm hover:bg-muted/40">
      <Checkbox v-model="confirmed" class="mt-0.5" />
      <span>Saya sudah mencocokkan saldo dan tanggal ini dengan rekening koran.</span>
    </label>
  </FinanceFormDialog>
</template>
