<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Plus, Building2, FileText, Pencil, Trash2 } from 'lucide-vue-next'
import {
  getPartyById, getContactsByParty, createContact, updateContact, deleteContact,
  getClientDocuments, createCompanyDocument, getCompanyProfileChangeHistory,
  updateCompanyProfile, submitSensitiveCompanyProfileChange, runCompanyProfileVerificationMock
} from '~/data'
import { COMPANY_TYPES, INVOICE_CURRENCIES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import type { ContactPerson, CompanyType } from '~/types/party'
import type { InvoiceCurrency } from '~/types/finance'

/**
 * Company Profile (Repair Phase Section 7 — Insights & Company, Master Prompt bagian 18). Field sensitif
 * (registrasi/NPWP/billing/payment term) TIDAK langsung ditulis — lewat `submitSensitiveCompanyProfileChange`
 * (status "Menunggu Verifikasi") → `runCompanyProfileVerificationMock` (lazy, dipicu `onMounted`, pola sama
 * `runPaymentVerificationMock` Section 6). "Tidak ada Users & Access" — TIDAK ADA halaman/section user
 * management di sini, murni data company.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Company Profile' })

const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const party = computed(() => (clientScopeId.value ? getPartyById(clientScopeId.value) : undefined))

onMounted(() => {
  if (clientScopeId.value) { runCompanyProfileVerificationMock(clientScopeId.value) }
})

const contacts = computed(() => (clientScopeId.value ? getContactsByParty(clientScopeId.value) : []))
const companyDocuments = computed(() => (clientScopeId.value ? getClientDocuments(clientScopeId.value).filter(doc => doc.entityType === 'party') : []))
const changeHistory = computed(() => (clientScopeId.value ? getCompanyProfileChangeHistory(clientScopeId.value).map(entry => ({ id: entry.id, message: entry.message, createdAt: entry.createdAt })) : []))

const SENSITIVE_FIELDS = ['registrationNumber', 'npwp', 'billingName', 'billingAddress', 'paymentTerm'] as const
type SensitiveField = typeof SENSITIVE_FIELDS[number]

const isEditing = ref(false)
const isDirty = ref(false)

const form = ref({
  name: '',
  industry: '',
  size: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  province: '',
  country: '',
  postalCode: '',
  companyType: undefined as CompanyType | undefined,
  preferredCurrency: undefined as InvoiceCurrency | undefined,
  poRequired: false,
  travelPreferences: '',
  logoFileName: '',
  registrationNumber: '',
  npwp: '',
  billingName: '',
  billingAddress: '',
  paymentTerm: ''
})

function loadForm () {
  if (!party.value) { return }
  form.value = {
    name: party.value.name ?? '',
    industry: party.value.industry ?? '',
    size: party.value.size ?? '',
    city: party.value.city ?? '',
    phone: party.value.phone ?? '',
    email: party.value.email ?? '',
    website: party.value.website ?? '',
    address: party.value.address ?? '',
    province: party.value.province ?? '',
    country: party.value.country ?? '',
    postalCode: party.value.postalCode ?? '',
    companyType: party.value.companyType,
    preferredCurrency: party.value.preferredCurrency,
    poRequired: party.value.poRequired ?? false,
    travelPreferences: party.value.travelPreferences ?? '',
    logoFileName: party.value.logoFileName ?? '',
    registrationNumber: party.value.registrationNumber ?? '',
    npwp: party.value.npwp ?? '',
    billingName: party.value.billingName ?? '',
    billingAddress: party.value.billingAddress ?? '',
    paymentTerm: party.value.paymentTerm ?? ''
  }
  isDirty.value = false
}

function startEdit () {
  loadForm()
  isEditing.value = true
}

function cancelEdit () {
  isEditing.value = false
  isDirty.value = false
}

function handleSave () {
  if (!party.value) { return }
  const sensitivePatch: Record<SensitiveField, string | undefined> = {
    registrationNumber: undefined, npwp: undefined, billingName: undefined, billingAddress: undefined, paymentTerm: undefined
  }
  let hasSensitiveChange = false
  for (const field of SENSITIVE_FIELDS) {
    const newValue = form.value[field].trim()
    if (newValue !== (party.value[field] ?? '')) { sensitivePatch[field] = newValue; hasSensitiveChange = true }
  }

  updateCompanyProfile(party.value.id, {
    name: form.value.name.trim() || undefined,
    industry: form.value.industry.trim() || undefined,
    size: form.value.size.trim() || undefined,
    city: form.value.city.trim() || undefined,
    phone: form.value.phone.trim() || undefined,
    email: form.value.email.trim() || undefined,
    website: form.value.website.trim() || undefined,
    address: form.value.address.trim() || undefined,
    province: form.value.province.trim() || undefined,
    country: form.value.country.trim() || undefined,
    postalCode: form.value.postalCode.trim() || undefined,
    companyType: form.value.companyType,
    preferredCurrency: form.value.preferredCurrency,
    poRequired: form.value.poRequired,
    travelPreferences: form.value.travelPreferences.trim() || undefined,
    logoFileName: form.value.logoFileName.trim() || undefined
  }, currentUser.value.id)

  if (hasSensitiveChange) {
    submitSensitiveCompanyProfileChange(party.value.id, sensitivePatch, currentUser.value.id)
    showToast('Perubahan Disimpan', 'Field umum tersimpan. Perubahan data sensitif menunggu verifikasi tim kami.', 'success')
  } else {
    showToast('Perubahan Disimpan', 'Company Profile berhasil diperbarui.', 'success')
  }
  isEditing.value = false
  isDirty.value = false
}

onBeforeRouteLeave(() => {
  if (!isDirty.value || !isEditing.value) { return true }
  return window.confirm('Perubahan belum disimpan. Tinggalkan halaman ini?')
})

/* --- Contacts CRUD --- */
const isContactDialogOpen = ref(false)
const editingContact = ref<ContactPerson | null>(null)
const contactName = ref('')
const contactTitle = ref('')
const contactEmail = ref('')
const contactPhone = ref('')

function openAddContact () {
  editingContact.value = null
  contactName.value = ''
  contactTitle.value = ''
  contactEmail.value = ''
  contactPhone.value = ''
  isContactDialogOpen.value = true
}
function openEditContact (contact: ContactPerson) {
  editingContact.value = contact
  contactName.value = contact.name
  contactTitle.value = contact.title
  contactEmail.value = contact.email ?? ''
  contactPhone.value = contact.phone ?? ''
  isContactDialogOpen.value = true
}
function submitContact () {
  if (!party.value || !contactName.value.trim() || !contactTitle.value.trim()) { return }
  const patch = { name: contactName.value.trim(), title: contactTitle.value.trim(), email: contactEmail.value.trim() || undefined, phone: contactPhone.value.trim() || undefined }
  if (editingContact.value) {
    updateContact(editingContact.value.id, patch)
    showToast('Kontak Diperbarui', 'Data kontak berhasil disimpan.', 'success')
  } else {
    createContact({ partyId: party.value.id, ...patch })
    showToast('Kontak Ditambahkan', 'Kontak baru berhasil disimpan.', 'success')
  }
  isContactDialogOpen.value = false
}
const isDeleteContactDialogOpen = ref(false)
const contactPendingDelete = ref<ContactPerson | null>(null)
function openDeleteContact (contact: ContactPerson) {
  contactPendingDelete.value = contact
  isDeleteContactDialogOpen.value = true
}
function confirmDeleteContact () {
  if (!contactPendingDelete.value) { return }
  deleteContact(contactPendingDelete.value.id)
  showToast('Kontak Dihapus', `${contactPendingDelete.value.name} telah dihapus.`, 'info')
  isDeleteContactDialogOpen.value = false
  contactPendingDelete.value = null
}

/* --- Logo mock (input teks — "unggah" berupa nama file, D-006) --- */
const isLogoDialogOpen = ref(false)
const logoFileNameInput = ref('')
function openLogoDialog () {
  logoFileNameInput.value = party.value?.logoFileName ?? ''
  isLogoDialogOpen.value = true
}
function submitLogo () {
  if (!party.value || !logoFileNameInput.value.trim()) { return }
  updateCompanyProfile(party.value.id, { logoFileName: logoFileNameInput.value.trim() }, currentUser.value.id)
  isLogoDialogOpen.value = false
  showToast('Logo Diunggah', 'Logo company tercatat (mock, bukan file gambar nyata).', 'success')
}

/* --- Legal document mock --- */
const isDocDialogOpen = ref(false)
const docName = ref('')
const docCategory = ref('Legal')
const docExpiresAt = ref('')
function openDocDialog () {
  docName.value = ''
  docCategory.value = 'Legal'
  docExpiresAt.value = ''
  isDocDialogOpen.value = true
}
function submitDoc () {
  if (!party.value || !docName.value.trim()) { return }
  createCompanyDocument({ partyId: party.value.id, name: docName.value.trim(), category: docCategory.value.trim() || 'Legal', uploadedBy: currentUser.value.id, expiresAt: docExpiresAt.value || undefined })
  isDocDialogOpen.value = false
  showToast('Dokumen Diunggah', 'Dokumen legal company tercatat (mock, bukan file nyata).', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Company Profile"
      description="Kelola profil company Anda — data legal, billing, tax, kontak, dan preferensi perjalanan."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Company Profile' }]"
    >
      <template #actions>
        <div v-if="!isEditing" class="flex items-center gap-2">
          <Button size="sm" @click="startEdit">
            <Pencil class="h-4 w-4 mr-1.5" />Edit
          </Button>
        </div>
        <div v-else class="flex items-center gap-2">
          <Button size="sm" variant="outline" @click="cancelEdit">
            Cancel
          </Button>
          <Button size="sm" @click="handleSave">
            Save
          </Button>
        </div>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />
    <SectionCard v-else-if="!party">
      <EmptyState :icon="Building2" title="Data company tidak ditemukan" />
    </SectionCard>

    <template v-else>
      <div v-if="party.pendingProfileChange" class="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
        <p class="font-medium">
          Menunggu Verifikasi
        </p>
        <p class="text-muted-foreground mt-0.5">
          Perubahan data sensitif Anda (diajukan {{ party.pendingProfileChangeSubmittedAt ? formatDate(party.pendingProfileChangeSubmittedAt) : '' }}) sedang diverifikasi tim kami — nilai lama tetap berlaku sampai proses selesai.
        </p>
      </div>

      <SectionCard title="Informasi Umum">
        <template v-if="!isEditing">
          <DetailMetadataList
            :items="[
              { label: 'Nama Company', value: party.name },
              { label: 'Tipe Company', value: party.companyType ? findStatusOption(COMPANY_TYPES, party.companyType).label : '—' },
              { label: 'Industri', value: party.industry ?? '—' },
              { label: 'Ukuran', value: party.size ?? '—' },
              { label: 'Telepon', value: party.phone ?? '—' },
              { label: 'Email', value: party.email ?? '—' },
              { label: 'Website', value: party.website ?? '—' },
              { label: 'Logo', value: party.logoFileName ?? 'Belum diunggah' },
            ]"
          />
          <Button size="sm" variant="outline" class="mt-3" @click="openLogoDialog">
            Upload Logo (mock)
          </Button>
        </template>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="cp-name">Nama Company</Label>
            <Input id="cp-name" v-model="form.name" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-type">Tipe Company</Label>
            <select id="cp-type" v-model="form.companyType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer" @change="isDirty = true">
              <option :value="undefined">
                —
              </option>
              <option v-for="option in COMPANY_TYPES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="cp-industry">Industri</Label>
            <Input id="cp-industry" v-model="form.industry" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-size">Ukuran</Label>
            <Input id="cp-size" v-model="form.size" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-phone">Telepon</Label>
            <Input id="cp-phone" v-model="form.phone" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-email">Email</Label>
            <Input id="cp-email" v-model="form.email" type="email" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-website">Website</Label>
            <Input id="cp-website" v-model="form.website" @input="isDirty = true" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Alamat">
        <template v-if="!isEditing">
          <DetailMetadataList
            :items="[
              { label: 'Alamat', value: party.address ?? '—' },
              { label: 'Kota', value: party.city ?? '—' },
              { label: 'Provinsi', value: party.province ?? '—' },
              { label: 'Negara', value: party.country ?? '—' },
              { label: 'Kode Pos', value: party.postalCode ?? '—' },
            ]"
          />
        </template>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="cp-address">Alamat</Label>
            <Input id="cp-address" v-model="form.address" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-city">Kota</Label>
            <Input id="cp-city" v-model="form.city" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-province">Provinsi</Label>
            <Input id="cp-province" v-model="form.province" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-country">Negara</Label>
            <Input id="cp-country" v-model="form.country" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-postal">Kode Pos</Label>
            <Input id="cp-postal" v-model="form.postalCode" @input="isDirty = true" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Billing &amp; Tax Data" description="Perubahan pada bagian ini memerlukan verifikasi tim kami sebelum berlaku.">
        <template v-if="!isEditing">
          <DetailMetadataList
            :items="[
              { label: 'Nomor Registrasi', value: party.registrationNumber ?? '—' },
              { label: 'NPWP', value: party.npwp ?? '—' },
              { label: 'Nama Billing', value: party.billingName ?? '—' },
              { label: 'Alamat Billing', value: party.billingAddress ?? '—' },
              { label: 'Payment Term', value: party.paymentTerm ?? '—' },
              { label: 'Preferred Currency', value: party.preferredCurrency ?? '—' },
              { label: 'PO Required', value: party.poRequired ? 'Ya' : 'Tidak' },
            ]"
          />
        </template>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="cp-reg">Nomor Registrasi</Label>
            <Input id="cp-reg" v-model="form.registrationNumber" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-npwp">NPWP</Label>
            <Input id="cp-npwp" v-model="form.npwp" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-billing-name">Nama Billing</Label>
            <Input id="cp-billing-name" v-model="form.billingName" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-billing-address">Alamat Billing</Label>
            <Input id="cp-billing-address" v-model="form.billingAddress" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-term">Payment Term</Label>
            <Input id="cp-term" v-model="form.paymentTerm" placeholder="mis. Net 30" @input="isDirty = true" />
          </div>
          <div class="space-y-1.5">
            <Label for="cp-currency">Preferred Currency</Label>
            <select id="cp-currency" v-model="form.preferredCurrency" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer" @change="isDirty = true">
              <option :value="undefined">
                —
              </option>
              <option v-for="option in INVOICE_CURRENCIES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox v-model="form.poRequired" @update:model-value="isDirty = true" />PO Required sebelum invoice diterbitkan
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Travel Preferences">
        <template v-if="!isEditing">
          <p class="text-sm text-foreground whitespace-pre-line">
            {{ party.travelPreferences ?? 'Belum ada preferensi tercatat.' }}
          </p>
        </template>
        <textarea v-else v-model="form.travelPreferences" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" @input="isDirty = true" />
      </SectionCard>

      <SectionCard title="Contacts">
        <template #actions>
          <Button size="sm" variant="outline" @click="openAddContact">
            <Plus class="h-4 w-4 mr-1.5" />Tambah Kontak
          </Button>
        </template>
        <ul v-if="contacts.length" class="divide-y divide-border">
          <li v-for="contact in contacts" :key="contact.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground">
                {{ contact.name }} <span class="text-xs text-muted-foreground">— {{ contact.title }}</span>
              </p>
              <p class="text-xs text-muted-foreground">
                {{ contact.email ?? '—' }} · {{ contact.phone ?? '—' }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button class="p-1.5 hover:bg-muted rounded" aria-label="Edit kontak" @click="openEditContact(contact)">
                <Pencil class="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button class="p-1.5 hover:bg-muted rounded" aria-label="Hapus kontak" @click="openDeleteContact(contact)">
                <Trash2 class="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada kontak" />
      </SectionCard>

      <SectionCard title="Company Documents">
        <template #actions>
          <Button size="sm" variant="outline" @click="openDocDialog">
            <Plus class="h-4 w-4 mr-1.5" />Upload Document
          </Button>
        </template>
        <ul v-if="companyDocuments.length" class="divide-y divide-border">
          <li v-for="doc in companyDocuments" :key="doc.id" class="py-2 flex items-center justify-between gap-3">
            <span class="text-sm text-foreground truncate">{{ doc.name }} <span class="text-xs text-muted-foreground">v{{ doc.version }}</span></span>
            <span v-if="doc.expiresAt" class="text-xs text-muted-foreground shrink-0">Kedaluwarsa {{ formatDate(doc.expiresAt) }}</span>
          </li>
        </ul>
        <EmptyState v-else :icon="FileText" title="Belum ada dokumen legal" />
      </SectionCard>

      <SectionCard title="Change History">
        <ActivityTimeline :items="changeHistory" empty-label="Belum ada riwayat perubahan" />
      </SectionCard>

      <Dialog v-model:open="isContactDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ editingContact ? 'Edit Kontak' : 'Tambah Kontak' }}</DialogTitle>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="ct-name">Nama</Label>
              <Input id="ct-name" v-model="contactName" />
            </div>
            <div class="space-y-1.5">
              <Label for="ct-title">Jabatan</Label>
              <Input id="ct-title" v-model="contactTitle" placeholder="mis. Finance Contact / Emergency Contact" />
            </div>
            <div class="space-y-1.5">
              <Label for="ct-email">Email (opsional)</Label>
              <Input id="ct-email" v-model="contactEmail" type="email" />
            </div>
            <div class="space-y-1.5">
              <Label for="ct-phone">Telepon (opsional)</Label>
              <Input id="ct-phone" v-model="contactPhone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isContactDialogOpen = false">
              Batal
            </Button>
            <Button :disabled="!contactName.trim() || !contactTitle.trim()" @click="submitContact">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isDeleteContactDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Kontak</DialogTitle>
            <DialogDescription>
              Kontak "{{ contactPendingDelete?.name }}" akan dihapus dari profil perusahaan. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="isDeleteContactDialogOpen = false">
              Batal
            </Button>
            <Button variant="destructive" @click="confirmDeleteContact">
              Hapus Kontak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isLogoDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Logo</DialogTitle>
            <DialogDescription>Mock upload — tidak ada file gambar nyata, hanya nama file tercatat.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="logo-name">Nama File</Label>
            <Input id="logo-name" v-model="logoFileNameInput" placeholder="mis. logo-manova.png" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isLogoDialogOpen = false">
              Batal
            </Button>
            <Button :disabled="!logoFileNameInput.trim()" @click="submitLogo">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isDocDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Legal Document</DialogTitle>
            <DialogDescription>Mock upload — tidak ada file storage nyata, hanya metadata tercatat.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="doc-name">Nama Dokumen</Label>
              <Input id="doc-name" v-model="docName" placeholder="mis. Akta Pendirian PT.pdf" />
            </div>
            <div class="space-y-1.5">
              <Label for="doc-category">Kategori</Label>
              <Input id="doc-category" v-model="docCategory" />
            </div>
            <div class="space-y-1.5">
              <Label for="doc-expiry">Expiry Date (opsional)</Label>
              <Input id="doc-expiry" v-model="docExpiresAt" type="date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isDocDialogOpen = false">
              Batal
            </Button>
            <Button :disabled="!docName.trim()" @click="submitDoc">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
