<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getOpportunityById, getUserById,
  getClientVisibleItineraryItems, getTravelers, createTraveler, updateTraveler,
  getDocumentsByProject, getInvoicesByProject, getPaymentsByInvoice,
  createChangeRequest, getChangeRequestsByProject, getIncidentsByProject,
} from '~/data'
import {
  PROJECT_STATUSES, SERVICE_TYPES, CHANGE_CATEGORIES, INVOICE_STATUSES, INVOICE_TYPES,
  CHANGE_REQUEST_STATUSES, INCIDENT_STATUSES,
  findStatusOption,
} from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange, formatDayLabel } from '~/utils/format'
import { isTravelerDocumentMissing, isInvoiceOverdue, invoiceAgingDays } from '~/utils/attention'
import type { Traveler } from '~/types/project'
import type { ChangeCategory } from '~/types/activity'

/**
 * Client-facing Project Order detail (Section 08). Sanitized — TIDAK PERNAH merender
 * `budgetIdr`/`actualCostIdr` (Project) atau data vendor/cost internal apa pun. Tab "Finance" hanya
 * menampilkan Invoice/Payment (sell-side, apa yang benar-benar ditagih ke client), bukan budget/margin.
 * Isolasi: project harus milik `clientScopeId` (company) user login.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const project = computed(() => getProjectById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => project.value ? project.value.name : 'Tidak Ditemukan') })

const party = computed(() => (project.value ? getPartyById(project.value.partyId) : undefined))
const accountExecutive = computed(() => {
  const opportunity = project.value?.opportunityId ? getOpportunityById(project.value.opportunityId) : undefined
  return opportunity ? getUserById(opportunity.ownerId) : undefined
})
const projectManager = computed(() => (project.value ? getUserById(project.value.ownerId) : undefined))

const activeTab = computed({
  get: () => (route.query.tab as string) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } }),
})
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'travelers', label: 'Travelers' },
  { value: 'documents', label: 'Documents' },
  { value: 'finance', label: 'Finance' },
  { value: 'changes', label: 'Changes & Incidents' },
]

const serviceScopeOptions = computed(() => SERVICE_TYPES.filter(type => project.value?.serviceScope.includes(type.value)))
/** "Internal vs client-shared itinerary" (Section 12 baru) — hanya item `visibleToClient !== false` yang boleh tampil di Client Portal. */
const itineraryItems = computed(() => (project.value ? getClientVisibleItineraryItems(project.value.id) : []))
const travelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const documents = computed(() => (project.value ? getDocumentsByProject(project.value.id) : []))
const invoices = computed(() => (project.value ? getInvoicesByProject(project.value.id) : []))
/**
 * Change Request + Incident sanitized view (Section 19, D-076) — hanya status + before/after summary untuk
 * Change Request (TIDAK PERNAH `operationalImpact`/`commercialImpactIdr`/`financialImpactNote`, internal-only
 * bahkan untuk request milik Client sendiri), dan hanya status + resolution note untuk Incident (TIDAK PERNAH
 * `severity`/`escalatedTo`/`communicationLog`, internal-only mutlak) — pola sanitasi sama Sections 13-16
 * (client hanya melihat `sellPriceIdr`, tidak pernah `netCostIdr`).
 */
const projectChangeRequests = computed(() => (project.value ? getChangeRequestsByProject(project.value.id) : []))
const projectIncidents = computed(() => (project.value ? getIncidentsByProject(project.value.id) : []))

/**
 * Travelers — Wajib "Traveler/participant submission" (Section 08) + "Client self-submission" (Section 11
 * baru, roadmap Section 00–24), reuse mutator `createTraveler`/`updateTraveler` apa adanya. Field
 * `companionOfTravelerId`/`documentsVerifiedAt` (internal verification) SENGAJA tidak ada di form ini —
 * verifikasi adalah tindakan staf internal (lihat `app/pages/projects/[id]/index.vue`), bukan sesuatu yang
 * disubmit Client sendiri.
 */
