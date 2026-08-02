<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getProjectById, getPartyById, getTravelerGroups, getTravelers, getRoomAssignments } from '~/data'
import { formatDate, formatDateRange, maskDocumentNumber } from '~/utils/format'
import { isTravelerDocumentMissing } from '~/utils/attention'
import type { Traveler } from '~/types/project'

/**
 * "Manifest/rooming list export preview" (Section 11 baru) — mockup frontend-only: TIDAK menghasilkan
 * file PDF/Excel nyata, melainkan halaman print-friendly (tanpa layout dashboard) yang dapat di-print/
 * save-as-PDF lewat dialog print browser (`window.print()`), pola identik `quotation-preview.vue`
 * (Section 05, D-062) — dilarang integrasi/generator dokumen produksi (D-006).
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()
const { currentRole } = useCurrentUser()
/** "Sensitive values masked sesuai role" (Wajib) — berlaku juga di preview/print, bukan hanya tabel dashboard; pola sama `canManageTravelers` (`app/pages/projects/[id]/index.vue`). */
const canViewFullDocuments = computed(() => ['project-manager', 'super-admin'].includes(currentRole.value))

const project = computed(() => getProjectById(String(route.params.id)))
const party = computed(() => (project.value ? getPartyById(project.value.partyId) : undefined))
const groups = computed(() => (project.value ? getTravelerGroups(project.value.id) : []))
const travelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const roomAssignments = computed(() => (project.value ? getRoomAssignments(project.value.id) : []))

useHead({ title: computed(() => project.value ? `Manifest — ${project.value.name}` : 'Project Tidak Ditemukan') })

function travelerNameById (id: string) {
  return travelers.value.find(t => t.id === id)?.name ?? id
}

function groupNameById (groupId?: string) {
  if (!groupId) { return '—' }
  return groups.value.find(g => g.id === groupId)?.name ?? groupId
}

function documentSummary (traveler: Traveler) {
  const passport = traveler.passportNumber
    ? `${canViewFullDocuments.value ? traveler.passportNumber : maskDocumentNumber(traveler.passportNumber)}${traveler.passportExpiryDate ? ` (exp. ${formatDate(traveler.passportExpiryDate)})` : ''}`
    : 'Belum diisi'
  return passport
}

function documentMissing (traveler: Traveler) {
  return isTravelerDocumentMissing(traveler, project.value?.travelStartDate)
}

function printPage () {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-4xl px-4 print:px-0 print:max-w-none">
      <template v-if="!project">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState
            :icon="FileX"
            title="Project tidak ditemukan"
            :description="`Project dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
          >
            <NuxtLink to="/projects">
              <Button>Kembali ke Projects</Button>
            </NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('project')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="modul Projects" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/projects/${project.id}?tab=travelers`" class="text-sm text-primary hover:underline">
            ← Kembali ke Travelers
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
                Travel Agent B2B — Traveler Manifest (Mock)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                MANIFEST
              </p>
              <p class="text-sm text-muted-foreground">
                {{ project.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Client
              </p>
              <p class="text-sm font-medium text-foreground">
                {{ party?.name ?? '—' }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ project.destination }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Ringkasan
              </p>
              <p class="text-sm text-muted-foreground">
                {{ travelers.length }} traveler tercatat dari {{ project.travelerCount }} pax
              </p>
              <p v-if="!canViewFullDocuments" class="text-sm text-muted-foreground">
                Nomor dokumen ditampilkan tersamar untuk role ini.
              </p>
            </div>
          </div>

          <table class="w-full text-sm mb-6">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">
                  Nama
                </th>
                <th class="py-2">
                  Group
                </th>
                <th class="py-2">
                  Paspor
                </th>
                <th class="py-2">
                  Kontak Darurat
                </th>
                <th class="py-2">
                  Catatan
                </th>
                <th class="py-2">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="traveler in travelers" :key="traveler.id" class="border-b border-border/60">
                <td class="py-2 text-foreground">
                  {{ traveler.name }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ groupNameById(traveler.groupId) }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ documentSummary(traveler) }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ traveler.emergencyContactName || '—' }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ [traveler.dietaryRestrictions, traveler.accessibilityNeeds, traveler.specialRequest].filter(Boolean).join(' · ') || '—' }}
                </td>
                <td class="py-2" :class="documentMissing(traveler) ? 'text-destructive' : 'text-foreground'">
                  {{ documentMissing(traveler) ? 'Belum Lengkap' : 'Lengkap' }}
                </td>
              </tr>
              <tr v-if="travelers.length === 0">
                <td colspan="6" class="py-2 text-muted-foreground">
                  Belum ada traveler tercatat.
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="roomAssignments.length" class="mb-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Rooming List
            </p>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th class="py-2">
                    Kamar
                  </th>
                  <th class="py-2">
                    Traveler
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="room in roomAssignments" :key="room.id" class="border-b border-border/60">
                  <td class="py-2 text-foreground">
                    {{ room.roomLabel }}
                  </td>
                  <td class="py-2 text-muted-foreground">
                    {{ room.travelerIds.map(id => travelerNameById(id)).join(', ') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan dokumen manifest resmi maskapai/hotel.
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
