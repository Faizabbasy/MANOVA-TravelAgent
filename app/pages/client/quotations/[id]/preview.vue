<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getQuotationById, getOpportunityById, getPartyById, getUserById } from '~/data'
import { SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'

/**
 * Quotations & Proposals — Print/PDF Preview client-safe (Repair Phase Section 3, Wajib "Download mock
 * PDF"). Halaman TERPISAH dari `/crm/opportunities/[id]/quotation-preview` (internal, gated `canView('crm')`
 * — role `client` selalu `NONE` untuk modul `crm`, sehingga rute internal tsb TIDAK reachable dari Client
 * meski pernah dirujuk sebagai `Document.previewRoute` contoh Section 21). Mockup frontend-only —
 * `window.print()`, bukan generator PDF nyata (D-006), pola identik halaman internal TAPI sengaja TIDAK
 * PERNAH merender `markupIdr`/`estimatedCostIdr`/`estimatedMarginIdr` (internal cost/margin, Master Prompt
 * bagian D) — hanya `discountIdr`/`taxIdr` yang sudah presenden aman di `/client/opportunities/[id]`.
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView, clientScopeId } = usePermissions()

const quotation = computed(() => getQuotationById(String(route.params.id)))
const opportunity = computed(() => (quotation.value ? getOpportunityById(quotation.value.opportunityId) : undefined))
const isOwnCompany = computed(() => Boolean(opportunity.value && clientScopeId.value && opportunity.value.partyId === clientScopeId.value))
const party = computed(() => (opportunity.value ? getPartyById(opportunity.value.partyId) : undefined))
const preparedBy = computed(() => (opportunity.value ? getUserById(opportunity.value.ownerId) : undefined))

useHead({ title: computed(() => quotation.value ? `Quotation ${quotation.value.id} — Preview` : 'Quotation Tidak Ditemukan') })

function printPage () {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-3xl px-4 print:px-0 print:max-w-none">
      <template v-if="!quotation || !opportunity || !isOwnCompany">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState :icon="FileX" title="Quotation tidak ditemukan" description="Quotation ini tidak ada atau bukan milik company Anda.">
            <NuxtLink to="/client/quotations">
              <Button>Kembali</Button>
            </NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('client-portal')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="Client Portal" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/client/quotations/${quotation.id}`" class="text-sm text-primary hover:underline">
            ← Kembali ke Quotation
          </NuxtLink>
          <Button size="sm" @click="printPage">
            Print / Save as PDF
          </Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">
                MANOVA
              </p>
              <p class="text-xs text-muted-foreground">
                Travel Agent B2B — Quotation Document (Mock)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                QUOTATION
              </p>
              <p class="text-sm text-muted-foreground">
                {{ quotation.id }} · Versi {{ quotation.version }}
              </p>
              <p class="text-xs text-muted-foreground">
                Dibuat {{ formatDate(quotation.createdAt) }}
              </p>
              <p v-if="quotation.validUntil" class="text-xs text-muted-foreground">
                Berlaku sampai {{ formatDate(quotation.validUntil) }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Bill To
              </p>
              <p class="text-sm font-medium text-foreground">
                {{ party?.name ?? '—' }}
              </p>
              <p v-if="opportunity.contactName" class="text-sm text-foreground">
                Attn: {{ opportunity.contactName }}
              </p>
              <p v-if="party?.city" class="text-sm text-muted-foreground">
                {{ party.city }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Trip Detail
              </p>
              <p class="text-sm text-foreground">
                {{ opportunity.title }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ opportunity.destination }}
              </p>
              <p v-if="opportunity.travelStartDate && opportunity.travelEndDate" class="text-sm text-muted-foreground">
                {{ formatDateRange(opportunity.travelStartDate, opportunity.travelEndDate) }}
              </p>
              <p v-if="opportunity.travelerEstimate" class="text-sm text-muted-foreground">
                {{ opportunity.travelerEstimate }} pax
              </p>
              <p v-if="preparedBy" class="text-sm text-muted-foreground">
                Disiapkan oleh {{ preparedBy.name }}
              </p>
            </div>
          </div>

          <table class="w-full text-sm mb-6">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">
                  Service
                </th>
                <th class="py-2">
                  Deskripsi
                </th>
                <th class="py-2 text-right">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in quotation.serviceBreakdown" :key="index" class="border-b border-border/60">
                <td class="py-2">
                  {{ findStatusOption(SERVICE_TYPES, item.service).label }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ item.description || '—' }}
                </td>
                <td class="py-2 text-right">
                  {{ formatCurrencyIdr(item.amountIdr) }}
                </td>
              </tr>
              <tr v-if="!quotation.serviceBreakdown || quotation.serviceBreakdown.length === 0">
                <td colspan="3" class="py-2 text-muted-foreground">
                  Belum ada service breakdown — nilai quotation ditampilkan sebagai total.
                </td>
              </tr>
            </tbody>
          </table>

          <div class="flex justify-end mb-6">
            <div class="w-64 space-y-1.5 text-sm">
              <div v-if="quotation.discountIdr" class="flex justify-between text-muted-foreground">
                <span>Discount</span><span>-{{ formatCurrencyIdr(quotation.discountIdr) }}</span>
              </div>
              <div v-if="quotation.taxIdr" class="flex justify-between text-muted-foreground">
                <span>Tax / Fee</span><span>{{ formatCurrencyIdr(quotation.taxIdr) }}</span>
              </div>
              <div class="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
                <span>Total ({{ quotation.currency || 'IDR' }})</span><span>{{ formatCurrencyIdr(quotation.amountIdr) }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-6 mb-6 text-sm">
            <div v-if="quotation.inclusions">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Inclusions
              </p>
              <p class="text-foreground whitespace-pre-line">
                {{ quotation.inclusions }}
              </p>
            </div>
            <div v-if="quotation.exclusions">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Exclusions
              </p>
              <p class="text-foreground whitespace-pre-line">
                {{ quotation.exclusions }}
              </p>
            </div>
            <div v-if="quotation.paymentTerms">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Payment Terms
              </p>
              <p class="text-foreground whitespace-pre-line">
                {{ quotation.paymentTerms }}
              </p>
            </div>
          </div>

          <div v-if="quotation.cancellationPolicy" class="mb-6 text-sm">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Cancellation Policy
            </p>
            <p class="text-foreground whitespace-pre-line">
              {{ quotation.cancellationPolicy }}
            </p>
          </div>

          <div v-if="quotation.termsAndConditions" class="border-t border-border pt-4 text-xs text-muted-foreground">
            <p class="font-semibold uppercase tracking-wide mb-1">
              Terms &amp; Conditions
            </p>
            <p class="whitespace-pre-line">
              {{ quotation.termsAndConditions }}
            </p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan dokumen komersial/legal yang sah.
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
