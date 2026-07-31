<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getMiceEventById, getMiceBoqTotals, getProjectById } from '~/data'
import { MICE_EVENT_STATUSES, MICE_APPROVAL_STATUSES, MICE_BOQ_CATEGORIES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr } from '~/utils/format'

/**
 * "Vendor packages dan BOQ" (Section 16 — roadmap Section 00–24 baru, Wajib) — mockup frontend-only:
 * halaman print-friendly (tanpa layout dashboard), `window.print()`, client-facing untuk "Client approval
 * states" (budget sign-off) — pola IDENTIK `quotation-preview.vue`/`eticket-preview.vue` (D-062/D-070).
 * SANITIZED — TIDAK PERNAH menampilkan `netCostIdr` per baris (internal, hard rule protokol "Jangan
 * menampilkan internal cost/margin kepada Client") — HANYA `sellPriceIdr` per baris dan total.
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()

const event = computed(() => getMiceEventById(String(route.params.id)))
const project = computed(() => (event.value ? getProjectById(event.value.projectId) : undefined))
const totals = computed(() => (event.value ? getMiceBoqTotals(event.value) : {}))

useHead({ title: computed(() => event.value ? `BOQ — ${event.value.id}` : 'MICE Event Tidak Ditemukan') })

function printPage() {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-3xl px-4 print:px-0 print:max-w-none">
      <template v-if="!event">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState
            :icon="FileX"
            title="MICE Event tidak ditemukan"
            :description="`MICE Event dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
          >
            <NuxtLink to="/mice"><Button>Kembali ke MICE</Button></NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('mice')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="modul MICE" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/mice/${event.id}`" class="text-sm text-primary hover:underline">← Kembali ke MICE Event</NuxtLink>
          <Button size="sm" @click="printPage">Print / Save as PDF</Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">MANOVA</p>
              <p class="text-xs text-muted-foreground">Travel Agent B2B — Bill of Quantities (Mock)</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">BOQ</p>
              <p class="text-sm text-muted-foreground">{{ event.id }}</p>
              <div class="flex gap-1.5 justify-end mt-1">
                <StatusBadge :label="findStatusOption(MICE_EVENT_STATUSES, event.status).label" :tone="findStatusOption(MICE_EVENT_STATUSES, event.status).tone" />
                <StatusBadge :label="findStatusOption(MICE_APPROVAL_STATUSES, event.clientApprovalStatus).label" :tone="findStatusOption(MICE_APPROVAL_STATUSES, event.clientApprovalStatus).tone" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Project</p>
              <p class="text-sm text-foreground">{{ project?.name ?? event.projectId }}</p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Venue</p>
              <p class="text-sm text-foreground">{{ event.venueName ?? '—' }}</p>
            </div>
          </div>

          <table class="w-full text-sm mb-6">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">Kategori</th>
                <th class="py-2">Deskripsi</th>
                <th class="py-2">Qty</th>
                <th class="py-2 text-right">Sell Price</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in event.boqItems" :key="index" class="border-b border-border/60">
                <td class="py-2 text-foreground">{{ findStatusOption(MICE_BOQ_CATEGORIES, item.category).label }}</td>
                <td class="py-2 text-muted-foreground">{{ item.description }}</td>
                <td class="py-2 text-muted-foreground">{{ item.quantity }} {{ item.unit }}</td>
                <td class="py-2 text-right text-foreground">{{ item.sellPriceIdr !== undefined ? formatCurrencyIdr(item.sellPriceIdr) : '—' }}</td>
              </tr>
              <tr v-if="event.boqItems.length === 0"><td colspan="4" class="py-2 text-muted-foreground">Belum ada baris BOQ tercatat.</td></tr>
            </tbody>
            <tfoot v-if="event.boqItems.length > 0">
              <tr class="border-t-2 border-border font-semibold">
                <td colspan="3" class="py-2 text-foreground">Total</td>
                <td class="py-2 text-right text-foreground">{{ totals.sellPriceIdr !== undefined ? formatCurrencyIdr(totals.sellPriceIdr) : '—' }}</td>
              </tr>
            </tfoot>
          </table>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan BOQ resmi event organizer. Harga ditampilkan adalah harga jual (sell price), tidak termasuk rincian biaya internal.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
@media print {
  @page { margin: 1.5cm; }
}
</style>
