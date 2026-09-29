<script setup lang="ts">
import { ArrowLeftRight, Landmark, Plus } from 'lucide-vue-next'
import type { BankAccountDto } from '~/types/api'
import { formatBusinessDate } from '~/lib/finance/dates'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Rekening & Saldo — Finance' })

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const accounts = useFinanceQuery(async () => (await api.finance.listAccounts()).data)
const cash = useFinanceQuery(async () => (await api.finance.cashPosition()).data)

const active = computed(() => (accounts.data.value ?? []).filter(a => a.isActive))
const inactive = computed(() => (accounts.data.value ?? []).filter(a => !a.isActive))
const pendingCount = computed(() => active.value.filter(a => a.opening.status !== 'verified').length)

const dialog = reactive({ account: false, opening: false, verify: false, transfer: false })
const selected = ref<BankAccountDto | null>(null)

function open (kind: keyof typeof dialog, account: BankAccountDto | null = null) {
  selected.value = account
  dialog[kind] = true
}

const toggle = useFinanceAction((account: BankAccountDto) => api.finance.updateAccount(account.id, { isActive: !account.isActive }))
async function toggleActive (account: BankAccountDto) {
  const done = await toggle.run(account)
  if (done) {
    showToast(account.isActive ? 'Rekening dinonaktifkan' : 'Rekening aktif kembali',
      account.isActive ? `${account.code} tidak bisa dipakai untuk transaksi baru. Riwayatnya tetap ada.` : `${account.code} bisa dipakai lagi.`)
  } else if (toggle.error.value) {
    showToast('Gagal mengubah status rekening', toggle.error.value.message, 'error')
  }
}
</script>

<template>
  <FinancePage title="Rekening & Saldo" description="Semua rekening perusahaan, saldonya hari ini, dan jalannya uang di tiap rekening.">
    <template #actions>
      <Button v-if="session.can('finance.post-cash') && active.length > 1" variant="outline" @click="open('transfer')">
        <ArrowLeftRight class="mr-2 h-4 w-4" /> Transfer
      </Button>
      <Button v-if="session.can('finance.manage-bank-accounts')" @click="open('account')">
        <Plus class="mr-2 h-4 w-4" /> Tambah rekening
      </Button>
    </template>

    <FinanceErrorState v-if="accounts.error.value && !accounts.data.value" :error="accounts.error.value" @retry="accounts.refresh" />

    <template v-else-if="!accounts.loaded.value">
      <div class="h-28 animate-pulse rounded-xl bg-muted" />
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    </template>

    <Card v-else-if="!accounts.data.value?.length">
      <EmptyState :icon="Landmark" title="Belum ada rekening" description="Tambahkan rekening bank perusahaan, lalu isi saldo awalnya dari rekening koran. Setelah diverifikasi Super Admin, uang masuk dan keluar bisa dicatat.">
        <Button v-if="session.can('finance.manage-bank-accounts')" @click="open('account')">
          <Plus class="mr-2 h-4 w-4" /> Tambah rekening pertama
        </Button>
      </EmptyState>
    </Card>

    <template v-else>
      <!-- Total -->
      <section class="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm text-muted-foreground">
            {{ cash.data.value?.available ? 'Total saldo semua rekening' : 'Total saldo rekening terverifikasi' }}
          </p>
          <FinanceAmount :value="cash.data.value?.totalMinor ?? null" class="mt-1 block text-3xl font-semibold tracking-tight" />
          <p class="mt-1 text-xs text-muted-foreground">
            per {{ formatBusinessDate(cash.data.value?.asOf ?? null) }} · {{ active.length }} rekening aktif
          </p>
        </div>
        <p v-if="pendingCount" class="max-w-sm rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed sm:text-right">
          <span class="font-semibold text-warning">{{ pendingCount }} rekening belum terverifikasi</span>
          <span class="text-foreground/80"> — saldonya belum ikut dijumlahkan sampai saldo awalnya disetujui.</span>
        </p>
      </section>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FinanceAccountCard
          v-for="account in active"
          :key="account.id"
          :account="account"
          @opening="open('opening', account)"
          @verify="open('verify', account)"
          @edit="open('account', account)"
          @toggle-active="toggleActive(account)"
        />
      </div>

      <section v-if="inactive.length" class="space-y-3">
        <h2 class="text-sm font-medium text-muted-foreground">
          Rekening nonaktif
        </h2>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FinanceAccountCard
            v-for="account in inactive"
            :key="account.id"
            :account="account"
            @edit="open('account', account)"
            @toggle-active="toggleActive(account)"
          />
        </div>
      </section>
    </template>

    <FinanceAccountDialog v-model:open="dialog.account" :account="selected" />
    <FinanceOpeningDialog v-model:open="dialog.opening" :account="selected" />
    <FinanceVerifyOpeningDialog v-model:open="dialog.verify" :account="selected" />
    <FinanceTransferDialog v-model:open="dialog.transfer" />
  </FinancePage>
</template>
