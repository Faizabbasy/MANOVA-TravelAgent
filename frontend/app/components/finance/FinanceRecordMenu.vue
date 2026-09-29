<script setup lang="ts">
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, CirclePlus, Plus, ReceiptText } from 'lucide-vue-next'

/**
 * The one "record money" entry point: picks the right form for what actually happened, each explained in a
 * short plain sentence so a non-finance user does not need accounting terms to choose.
 */
withDefaults(defineProps<{ size?: 'default' | 'sm' }>(), { size: 'default' })

const session = useServerSession()
const open = ref(false)
const dialog = reactive({ receipt: false, vendorPayment: false, expense: false, income: false, transfer: false })

const options = [
  { key: 'receipt', icon: ArrowDownLeft, tone: 'bg-success/10 text-success', title: 'Pembayaran dari customer', hint: 'Customer membayar invoice atau menitip uang muka' },
  { key: 'income', icon: CirclePlus, tone: 'bg-success/10 text-success', title: 'Pemasukan lain', hint: 'Komisi, bunga bank, dan uang masuk lain' },
  { key: 'vendorPayment', icon: ArrowUpRight, tone: 'bg-destructive/10 text-destructive', title: 'Pembayaran ke vendor', hint: 'Melunasi invoice vendor yang sudah disetujui' },
  { key: 'expense', icon: ReceiptText, tone: 'bg-destructive/10 text-destructive', title: 'Pengeluaran operasional', hint: 'Sewa, gaji, iklan, software, dan biaya lain' },
  { key: 'transfer', icon: ArrowLeftRight, tone: 'bg-muted text-muted-foreground', title: 'Transfer antar rekening', hint: 'Memindahkan uang antar rekening perusahaan' }
] as const

function choose (key: keyof typeof dialog) {
  open.value = false
  dialog[key] = true
}
</script>

<template>
  <template v-if="session.can('finance.post-cash')">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button :size="size === 'sm' ? 'sm' : 'default'">
          <Plus class="mr-2 h-4 w-4" /> Catat transaksi <ChevronDown class="ml-1.5 h-4 w-4 opacity-80" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" class="w-[min(22rem,calc(100vw-2rem))] p-1.5">
        <p class="px-2.5 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">
          Apa yang terjadi?
        </p>
        <button
          v-for="o in options"
          :key="o.key"
          type="button"
          class="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          @click="choose(o.key)"
        >
          <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" :class="o.tone">
            <component :is="o.icon" class="h-4 w-4" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium">{{ o.title }}</span>
            <span class="block text-xs leading-snug text-muted-foreground">{{ o.hint }}</span>
          </span>
        </button>
      </PopoverContent>
    </Popover>

    <FinanceReceiptDialog v-model:open="dialog.receipt" />
    <FinanceVendorPaymentDialog v-model:open="dialog.vendorPayment" />
    <FinanceManualTransactionDialog v-model:open="dialog.expense" kind="expense" />
    <FinanceManualTransactionDialog v-model:open="dialog.income" kind="other_income" />
    <FinanceTransferDialog v-model:open="dialog.transfer" />
  </template>
</template>
