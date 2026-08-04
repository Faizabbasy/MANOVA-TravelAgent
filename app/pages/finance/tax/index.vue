<script setup lang="ts">
import { computed, ref } from 'vue'
import { Percent, Coins, Calculator } from 'lucide-vue-next'
import { TAX_RULES, MASTER_CURRENCIES, ORGANIZATION_PROFILE } from '~/data'
import { formatCurrencyIdr, formatPercentage } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Tax & Multi Currency — Finance & ACC' })

const { canView } = usePermissions()
const hasAccess = computed(() => canView('finance-acc'))

/**
 * Tax & Invoice dan Multi Currency (dua fitur modul Finance & ACC pada daftar klien). Keduanya membaca
 * master data yang SUDAH ADA (`TAX_RULES`, `MASTER_CURRENCIES`) — halaman ini memberi mereka tempat yang
 * masuk akal di modul Finance, tanpa menduplikasi data ke tempat baru. Pengelolaan (tambah/ubah) tetap di
 * Administration &gt; Master Data agar hanya ada satu jalur tulis.
 */
const activeTaxRules = computed(() => TAX_RULES.filter(rule => rule.isActive))
const activeCurrencies = computed(() => MASTER_CURRENCIES.filter(currency => currency.isActive))

/* Kalkulator pajak — membantu memverifikasi angka invoice tanpa keluar dari halaman. */
const baseAmount = ref<number | null>(50_000_000)
const selectedTaxId = ref<string>('')

const selectedTax = computed(() => TAX_RULES.find(rule => rule.id === selectedTaxId.value) ?? activeTaxRules.value[0])

const calculation = computed(() => {
  const base = Number(baseAmount.value) || 0
  const rate = selectedTax.value?.ratePercent ?? 0
  const taxIdr = Math.round((base * rate) / 100)
  return { base, rate, taxIdr, total: base + taxIdr }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Tax & Multi Currency"
      description="Aturan pajak yang berlaku pada invoice dan daftar mata uang yang didukung."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Tax & Currency' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Finance & ACC" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Aturan Pajak Aktif" :value="`${activeTaxRules.length}/${TAX_RULES.length}`" :icon="Percent" icon-color="primary" />
        <StatsCard title="Mata Uang Aktif" :value="`${activeCurrencies.length}/${MASTER_CURRENCIES.length}`" :icon="Coins" icon-color="warning" />
        <StatsCard title="NPWP Perusahaan" :value="ORGANIZATION_PROFILE.npwp || '—'" :icon="Calculator" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <SectionCard title="Aturan Pajak" description="Dikelola di Administration > Master Data.">
          <Table v-if="TAX_RULES.length">
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Berlaku Untuk</TableHead>
                <TableHead class="text-right">
                  Tarif
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="rule in TAX_RULES" :key="rule.id">
                <TableCell class="text-sm font-medium text-foreground">
                  {{ rule.name }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ rule.appliesTo }}
                </TableCell>
                <TableCell class="text-right text-sm font-semibold text-foreground">
                  {{ formatPercentage(rule.ratePercent, 1) }}
                </TableCell>
                <TableCell>
                  <StatusBadge :label="rule.isActive ? 'Aktif' : 'Nonaktif'" :tone="rule.isActive ? 'success' : 'neutral'" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <EmptyState v-else title="Belum ada aturan pajak" />
        </SectionCard>

        <SectionCard title="Kalkulator Pajak" description="Memverifikasi angka invoice tanpa berpindah halaman.">
          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>Dasar Pengenaan (IDR)</Label>
              <Input v-model.number="baseAmount" type="number" placeholder="0" />
            </div>
            <div class="space-y-1.5">
              <Label>Aturan Pajak</Label>
              <select v-model="selectedTaxId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="rule in TAX_RULES" :key="rule.id" :value="rule.id">
                  {{ rule.name }} ({{ formatPercentage(rule.ratePercent, 1) }})
                </option>
              </select>
            </div>

            <Separator />

            <div class="space-y-2">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-sm text-muted-foreground">Dasar Pengenaan</span>
                <span class="text-sm text-foreground">{{ formatCurrencyIdr(calculation.base) }}</span>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-sm text-muted-foreground">Pajak ({{ formatPercentage(calculation.rate, 1) }})</span>
                <span class="text-sm text-foreground">{{ formatCurrencyIdr(calculation.taxIdr) }}</span>
              </div>
              <div class="flex items-baseline justify-between gap-3 pt-2 border-t border-border">
                <span class="text-sm font-medium text-foreground">Total Tagihan</span>
                <span class="text-base font-bold text-primary">{{ formatCurrencyIdr(calculation.total) }}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Multi Currency"
        description="Mata uang yang dapat dipilih pada invoice. Nilai tukar disimpan sebagai snapshot pada invoice masing-masing agar riwayat tidak berubah saat kurs bergerak."
      >
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <div
            v-for="currency in MASTER_CURRENCIES"
            :key="currency.id"
            class="rounded-lg border border-border px-3 py-2.5"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold text-foreground">{{ currency.code }}</span>
              <StatusBadge :label="currency.isActive ? 'Aktif' : 'Nonaktif'" :tone="currency.isActive ? 'success' : 'neutral'" />
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ currency.symbol }} · {{ currency.name }}
            </p>
          </div>
        </div>
        <EmptyState v-if="!MASTER_CURRENCIES.length" title="Belum ada mata uang terdaftar" />
      </SectionCard>
    </template>
  </div>
</template>
