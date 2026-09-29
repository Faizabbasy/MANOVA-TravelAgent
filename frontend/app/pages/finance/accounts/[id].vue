<script setup lang="ts">
import { ArrowLeftRight, ChevronRight, Clock3, Inbox, Undo2 } from 'lucide-vue-next'
import type { PeriodPreset } from '~/lib/finance/types'
import { formatBusinessDate, formatBusinessDateLong, startOfMonth, todayJakarta } from '~/lib/finance/dates'
import { movementSubtitle, movementTitle } from '~/lib/finance/labels'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

/**
 * Bank-account ledger (not a general ledger): opening balance of the period, every movement with the running
 * balance after it, closing balance. Read it like a passbook, top to bottom.
 */
const route = useRoute()
const api = useApi()
const session = useServerSession()
const accountId = computed(() => String(route.params.id))

const today = todayJakarta()
const preset = ref<PeriodPreset>('this-month')
const from = ref(startOfMonth(today))
const to = ref(today)

const account = useFinanceQuery(async () => (await api.finance.getAccount(accountId.value)).data, { watch: [accountId] })
const ledger = useFinanceQuery(
  async () => (await api.finance.accountLedger(accountId.value, { from: from.value, to: to.value })).data,
  { watch: [accountId, from, to] }
)

useHead({ title: () => `${account.data.value?.code ?? 'Rekening'} — Finance` })

const view = computed(() => (ledger.data.value?.available ? ledger.data.value : null))
const items = computed(() => view.value?.items ?? [])
const clamped = computed(() => view.value && view.value.period.requestedFrom !== view.value.period.from)
const selectedMovement = ref<string | null>(null)
const showTransfer = ref(false)
const title = computed(() => account.data.value ? `${account.data.value.bankName} · ${account.data.value.code}` : 'Rekening')
</script>