const isTravelerDialogOpen = ref(false)
const editingTraveler = ref<Traveler | null>(null)
const travelerName = ref('')
const travelerPassportNumber = ref('')
const travelerPassportExpiry = ref('')
const travelerIdNumber = ref('')
const travelerVisaNumber = ref('')
const travelerVisaExpiry = ref('')
const travelerEmergencyName = ref('')
const travelerEmergencyPhone = ref('')
const travelerDietary = ref('')
const travelerAccessibility = ref('')
const travelerSpecialRequest = ref('')

function openTravelerDialog(traveler: Traveler | null) {
  editingTraveler.value = traveler
  travelerName.value = traveler?.name ?? ''
  travelerPassportNumber.value = traveler?.passportNumber ?? ''
  travelerPassportExpiry.value = traveler?.passportExpiryDate ?? ''
  travelerIdNumber.value = traveler?.idNumber ?? ''
  travelerVisaNumber.value = traveler?.visaNumber ?? ''
  travelerVisaExpiry.value = traveler?.visaExpiryDate ?? ''
  travelerEmergencyName.value = traveler?.emergencyContactName ?? ''
  travelerEmergencyPhone.value = traveler?.emergencyContactPhone ?? ''
  travelerDietary.value = traveler?.dietaryRestrictions ?? ''
  travelerAccessibility.value = traveler?.accessibilityNeeds ?? ''
  travelerSpecialRequest.value = traveler?.specialRequest ?? ''
  isTravelerDialogOpen.value = true
}

function submitTraveler() {
  if (!project.value || !travelerName.value.trim()) return
  const patch = {
    name: travelerName.value.trim(),
    passportNumber: travelerPassportNumber.value.trim() || undefined,
    passportExpiryDate: travelerPassportExpiry.value || undefined,
    idNumber: travelerIdNumber.value.trim() || undefined,
    visaNumber: travelerVisaNumber.value.trim() || undefined,
    visaExpiryDate: travelerVisaExpiry.value || undefined,
    emergencyContactName: travelerEmergencyName.value.trim() || undefined,
    emergencyContactPhone: travelerEmergencyPhone.value.trim() || undefined,
    dietaryRestrictions: travelerDietary.value.trim() || undefined,
    accessibilityNeeds: travelerAccessibility.value.trim() || undefined,
    specialRequest: travelerSpecialRequest.value.trim() || undefined,
  }
  if (editingTraveler.value) {
    updateTraveler(editingTraveler.value.id, patch)
    showToast('Traveler Diperbarui', `Data ${patch.name} berhasil disimpan.`, 'success')
  } else {
    createTraveler({ projectId: project.value.id, ...patch })
    showToast('Traveler Ditambahkan', `${patch.name} berhasil ditambahkan.`, 'success')
  }
  isTravelerDialogOpen.value = false
}

/**
 * Change Request (Section 19, D-076) — reuse `createChangeRequest` (yang otomatis memanggil `createChangeEntry`
 * Section 14 lama agar audit trail internal tetap satu sumber kebenaran), kategori dibatasi ke yang relevan
 * bagi client (bukan `vendor`/`budget`, internal-only).
 */
const CLIENT_CHANGE_CATEGORIES: ChangeCategory[] = ['traveler', 'itinerary', 'service', 'other']
const isChangeDialogOpen = ref(false)
const changeCategory = ref<ChangeCategory>('other')
const changeReason = ref('')

