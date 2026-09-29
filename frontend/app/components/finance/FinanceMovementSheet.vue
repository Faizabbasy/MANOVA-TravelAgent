<script setup lang="ts">
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Undo2 } from 'lucide-vue-next'
import type { MovementDto, TransferDto } from '~/types/api'
import { CATEGORY_LABEL, KIND_LABEL, movementTitle } from '~/lib/finance/labels'
import { formatBusinessDateLong, formatInstant } from '~/lib/finance/dates'

/**
 * Detail of one cash movement: where the money went, what it belongs to, who recorded it, and whether it was
 * cancelled. Transfers show both legs and the fee as one action.
 */
const props = defineProps<{ movementId: string | null }>()
const emit = defineEmits<{ 'update:movementId': [value: string | null] }>()

const api = useApi()
const session = useServerSession()
const open = computed({ get: () => !!props.movementId, set: (v: boolean) => { if (!v) { emit('update:movementId', null) } } })

const detail = useFinanceQuery(async () => {
  const movement = (await api.finance.getTransaction(props.movementId!)).data
  const transfer: TransferDto | null = movement.transferId ? (await api.finance.getTransfer(movement.transferId)).data : null
  return { movement, transfer }
}, { watch: [() => props.movementId], enabled: () => !!props.movementId })

const m = computed<MovementDto | null>(() => (detail.data.value?.movement.id === props.movementId ? detail.data.value.movement : null))
const transfer = computed(() => (m.value ? detail.data.value?.transfer ?? null : null))
const showReverse = ref(false)

const canReverse = computed(() => {
  const x = m.value
  if (!x || !session.can('finance.post-cash')) { return false }
  if (x.reversalOfId || x.reversedById) { return false }
  if (transfer.value?.reversed) { return false }
  return true
})

const rows = computed(() => {
  const x = m.value
  if (!x) { return [] }
  const list: { label: string; value: string; to?: string }[] = [
    { label: 'Tanggal uang', value: formatBusinessDateLong(x.effectiveDate) },
    { label: 'Rekening', value: `${x.account.bankName} · ${x.account.code}`, to: `/finance/accounts/${x.account.id}` },
    { label: 'Jenis', value: x.category ? `${KIND_LABEL[x.kind]} — ${CATEGORY_LABEL[x.category]}` : KIND_LABEL[x.kind] }
  ]
  if (x.party) { list.push({ label: 'Customer', value: x.party.name ?? x.party.id }) }
  if (x.vendor) { list.push({ label: 'Vendor', value: x.vendor.name ?? x.vendor.id }) }
  if (x.counterparty && !x.party && !x.vendor) { list.push({ label: 'Pihak', value: x.counterparty }) }
  if (x.project) { list.push({ label: 'Project', value: x.project.name ?? x.project.id, to: `/project-orders/${x.project.id}` }) }
  if (x.booking) { list.push({ label: 'Booking', value: `${x.booking.type} · ${x.booking.id}` }) }
  if (x.reference) { list.push({ label: 'No. referensi bank', value: x.reference }) }
  if (x.memo) { list.push({ label: 'Keterangan', value: x.memo }) }
  list.push({ label: 'Dicatat', value: `${x.createdBy.name} · ${formatInstant(x.postedAt)}` })
  list.push({ label: 'ID transaksi', value: x.id })
  return list
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
      <SheetHeader class="border-b border-border px-6 pb-5 pt-6 text-left">
        <SheetTitle class="sr-only">
          Detail transaksi
        </SheetTitle>
        <SheetDescription class="sr-only">
          Rincian mutasi rekening
        </SheetDescription>
        <div v-if="!m" class="space-y-3" role="status" aria-label="Memuat">
          <div class="h-4 w-32 animate-pulse rounded bg-muted" />
          <div class="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <template v-else>
          <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span
              class="grid h-7 w-7 place-items-center rounded-full"
              :class="m.isInternalTransfer ? 'bg-muted text-muted-foreground' : m.direction === 'in' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'"
            >
              <ArrowLeftRight v-if="m.isInternalTransfer" class="h-3.5 w-3.5" />
              <ArrowDownLeft v-else-if="m.direction === 'in'" class="h-3.5 w-3.5" />
              <ArrowUpRight v-else class="h-3.5 w-3.5" />
            </span>
            {{ m.direction === 'in' ? 'Uang masuk' : 'Uang keluar' }}
          </div>
          <p class="mt-3 text-base font-semibold leading-snug">
            {{ movementTitle(m) }}
          </p>
          <FinanceAmount
            :value="m.amountMinor"
            :currency="m.currency"
            :direction="m.direction"
            :muted="!!m.reversedById"
            :subdued="!!m.reversalOfId"
            class="mt-1 block text-3xl font-semibold tracking-tight"
          />
          <div v-if="m.reversedById" class="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Undo2 class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Sudah dibatalkan — tidak dihitung di saldo maupun total.
              <button type="button" class="font-medium text-primary hover:underline" @click="emit('update:movementId', m.reversedById)">Lihat pembatalannya</button>
            </span>
          </div>
          <div v-else-if="m.reversalOfId" class="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Undo2 class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Transaksi balik untuk membatalkan
              <button type="button" class="font-medium text-primary hover:underline" @click="emit('update:movementId', m.reversalOfId)">transaksi asli</button>.
              <template v-if="m.reversalReason"> Alasan: “{{ m.reversalReason }}”</template>
            </span>
          </div>
        </template>
      </SheetHeader>

      <FinanceErrorState v-if="detail.error.value && !m" :error="detail.error.value" compact @retry="detail.refresh" />

      <div v-if="m" class="flex-1 space-y-6 px-6 py-5">
        <div v-if="transfer" class="rounded-xl border border-border p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Satu transfer, {{ transfer.legs.length }} catatan
          </p>
          <ul class="mt-3 space-y-2 text-sm">
            <li v-for="leg in transfer.legs" :key="leg.id" class="flex items-center justify-between gap-3">
              <button type="button" class="min-w-0 truncate text-left hover:text-primary" :class="leg.id === m.id && 'font-semibold'" @click="emit('update:movementId', leg.id)">
                {{ KIND_LABEL[leg.kind] }} · {{ leg.account.code }}
              </button>
              <FinanceAmount :value="leg.amountMinor" :direction="leg.direction" :muted="!!leg.reversedById" class="text-sm" />
            </li>
          </ul>
        </div>

        <dl class="divide-y divide-border text-sm">
          <div v-for="row in rows" :key="row.label" class="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5">
            <dt class="text-muted-foreground">
              {{ row.label }}
            </dt>
            <dd class="min-w-0 break-words font-medium">
              <NuxtLink v-if="row.to" :to="row.to" class="text-primary hover:underline">
                {{ row.value }}
              </NuxtLink>
              <template v-else>
                {{ row.value }}
              </template>
            </dd>
          </div>
        </dl>
      </div>

      <div v-if="canReverse" class="border-t border-border px-6 py-4">
        <Button variant="outline" class="w-full text-destructive hover:bg-destructive/5 hover:text-destructive" @click="showReverse = true">
          <Undo2 class="mr-2 h-4 w-4" />
          {{ m?.transferId ? 'Batalkan transfer' : 'Batalkan transaksi' }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>

  <FinanceReverseDialog v-model:open="showReverse" :movement="m" />
</template>
