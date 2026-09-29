<script setup lang="ts">
import { ChevronRight, Clock3, MoreHorizontal, ShieldCheck } from 'lucide-vue-next'
import type { BankAccountDto } from '~/types/api'
import { formatBusinessDate } from '~/lib/finance/dates'
import { getUserById } from '~/data'

/**
 * One bank account: the balance first, then the one thing to do next (fill / verify the opening balance).
 * Buttons follow the server's capabilities; the API enforces them regardless.
 */
const props = defineProps<{ account: BankAccountDto }>()
const emit = defineEmits<{ opening: []; verify: []; edit: []; toggleActive: [] }>()

const session = useServerSession()
const canManage = computed(() => session.can('finance.manage-bank-accounts'))
const canApprove = computed(() => session.can('finance.approve-opening-balance'))
const isMaker = computed(() => props.account.opening.submittedBy === session.me.value?.user.id)
const opening = computed(() => props.account.opening)
const initials = computed(() => props.account.bankName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'BNK')
const nameOf = (id: string | null) => (id ? (getUserById(id)?.name ?? id) : '—')
</script>

<template>
  <article
    class="group relative flex flex-col rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    :class="!account.isActive && 'opacity-75'"
  >
    <div class="flex items-start gap-3 p-5 pb-4">
      <div class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold tracking-wide text-primary">
        {{ initials }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="truncate text-[15px] font-semibold">
            {{ account.bankName }}
          </h3>
          <StatusBadge v-if="!account.isActive" label="Nonaktif" tone="neutral" />
        </div>
        <p class="truncate text-xs text-muted-foreground">
          {{ account.code }} · <span class="tabular-nums">{{ account.accountNumber }}</span>
        </p>
      </div>
      <Popover v-if="canManage">
        <PopoverTrigger as-child>
          <Button variant="ghost" size="icon" class="-mr-2 -mt-1 h-8 w-8 shrink-0" :aria-label="`Menu rekening ${account.code}`">
            <MoreHorizontal class="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-48 p-1">
          <button type="button" class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted" @click="emit('edit')">
            Ubah data rekening
          </button>
          <button type="button" class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted" @click="emit('toggleActive')">
            {{ account.isActive ? 'Nonaktifkan' : 'Aktifkan kembali' }}
          </button>
        </PopoverContent>
      </Popover>
    </div>

    <div class="px-5">
      <p class="text-xs text-muted-foreground">
        Saldo saat ini
      </p>
      <FinanceAmount
        :value="account.balance.currentMinor"
        :currency="account.currency"
        class="mt-0.5 block text-2xl font-semibold tracking-tight"
        :class="account.balance.currentMinor === null && '!text-lg !font-medium'"
      />
      <p class="mt-0.5 text-xs text-muted-foreground">
        per {{ formatBusinessDate(account.balance.asOf) }}
      </p>
    </div>

    <!-- The next step, if any -->
    <div class="mb-4 mt-4 px-5">
      <div v-if="opening.status === 'unset'" class="rounded-lg border border-dashed border-border bg-muted/30 p-3">
        <p class="text-sm font-medium">
          Saldo awal belum diisi
        </p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Rekening bisa dipakai setelah saldo awal diisi dan diverifikasi.
        </p>
        <Button v-if="canManage" size="sm" class="mt-3" @click="emit('opening')">
          Isi saldo awal
        </Button>
      </div>

      <div v-else-if="opening.status === 'pending'" class="rounded-lg border border-warning/30 bg-warning/5 p-3">
        <p class="flex items-center gap-1.5 text-sm font-medium">
          <Clock3 class="h-4 w-4 text-warning" /> Menunggu verifikasi
        </p>
        <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Saldo awal <FinanceAmount :value="opening.balanceMinor" :currency="account.currency" class="font-medium text-foreground" />
          per {{ formatBusinessDate(opening.date) }}, diajukan {{ nameOf(opening.submittedBy) }}.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <Button v-if="canApprove && !isMaker" size="sm" @click="emit('verify')">
            <ShieldCheck class="mr-1.5 h-4 w-4" /> Verifikasi
          </Button>
          <Button v-if="canManage" size="sm" variant="outline" @click="emit('opening')">
            Ubah pengajuan
          </Button>
          <p v-if="canApprove && isMaker" class="text-xs text-muted-foreground">
            Anda yang mengajukan — verifikasi harus oleh orang lain.
          </p>
        </div>
      </div>

      <div v-else class="flex gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
        <ShieldCheck class="mt-px h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
        <p class="leading-relaxed text-muted-foreground">
          Saldo awal <FinanceAmount :value="opening.balanceMinor" :currency="account.currency" class="font-medium text-foreground" />
          per {{ formatBusinessDate(opening.date) }}, diverifikasi {{ nameOf(opening.verifiedBy) }}
        </p>
      </div>
    </div>

    <NuxtLink
      :to="`/finance/accounts/${account.id}`"
      class="mt-auto flex items-center justify-between border-t border-border px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-muted/40"
    >
      Lihat mutasi & saldo berjalan
      <ChevronRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </NuxtLink>
  </article>
</template>