function submitChangeRequest() {
  if (!project.value || !changeReason.value.trim()) return
  const request = createChangeRequest({
    projectId: project.value.id,
    source: 'client',
    requestedBy: currentUser.value.id,
    affectedEntities: [{ entityType: 'project', entityId: project.value.id }],
    beforeSummary: 'Kondisi saat ini',
    afterSummary: changeReason.value.trim(),
    category: changeCategory.value,
  })
  changeReason.value = ''
  changeCategory.value = 'other'
  isChangeDialogOpen.value = false
  showToast('Permintaan Perubahan Terkirim', `${request.id} — tim kami akan meninjau permintaan Anda.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Project Order tidak ditemukan" description="Project Order ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client')">Kembali ke Client Portal</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader :title="project.name" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: project.name }]">
        <template #actions>
          <StatusBadge :label="findStatusOption(PROJECT_STATUSES, project.status).label" :tone="findStatusOption(PROJECT_STATUSES, project.status).tone" />
        </template>
      </PageHeader>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">{{ tab.label }}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionCard>
            <DetailMetadataList :items="[
              { label: 'Company', value: party?.name ?? '—' },
              { label: 'Destinasi', value: project.destination },
              { label: 'Tanggal', value: formatDateRange(project.travelStartDate, project.travelEndDate) },
              { label: 'Jumlah Traveler', value: `${project.travelerCount} pax` },
              { label: 'Total Paket', value: formatCurrencyIdr(project.quotationAmountIdr) },
            ]" />
            <div v-if="serviceScopeOptions.length" class="mt-4 pt-4 border-t border-border">
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Layanan</p>
              <div class="flex flex-wrap gap-2">
                <StatusBadge v-for="type in serviceScopeOptions" :key="type.value" :label="type.label" :tone="type.tone" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Support — Tim Kami">
            <DetailMetadataList :items="[
              { label: 'Account Executive', value: accountExecutive?.name ?? 'Belum ditugaskan' },
              { label: 'Project Manager', value: projectManager?.name ?? 'Belum ditugaskan' },
            ]" />
            <div class="mt-3 flex flex-wrap gap-3">
              <a v-if="accountExecutive" :href="`mailto:${accountExecutive.email}`" class="text-sm text-primary hover:underline">{{ accountExecutive.email }} (AE)</a>
              <a v-if="projectManager" :href="`mailto:${projectManager.email}`" class="text-sm text-primary hover:underline">{{ projectManager.email }} (PM)</a>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="itinerary">
          <SectionCard title="Shared Itinerary">
            <ul v-if="itineraryItems.length" class="divide-y divide-border">
              <li v-for="item in itineraryItems" :key="item.id" class="py-3">
                <p class="text-xs text-muted-foreground">{{ formatDayLabel(item.date) }}<template v-if="item.time"> · {{ item.time }}</template></p>
                <p class="text-sm font-medium text-foreground">{{ item.title }}</p>
                <p v-if="item.description" class="text-xs text-muted-foreground">{{ item.description }}</p>
              </li>
            </ul>
            <EmptyState v-else title="Itinerary belum tersedia" description="Itinerary akan tampil di sini setelah tim kami menyusunnya." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="travelers">
          <SectionCard title="Traveler / Participant">
            <template #actions>
              <Button size="sm" variant="outline" @click="openTravelerDialog(null)"><Plus class="h-4 w-4 mr-1.5" />Tambah Traveler</Button>
            </template>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Paspor</TableHead>
                  <TableHead>Visa</TableHead>
                  <TableHead>Kontak Darurat</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Status Dokumen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="traveler in travelers" :key="traveler.id">
                  <TableCell class="font-medium text-foreground">{{ traveler.name }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ traveler.passportNumber || '—' }}<template v-if="traveler.passportExpiryDate"> (exp. {{ formatDate(traveler.passportExpiryDate) }})</template></TableCell>
                  <TableCell class="text-muted-foreground">{{ traveler.visaNumber || '—' }}<template v-if="traveler.visaExpiryDate"> (exp. {{ formatDate(traveler.visaExpiryDate) }})</template></TableCell>
                  <TableCell class="text-muted-foreground">{{ traveler.emergencyContactName || '—' }}</TableCell>
                  <TableCell class="text-muted-foreground text-xs">{{ [traveler.dietaryRestrictions, traveler.accessibilityNeeds, traveler.specialRequest].filter(Boolean).join(' · ') || '—' }}</TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="isTravelerDocumentMissing(traveler, project.travelStartDate) ? 'Dokumen Belum Lengkap' : 'Dokumen Lengkap'"
                      :tone="isTravelerDocumentMissing(traveler, project.travelStartDate) ? 'warning' : 'success'"
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" @click="openTravelerDialog(traveler)">Edit</Button>
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="travelers.length === 0" :colspan="7">Belum ada traveler tercatat. Tambahkan data traveler Anda.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>

          <Dialog v-model:open="isTravelerDialogOpen">
            <DialogScrollContent class="max-w-lg">
              <DialogHeader>
                <DialogTitle>{{ editingTraveler ? 'Edit Traveler' : 'Tambah Traveler' }}</DialogTitle>
                <DialogDescription>Lengkapi data traveler untuk keperluan dokumen perjalanan.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5"><Label for="trv-name">Nama Lengkap</Label><Input id="trv-name" v-model="travelerName" /></div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5"><Label for="trv-passport">Nomor Paspor</Label><Input id="trv-passport" v-model="travelerPassportNumber" /></div>
                  <div class="space-y-1.5"><Label for="trv-passport-exp">Masa Berlaku Paspor</Label><Input id="trv-passport-exp" v-model="travelerPassportExpiry" type="date" /></div>
                  <div class="space-y-1.5"><Label for="trv-id-number">Nomor ID/KTP (opsional)</Label><Input id="trv-id-number" v-model="travelerIdNumber" /></div>
                  <div class="space-y-1.5"><Label for="trv-visa">Nomor Visa (opsional)</Label><Input id="trv-visa" v-model="travelerVisaNumber" /></div>
                  <div class="space-y-1.5"><Label for="trv-visa-exp">Masa Berlaku Visa (opsional)</Label><Input id="trv-visa-exp" v-model="travelerVisaExpiry" type="date" /></div>
                </div>
                <div class="space-y-1.5"><Label for="trv-emergency-name">Nama Kontak Darurat</Label><Input id="trv-emergency-name" v-model="travelerEmergencyName" /></div>
                <div class="space-y-1.5"><Label for="trv-emergency-phone">Telepon Kontak Darurat</Label><Input id="trv-emergency-phone" v-model="travelerEmergencyPhone" /></div>
                <div class="space-y-1.5"><Label for="trv-dietary">Dietary Restriction (opsional)</Label><Input id="trv-dietary" v-model="travelerDietary" placeholder="mis. Vegetarian, tanpa seafood" /></div>
                <div class="space-y-1.5"><Label for="trv-accessibility">Accessibility Needs (opsional)</Label><Input id="trv-accessibility" v-model="travelerAccessibility" placeholder="mis. Kursi roda" /></div>
                <div class="space-y-1.5"><Label for="trv-special">Permintaan Khusus Lainnya</Label><Input id="trv-special" v-model="travelerSpecialRequest" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isTravelerDialogOpen = false">Batal</Button>
                <Button :disabled="!travelerName.trim()" @click="submitTraveler">Simpan</Button>
              </DialogFooter>
            </DialogScrollContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Shared Documents">
            <ul v-if="documents.length" class="divide-y divide-border">
              <li v-for="document in documents" :key="document.id" class="py-3 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground truncate">{{ document.name }}</span>
                <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(document.uploadedAt) }}</span>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada dokumen dibagikan" description="Dokumen seperti tiket, voucher hotel, atau itinerary PDF akan tampil di sini setelah dibagikan tim kami." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="finance">
          <SectionCard title="Invoice" description="Menampilkan status DP/termin dan currency invoice — nilai selalu dalam Rupiah (currency asing hanya penanda referensi, sudah dikonversi).">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="invoice in invoices" :key="invoice.id">
                  <TableCell class="font-medium text-foreground">{{ invoice.label }}</TableCell>
                  <TableCell>
                    <div class="flex flex-col gap-1">
                      <StatusBadge :label="findStatusOption(INVOICE_TYPES, invoice.invoiceType).label" :tone="findStatusOption(INVOICE_TYPES, invoice.invoiceType).tone" />
                      <span v-if="invoice.currency !== 'IDR'" class="text-xs text-muted-foreground">{{ invoice.currency }}</span>
                    </div>
                  </TableCell>
                  <TableCell>{{ formatCurrencyIdr(invoice.amountIdr) }}</TableCell>
                  <TableCell :class="isInvoiceOverdue(invoice) ? 'text-destructive' : 'text-muted-foreground'">
                    {{ formatDate(invoice.dueAt) }}<template v-if="isInvoiceOverdue(invoice)"> ({{ invoiceAgingDays(invoice) * -1 }} hari overdue)</template>
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(INVOICE_STATUSES, invoice.status).label" :tone="findStatusOption(INVOICE_STATUSES, invoice.status).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="invoices.length === 0" :colspan="5">Belum ada invoice untuk Project Order ini.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard v-for="invoice in invoices.filter(inv => getPaymentsByInvoice(inv.id).length > 0)" :key="invoice.id" :title="`Riwayat Pembayaran — ${invoice.label}`">
            <ul class="divide-y divide-border">
              <li v-for="payment in getPaymentsByInvoice(invoice.id)" :key="payment.id" class="py-2 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground">{{ formatCurrencyIdr(payment.amountIdr) }}</span>
                <span class="text-xs text-muted-foreground">{{ formatDate(payment.receivedAt) }}</span>
              </li>
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="changes">
          <SectionCard title="Change Request">
            <template #actions>
              <Dialog v-model:open="isChangeDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline"><Plus class="h-4 w-4 mr-1.5" />Ajukan Perubahan</Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Ajukan Permintaan Perubahan</DialogTitle>
                    <DialogDescription>Sampaikan perubahan yang Anda butuhkan untuk Project Order ini.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="change-category">Kategori</Label>
                      <select id="change-category" v-model="changeCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option v-for="cat in CHANGE_CATEGORIES.filter(c => CLIENT_CHANGE_CATEGORIES.includes(c.value))" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="change-reason">Detail Permintaan</Label>
                      <textarea id="change-reason" v-model="changeReason" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Jumlah peserta bertambah menjadi 25 orang" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isChangeDialogOpen = false">Batal</Button>
                    <Button :disabled="!changeReason.trim()" @click="submitChangeRequest">Kirim</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>
            <ul v-if="projectChangeRequests.length" class="divide-y divide-border">
              <li v-for="item in projectChangeRequests" :key="item.id" class="py-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-medium text-foreground">{{ item.afterSummary }}</p>
                  <StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, item.status).tone" />
                </div>
                <p class="text-sm text-muted-foreground">Sebelum: {{ item.beforeSummary }}</p>
                <p class="text-xs text-muted-foreground mt-1">{{ formatDate(item.submittedAt) }}</p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada permintaan perubahan" description="Ajukan perubahan bila ada detail Project Order yang perlu disesuaikan." />
          </SectionCard>

          <SectionCard title="Incidents" description="Status dan resolusi insiden yang berkaitan dengan Project Order Anda.">
            <ul v-if="projectIncidents.length" class="divide-y divide-border">
              <li v-for="item in projectIncidents" :key="item.id" class="py-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-medium text-foreground">{{ item.title }}</p>
                  <StatusBadge :label="findStatusOption(INCIDENT_STATUSES, item.status).label" :tone="findStatusOption(INCIDENT_STATUSES, item.status).tone" />
                </div>
                <p v-if="item.resolutionNote" class="text-sm text-muted-foreground mt-1">Resolusi: {{ item.resolutionNote }}</p>
                <p v-else class="text-sm text-muted-foreground mt-1">Sedang ditangani oleh tim kami.</p>
              </li>
            </ul>
            <EmptyState v-else title="Tidak ada Incident tercatat" description="Belum ada insiden operasional yang berkaitan dengan Project Order ini." />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
