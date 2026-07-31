<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getUserById, getVendorById, getVendorContacts,
  getItineraryItems, getProjectServices, getTravelers,
} from '~/data'
import { formatDate, formatDateRange, formatDayLabel, maskDocumentNumber } from '~/utils/format'

/**
 * "Run sheet, contacts, emergency info" (Section 12 — roadmap Section 00–24 baru, Wajib) — mockup
 * frontend-only: halaman print-friendly (tanpa layout dashboard), `window.print()`, pola IDENTIK
 * `quotation-preview.vue` (D-062) dan `manifest-preview.vue` (D-068) — dilarang generator dokumen
 * produksi (D-006). Dokumen operasional untuk dibawa staf lapangan hari-H, berbeda dari manifest
 * (Section 11, fokus data traveler) — run sheet fokus pada jadwal + siapa yang bisa dihubungi.
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()
const { currentRole } = useCurrentUser()
/** "Sensitive values masked sesuai role" (Section 11, D-068) — berlaku juga di run sheet karena memuat kontak darurat traveler. */
const canViewFullContacts = computed(() => ['project-manager', 'super-admin'].includes(currentRole.value))

const project = computed(() => getProjectById(String(route.params.id)))
useHead({ title: computed(() => project.value ? `Run Sheet — ${project.value.name}` : 'Project Tidak Ditemukan') })

const itineraryByDate = computed(() => {
  if (!project.value) return []
  const map = new Map<string, ReturnType<typeof getItineraryItems>>()
  for (const item of getItineraryItems(project.value.id)) {
    if (!map.has(item.date)) map.set(item.date, [])
    map.get(item.date)!.push(item)
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

const team = computed(() => (project.value
  ? [getUserById(project.value.ownerId), ...project.value.teamUserIds.map(id => getUserById(id))].filter((user): user is NonNullable<typeof user> => Boolean(user))
  : []))

const vendorContacts = computed(() => {
  if (!project.value) return []
  const services = getProjectServices(project.value.id)
  const seen = new Set<string>()
  const rows: { vendorName: string; serviceLabel: string; contactName: string; contactPhone?: string }[] = []
  for (const service of services) {
    if (!service.vendorId || seen.has(service.vendorId)) continue
    const vendor = getVendorById(service.vendorId)
    if (!vendor) continue
    seen.add(service.vendorId)
    const contacts = getVendorContacts(service.vendorId)
    if (contacts.length > 0) {
      for (const contact of contacts) rows.push({ vendorName: vendor.name, serviceLabel: service.label, contactName: contact.name, contactPhone: contact.phone })
    } else {
      rows.push({ vendorName: vendor.name, serviceLabel: service.label, contactName: vendor.contactName, contactPhone: vendor.contactPhone })
    }
  }
  return rows
})

const emergencyContacts = computed(() => {
  if (!project.value) return []
  return getTravelers(project.value.id)
    .filter(traveler => traveler.emergencyContactName)
    .map(traveler => ({
      travelerName: traveler.name,
      contactName: traveler.emergencyContactName!,
      contactPhone: traveler.emergencyContactPhone,
      passportNumber: traveler.passportNumber ? (canViewFullContacts.value ? traveler.passportNumber : maskDocumentNumber(traveler.passportNumber)) : undefined,
    }))
})

function printPage() {
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
            <NuxtLink to="/projects"><Button>Kembali ke Projects</Button></NuxtLink>
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
          <NuxtLink :to="`/projects/${project.id}?tab=itinerary-services`" class="text-sm text-primary hover:underline">← Kembali ke Itinerary & Services</NuxtLink>
          <Button size="sm" @click="printPage">Print / Save as PDF</Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">MANOVA</p>
              <p class="text-xs text-muted-foreground">Travel Agent B2B — Operational Run Sheet (Mock)</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">RUN SHEET</p>
              <p class="text-sm text-muted-foreground">{{ project.name }}</p>
              <p class="text-xs text-muted-foreground">{{ formatDateRange(project.travelStartDate, project.travelEndDate) }} · {{ project.destination }}</p>
            </div>
          </div>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Jadwal Harian</p>
            <div v-if="itineraryByDate.length" class="space-y-3">
              <div v-for="day in itineraryByDate" :key="day.date">
                <p class="text-xs font-semibold text-foreground mb-1">{{ formatDayLabel(day.date) }}</p>
                <table class="w-full text-sm mb-2">
                  <tbody>
                    <tr v-for="item in day.items" :key="item.id" class="border-b border-border/60">
                      <td class="py-1.5 w-32 text-muted-foreground">{{ item.time ?? '—' }}<template v-if="item.timezone"> ({{ item.timezone }})</template></td>
                      <td class="py-1.5 text-foreground">{{ item.title }}<span v-if="item.visibleToClient === false" class="text-xs text-muted-foreground"> (Internal Only)</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p v-else class="text-sm text-muted-foreground">Belum ada itinerary tercatat.</p>
          </div>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Team Contacts</p>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th class="py-2">Nama</th>
                  <th class="py-2">Role</th>
                  <th class="py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in team" :key="member.id" class="border-b border-border/60">
                  <td class="py-2 text-foreground">{{ member.name }}</td>
                  <td class="py-2 text-muted-foreground">{{ member.role }}</td>
                  <td class="py-2 text-muted-foreground">{{ member.email }}</td>
                </tr>
                <tr v-if="team.length === 0"><td colspan="3" class="py-2 text-muted-foreground">Belum ada anggota tim ditugaskan.</td></tr>
              </tbody>
            </table>
          </div>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vendor Contacts</p>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th class="py-2">Vendor</th>
                  <th class="py-2">Layanan</th>
                  <th class="py-2">Contact</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in vendorContacts" :key="index" class="border-b border-border/60">
                  <td class="py-2 text-foreground">{{ row.vendorName }}</td>
                  <td class="py-2 text-muted-foreground">{{ row.serviceLabel }}</td>
                  <td class="py-2 text-muted-foreground">{{ row.contactName }}{{ row.contactPhone ? ` · ${row.contactPhone}` : '' }}</td>
                </tr>
                <tr v-if="vendorContacts.length === 0"><td colspan="3" class="py-2 text-muted-foreground">Belum ada vendor ditugaskan.</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Emergency Info Traveler</p>
            <p v-if="!canViewFullContacts" class="text-xs text-muted-foreground mb-2">Nomor dokumen ditampilkan tersamar untuk role ini.</p>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th class="py-2">Traveler</th>
                  <th class="py-2">Kontak Darurat</th>
                  <th class="py-2">Paspor</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in emergencyContacts" :key="index" class="border-b border-border/60">
                  <td class="py-2 text-foreground">{{ row.travelerName }}</td>
                  <td class="py-2 text-muted-foreground">{{ row.contactName }}{{ row.contactPhone ? ` · ${row.contactPhone}` : '' }}</td>
                  <td class="py-2 text-muted-foreground">{{ row.passportNumber ?? '—' }}</td>
                </tr>
                <tr v-if="emergencyContacts.length === 0"><td colspan="3" class="py-2 text-muted-foreground">Belum ada kontak darurat tercatat.</td></tr>
              </tbody>
            </table>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan run sheet operasional resmi.
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