<template>
  <FinancePage
    :title="title"
    :description="account.data.value ? `${account.data.value.accountNumber} · a.n. ${account.data.value.holderName}` : undefined"
    :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Rekening & Saldo', to: '/finance/accounts' }, { label: account.data.value?.code ?? '…' }]"
  >
    <template #actions>
      <Button v-if="session.can('finance.post-cash') && account.data.value?.isActive && account.data.value.opening.status === 'verified'" variant="outline" @click="showTransfer = true">
        <ArrowLeftRight class="mr-2 h-4 w-4" /> Transfer dari rekening ini
      </Button>
    </template>

    <FinanceErrorState v-if="account.error.value && !account.data.value" :error="account.error.value" @retry="account.refresh" />

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FinancePeriodPicker v-model:from="from" v-model:to="to" v-model:preset="preset" />
        <p v-if="account.data.value?.balance.currentMinor" class="text-sm text-muted-foreground">
          Saldo hari ini <FinanceAmount :value="account.data.value.balance.currentMinor" class="font-semibold text-foreground" />
        </p>
      </div>

      <!-- Opening unverified: explain, no fake Rp0 -->
      <Card v-if="ledger.data.value && !ledger.data.value.available">
        <EmptyState :icon="Clock3" title="Saldo awal belum diverifikasi" description="Mutasi dan saldo berjalan tampil setelah Super Admin menyetujui saldo awal rekening ini.">
          <Button variant="outline" size="sm" as-child>
            <NuxtLink to="/finance/accounts">
              Ke Rekening & Saldo
            </NuxtLink>
          </Button>
        </EmptyState>
      </Card>

      <FinanceErrorState v-else-if="ledger.error.value && !ledger.data.value" :error="ledger.error.value" @retry="ledger.refresh" />

      <div v-else-if="!view" class="space-y-4">
        <div class="h-24 animate-pulse rounded-xl bg-muted" />
        <div class="h-80 animate-pulse rounded-xl bg-muted" />
      </div>

      <template v-else>
        <!-- opening + in − out = closing -->
        <section class="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:grid-cols-4" :class="ledger.pending.value && 'opacity-70 transition-opacity'" aria-label="Ringkasan periode">
          <div class="border-b border-r border-border p-4 lg:border-b-0">
            <p class="text-xs text-muted-foreground">
              Saldo awal · {{ formatBusinessDate(view.period.from, { short: true }) }}
            </p>
            <FinanceAmount :value="view.openingMinor" class="mt-1 block text-lg font-semibold" />
          </div>
          <div class="border-b border-border p-4 lg:border-b-0 lg:border-r">
            <p class="text-xs text-muted-foreground">
              + Uang masuk
            </p>
            <FinanceAmount :value="view.inMinor" class="mt-1 block text-lg font-semibold text-success" />
          </div>
          <div class="border-r border-border p-4">
            <p class="text-xs text-muted-foreground">
              − Uang keluar
            </p>
            <FinanceAmount :value="view.outMinor" class="mt-1 block text-lg font-semibold" />
          </div>
          <div class="bg-primary/5 p-4">
            <p class="text-xs font-medium text-primary">
              = Saldo akhir · {{ formatBusinessDate(view.period.to, { short: true }) }}
            </p>
            <FinanceAmount :value="view.closingMinor" class="mt-1 block text-lg font-semibold" />
          </div>
        </section>
        <p v-if="clamped" class="-mt-3 text-xs text-muted-foreground">
          Pencatatan rekening ini dimulai {{ formatBusinessDateLong(view.openingDate) }}, jadi periode dihitung sejak tanggal itu.
        </p>

        <Card class="overflow-hidden">
          <EmptyState v-if="!items.length" :icon="Inbox" title="Tidak ada mutasi di periode ini" description="Saldo tidak berubah. Pilih periode lain untuk melihat riwayat." />

          <template v-else>
            <!-- Desktop -->
            <div class="hidden md:block">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <th class="w-28 px-5 py-3 font-medium">
                      Tanggal
                    </th>
                    <th class="px-3 py-3 font-medium">
                      Keterangan
                    </th>
                    <th class="px-3 py-3 text-right font-medium">
                      Masuk
                    </th>
                    <th class="px-3 py-3 text-right font-medium">
                      Keluar
                    </th>
                    <th class="px-5 py-3 text-right font-medium">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-border bg-muted/20 text-muted-foreground">
                    <td class="px-5 py-2.5 text-xs">
                      {{ formatBusinessDate(view.period.from, { short: true }) }}
                    </td>
                    <td class="px-3 py-2.5 text-xs font-medium" colspan="3">
                      Saldo awal periode
                    </td>
                    <td class="px-5 py-2.5 text-right">
                      <FinanceAmount :value="view.openingMinor" class="text-sm font-medium text-foreground" />
                    </td>
                  </tr>
                  <tr
                    v-for="item in items"
                    :key="item.id"
                    class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40 focus-within:bg-muted/40"
                    @click="selectedMovement = item.id"
                  >
                    <td class="px-5 py-3 align-top text-xs tabular-nums text-muted-foreground">
                      {{ formatBusinessDate(item.effectiveDate, { short: true }) }}
                    </td>
                    <td class="min-w-0 px-3 py-3">
                      <button type="button" class="block max-w-full text-left focus-visible:outline-none" @click.stop="selectedMovement = item.id">
                        <span class="flex items-center gap-1.5 font-medium" :class="(item.reversedById || item.reversalOfId) && 'text-muted-foreground'">
                          <Undo2 v-if="item.reversalOfId" class="h-3.5 w-3.5 shrink-0" aria-label="Pembatalan" />
                          <span class="truncate">{{ movementTitle(item) }}</span>
                          <StatusBadge v-if="item.reversedById" label="Dibatalkan" tone="neutral" class="ml-1" />
                        </span>
                        <span class="line-clamp-1 text-xs text-muted-foreground">{{ movementSubtitle(item) }}</span>
                      </button>
                    </td>
                    <td class="px-3 py-3 text-right align-top">
                      <FinanceAmount
                        v-if="item.direction === 'in'"
                        :value="item.amountMinor"
                        direction="in"
                        :muted="!!item.reversedById"
                        :subdued="!!item.reversalOfId"
                        class="font-medium"
                      />
                    </td>
                    <td class="px-3 py-3 text-right align-top">
                      <FinanceAmount
                        v-if="item.direction === 'out'"
                        :value="item.amountMinor"
                        direction="out"
                        :muted="!!item.reversedById"
                        :subdued="!!item.reversalOfId"
                        class="font-medium"
                      />
                    </td>
                    <td class="px-5 py-3 text-right align-top">
                      <FinanceAmount :value="item.balanceAfterMinor" class="text-muted-foreground" />
                    </td>
                  </tr>
                  <tr class="bg-primary/5">
                    <td class="px-5 py-3 text-xs text-muted-foreground">
                      {{ formatBusinessDate(view.period.to, { short: true }) }}
                    </td>
                    <td class="px-3 py-3 text-xs font-semibold" colspan="3">
                      Saldo akhir periode
                    </td>
                    <td class="px-5 py-3 text-right">
                      <FinanceAmount :value="view.closingMinor" class="font-semibold" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile -->
            <ul class="divide-y divide-border md:hidden">
              <li v-for="item in items" :key="item.id">
                <button type="button" class="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-muted/50" @click="selectedMovement = item.id">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium" :class="(item.reversedById || item.reversalOfId) && 'text-muted-foreground'">
                      {{ movementTitle(item) }}
                    </p>
                    <p class="truncate text-xs text-muted-foreground">
                      {{ formatBusinessDate(item.effectiveDate, { short: true }) }} · {{ movementSubtitle(item) }}
                    </p>
                  </div>
                  <div class="shrink-0 text-right">
                    <FinanceAmount :value="item.amountMinor" :direction="item.direction" :muted="!!item.reversedById" :subdued="!!item.reversalOfId" class="block text-sm font-semibold" />
                    <FinanceAmount :value="item.balanceAfterMinor" class="block text-[11px] text-muted-foreground" />
                  </div>
                  <ChevronRight class="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            </ul>
          </template>
        </Card>
      </template>

      <FinanceFeeRules v-if="account.data.value" :account-id="accountId" />
    </template>

    <FinanceMovementSheet v-model:movement-id="selectedMovement" />
    <FinanceTransferDialog v-model:open="showTransfer" :from-account-id="accountId" />
  </FinancePage>
</template>
