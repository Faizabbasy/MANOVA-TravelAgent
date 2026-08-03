<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getProjectById, getPartyById, getClientVisibleItineraryItems, getLatestItineraryVersion } from '~/data'
import { formatDate, formatDayLabel } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Itinerary — Print/PDF Preview client-safe (Repair Phase Section 4, Wajib "Download mock PDF"). Halaman
 * BARU, TIDAK menggunakan route internal manapun (pola sama `/client/quotations/[id]/preview`, Section 3 —
 * halaman print internal `/projects/[id]/run-sheet-preview` juga gated `canView('project')`, `NONE` untuk
 * client). Mockup frontend-only — `window.print()`, bukan generator PDF nyata (D-006).
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView, clientScopeId } = usePermissions()

const project = computed(() => getProjectById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
const party = computed(() => (project.value ? getPartyById(project.value.partyId) : undefined))
const version = computed(() => (project.value ? getLatestItineraryVersion(project.value.id) : undefined))
const items = computed(() => version.value?.items ?? (project.value ? getClientVisibleItineraryItems(project.value.id) : []))

useHead({ title: computed(() => project.value ? `Itinerary ${project.value.name} — Preview` : 'Itinerary Tidak Ditemukan') })

function printPage () {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-3xl px-4 print:px-0 print:max-w-none">
      <template v-if="!project || !isOwnCompany">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState :icon="FileX" title="Itinerary tidak ditemukan" description="Project ini tidak ada atau bukan milik company Anda.">
            <NuxtLink to="/client/itineraries">
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
          <NuxtLink :to="`/client/itineraries/${project.id}`" class="text-sm text-primary hover:underline">
            ← Kembali ke Itinerary
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
                Travel Agent B2B — Itinerary Document (Mock)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                ITINERARY
              </p>
              <p class="text-sm text-muted-foreground">
                {{ project.name }}<template v-if="version">
                  · Versi {{ version.versionNumber }}
                </template>
              </p>
              <p class="text-xs text-muted-foreground">
                {{ party?.name }}
              </p>
            </div>
          </div>

          <ul v-if="items.length" class="space-y-4">
            <li v-for="item in items" :key="item.id">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {{ formatDayLabel(item.date) }}<template v-if="item.time">
                  · {{ item.time }}
                </template>
              </p>
              <p class="text-sm font-medium text-foreground">
                {{ item.title }}
              </p>
              <p v-if="item.description" class="text-sm text-muted-foreground">
                {{ item.description }}
              </p>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">
            Itinerary belum tersedia.
          </p>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan dokumen komersial/legal yang sah. Dicetak {{ formatDate(DEMO_REFERENCE_DATE) }}
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
