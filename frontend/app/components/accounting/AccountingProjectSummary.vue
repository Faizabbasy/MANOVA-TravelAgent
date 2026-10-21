<script setup lang="ts">
import type { ProjectAccountingSummaryDto } from '~/types/api'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Hasil accounting satu project: penjualan vs pendapatan diakui, biaya diakui vs perkiraan biaya akhir, posisi yang masih
 * terbuka, dan tiga status yang tidak boleh tertukar (operasional, review accounting, pelunasan kas).
 */
const props = defineProps<{ summary: ProjectAccountingSummaryDto }>()
const money = (v: string | null | undefined) => (v === null || v === undefined ? '—' : formatMoneyMinor(v))
const OPERATIONAL: Record<string, string> = {
  draft: 'Draft',
  planning: 'Perencanaan',
  confirmed: 'Terkonfirmasi',
  'in-progress': 'Persiapan',
  'ongoing-trip': 'Sedang berjalan',
  completed: 'Selesai operasional',
  'on-hold': 'Ditahan',
  cancelled: 'Dibatalkan'
}
const f = () => props.summary.figures!
</script>

<template>
  <section class="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm" aria-label="Hasil accounting project">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-[15px] font-semibold">
          Hasil accounting project
        </h3>
        <p class="text-xs text-muted-foreground">
          Dari jurnal yang terbentuk otomatis. Bukan saldo bank; margin dari Finance di atas tetap dasar tagihan.
        </p>
      </div>
      <span v-if="summary.basis === 'rehearsal'" class="rounded-md bg-muted px-2 py-0.5 text-xs">Rehearsal · sementara</span>
    </div>
    <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3" aria-label="Status project">
      <div class="rounded-lg bg-muted/50 p-3">
        <dt class="text-xs text-muted-foreground">
          Operasional
        </dt>
        <dd class="font-medium">
          {{ OPERATIONAL[summary.status.operational] ?? summary.status.operational }}
        </dd>
      </div>
      <div class="rounded-lg bg-muted/50 p-3">
        <dt class="text-xs text-muted-foreground">
          Review accounting
        </dt>
        <dd class="font-medium">
          {{ !summary.accountingReview ? 'Belum tersedia' : summary.accountingReview.complete ? 'Lengkap' : 'Ada yang belum lengkap' }}
        </dd>
      </div>
      <div class="rounded-lg bg-muted/50 p-3">
        <dt class="text-xs text-muted-foreground">
          Pelunasan kas
        </dt>
        <dd class="font-medium">
          {{ summary.status.cashSettled ? 'Finance ditutup' : 'Masih ada tagihan/utang atau belum ditutup' }}
        </dd>
      </div>
    </dl>
    <p v-if="!summary.available || !summary.figures" class="rounded-lg bg-muted p-4 text-sm">
      Hasil accounting belum tersedia untuk project ini.
    </p>
    <template v-else>
      <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-xs text-muted-foreground">
            Nilai kontrak
          </dt><dd class="font-semibold tabular-nums">
            {{ money(summary.contractValueMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Pendapatan diakui
          </dt><dd class="font-semibold tabular-nums">
            {{ money(f().recognizedRevenueMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Biaya langsung diakui
          </dt><dd class="font-semibold tabular-nums">
            {{ money(f().recognizedDirectCostMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Kontribusi
          </dt><dd class="font-semibold tabular-nums">
            {{ money(f().contributionMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Budget layanan
          </dt><dd class="tabular-nums">
            {{ money(summary.budgetMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Sisa komitmen supplier
          </dt><dd class="tabular-nums">
            {{ money(summary.remainingCommitmentMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Perkiraan biaya akhir
          </dt><dd class="tabular-nums">
            {{ money(f().estimatedFinalCostMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Ditagih, jasa belum diberikan
          </dt><dd class="tabular-nums">
            {{ money(f().deferredRevenueMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Customer harus bayar
          </dt><dd class="tabular-nums">
            {{ money(f().receivableMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Supplier harus dibayar
          </dt><dd class="tabular-nums">
            {{ money(f().payableMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Biaya belum ditagih supplier
          </dt><dd class="tabular-nums">
            {{ money(f().accruedCostMinor) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Uang muka & dibayar di muka
          </dt><dd class="tabular-nums">
            {{ money((BigInt(f().supplierAdvanceMinor) + BigInt(f().prepaidCostMinor)).toString()) }}
          </dd>
        </div>
      </dl>
      <ul v-if="summary.reasons.length" class="space-y-1 text-xs text-muted-foreground" aria-label="Kelengkapan project">
        <li v-for="r in summary.reasons" :key="r.code">
          {{ r.message }}
        </li>
      </ul>
    </template>
  </section>
</template>
