<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plane, CheckCircle2, ShieldCheck } from 'lucide-vue-next'
import { createLead, updateLeadQualification, getLeadDuplicateCandidates } from '~/data'
import { LEAD_SOURCES, LEAD_SERVICE_CATEGORIES } from '~/constants/status'
import type { Lead, LeadServiceCategory, LeadSource } from '~/types/lead'

/**
 * Public Lead Intake (Section 03 — roadmap Section 00–24 baru). TIDAK memakai layout `dashboard`/
 * middleware `auth` — halaman publik tanpa login, tanpa akses ke dashboard internal apa pun (Wajib
 * "Public tidak mendapat dashboard internal"). Submission menulis langsung ke `LEADS` centralized state
 * yang sama dipakai `/customer-journey/leads` dan `/customer-journey/lead-sources` — bukan dataset paralel,
 * sehingga otomatis "Lead public dapat ditelusuri ke Lead list dan Lead Source Recap" (acceptance).
 */
definePageMeta({ layout: false })
useHead({ title: 'Ajukan Permintaan Perjalanan — MANOVA' })

const route = useRoute()

/**
 * Owner default submission publik (D-060) — belum ada mekanisme distribusi/assignment lead publik
 * otomatis ke Sales tertentu (di luar scope Section 03); memakai `USR-001` (satu-satunya user demo
 * role Sales, sudah jadi owner seluruh Lead fixture existing) sebagai default yang konsisten.
 */
const PUBLIC_INTAKE_OWNER_ID = 'USR-001'

const CATEGORY_COPY: Record<LeadServiceCategory, { title: string; description: string; destinationLabel: string; travelerLabel: string }> = {
  'corporate-travel': {
    title: 'Corporate Travel',
    description: 'Perjalanan bisnis untuk tim atau karyawan perusahaan Anda.',
    destinationLabel: 'Tujuan Perjalanan Bisnis',
    travelerLabel: 'Perkiraan Jumlah Karyawan'
  },
  'group-travel': {
    title: 'Group Travel',
    description: 'Perjalanan rombongan/grup untuk komunitas, sekolah, atau organisasi.',
    destinationLabel: 'Tujuan Perjalanan Grup',
    travelerLabel: 'Perkiraan Jumlah Peserta'
  },
  'individual-travel': {
    title: 'Individual Travel',
    description: 'Perjalanan pribadi untuk Anda dan keluarga.',
    destinationLabel: 'Tujuan Perjalanan',
    travelerLabel: 'Perkiraan Jumlah Traveler'
  },
  'mice-event': {
    title: 'MICE / Event',
    description: 'Meeting, Incentive, Conference, atau Exhibition.',
    destinationLabel: 'Lokasi / Venue Acara',
    travelerLabel: 'Perkiraan Jumlah Peserta Acara'
  }
}

const VALID_CATEGORIES = LEAD_SERVICE_CATEGORIES.map(option => option.value)
const queryType = route.query.type
const selectedCategory = ref<LeadServiceCategory>(
  typeof queryType === 'string' && VALID_CATEGORIES.includes(queryType as LeadServiceCategory)
    ? (queryType as LeadServiceCategory)
    : 'corporate-travel'
)

/* UTM/source/referrer preview (Wajib) — capture query string + document.referrer, tampil sebagai preview transparan. */
const utmSource = computed(() => (typeof route.query.utm_source === 'string' ? route.query.utm_source : ''))
const utmMedium = computed(() => (typeof route.query.utm_medium === 'string' ? route.query.utm_medium : ''))
const utmCampaign = computed(() => (typeof route.query.utm_campaign === 'string' ? route.query.utm_campaign : ''))
const referrer = ref('')
onMounted(() => {
  referrer.value = document.referrer || ''
})
const hasTrackingData = computed(() => Boolean(utmSource.value || utmMedium.value || utmCampaign.value || referrer.value))

function mapUtmSourceToLeadSource (value: string): LeadSource {
  const v = value.toLowerCase()
  if (v.includes('instagram')) { return 'instagram' }
  if (v.includes('tiktok')) { return 'tiktok' }
  if (v.includes('whatsapp') || v === 'wa') { return 'whatsapp' }
  if (v.includes('referral') || v.includes('refer')) { return 'referral' }
  if (v.includes('event')) { return 'event' }
  if (v.includes('email') || v.includes('newsletter')) { return 'email' }
  if (v.includes('google') || v.includes('website') || v.includes('web')) { return 'website' }
  return 'other'
}

/* Form state */
const sourceField = ref<LeadSource>(utmSource.value ? mapUtmSourceToLeadSource(utmSource.value) : 'website')
const contactName = ref('')
const companyName = ref('')
const phone = ref('')
const email = ref('')
const destination = ref('')
const travelerEstimate = ref<number | null>(null)
const requirementSummary = ref('')
const consentAccepted = ref(false)
const showPrivacyDetail = ref(false)

/** Duplicate suggestion (non-blocking) — reuse selector bersama `getLeadDuplicateCandidates` (Section 04, dipakai juga internal `/customer-journey/leads`). */
const duplicateMatch = computed<Lead | undefined>(() => getLeadDuplicateCandidates({ phone: phone.value, email: email.value })[0])

/* Validation */
const missingFields = computed(() => {
  const missing: string[] = []
  if (!contactName.value.trim()) { missing.push('Nama Kontak belum diisi') }
  if (!phone.value.trim() && !email.value.trim()) { missing.push('Isi minimal salah satu: Telepon atau Email') }
  if (!consentAccepted.value) { missing.push('Persetujuan (consent) belum dicentang') }
  return missing
})
const hasAttemptedSubmit = ref(false)

/* Submit / success / error state */
const viewState = ref<'form' | 'success' | 'error'>('form')
const createdLead = ref<Lead | null>(null)

function submitIntake () {
  hasAttemptedSubmit.value = true
  if (missingFields.value.length > 0) { return }

  try {
    const lead = createLead({
      name: contactName.value.trim(),
      companyName: companyName.value.trim() || undefined,
      source: sourceField.value,
      ownerId: PUBLIC_INTAKE_OWNER_ID,
      phone: phone.value.trim() || undefined,
      email: email.value.trim() || undefined
    })

    const trackingParts = [
      utmSource.value && `utm_source=${utmSource.value}`,
      utmMedium.value && `utm_medium=${utmMedium.value}`,
      utmCampaign.value && `utm_campaign=${utmCampaign.value}`,
      referrer.value && `referrer=${referrer.value}`
    ].filter(Boolean)

    updateLeadQualification(lead.id, {
      serviceCategory: selectedCategory.value,
      destination: destination.value.trim() || undefined,
      travelerEstimate: travelerEstimate.value ?? undefined,
      requirementSummary: requirementSummary.value.trim() || undefined,
      qualificationNotes: `Submission dari form publik Lead Intake (${CATEGORY_COPY[selectedCategory.value].title}).${trackingParts.length ? ` Tracking: ${trackingParts.join(', ')}.` : ''}`
    })

    createdLead.value = lead
    viewState.value = 'success'
  } catch {
    viewState.value = 'error'
  }
}

function resetForm () {
  contactName.value = ''
  companyName.value = ''
  phone.value = ''
  email.value = ''
  destination.value = ''
  travelerEstimate.value = null
  requirementSummary.value = ''
  consentAccepted.value = false
  hasAttemptedSubmit.value = false
  createdLead.value = null
  viewState.value = 'form'
}
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center p-4 py-10">
    <div class="w-full max-w-2xl">
      <!-- Logo -->
      <div class="flex flex-col items-center gap-2 mb-8">
        <div class="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground">
          <Plane class="h-6 w-6" />
        </div>
        <span class="text-xl font-bold text-foreground tracking-tight">MANOVA</span>
      </div>

      <div class="bg-card rounded-3xl p-6 sm:p-8 card-shadow">
        <!-- Success state -->
        <template v-if="viewState === 'success' && createdLead">
          <div class="flex flex-col items-center text-center py-6">
            <div class="p-4 rounded-full bg-success/10 mb-4">
              <CheckCircle2 class="h-8 w-8 text-success" />
            </div>
            <h1 class="text-xl font-bold text-foreground mb-2">
              Permintaan Anda Telah Diterima
            </h1>
            <p class="text-sm text-muted-foreground max-w-md">
              Terima kasih, {{ createdLead.name }}. Tim MANOVA akan menghubungi Anda melalui
              {{ createdLead.phone || createdLead.email }} dalam 1x24 jam kerja (simulasi mockup).
            </p>
            <div class="mt-4 px-4 py-2 rounded-lg bg-muted">
              <p class="text-xs text-muted-foreground">
                Nomor Referensi
              </p>
              <p class="text-sm font-mono font-semibold text-foreground">
                {{ createdLead.id }}
              </p>
            </div>
            <Button class="mt-6" variant="outline" @click="resetForm">
              Ajukan Permintaan Baru
            </Button>
          </div>
        </template>

        <!-- Error state -->
        <template v-else-if="viewState === 'error'">
          <ErrorState
            title="Gagal Mengirim Permintaan"
            description="Terjadi kesalahan saat menyimpan permintaan Anda. Silakan coba lagi."
            retryable
            @retry="viewState = 'form'"
          />
        </template>

        <!-- Form -->
        <template v-else>
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-foreground mb-2">
              Ajukan Permintaan Perjalanan
            </h1>
            <p class="text-sm text-muted-foreground">
              Ceritakan kebutuhan perjalanan Anda, tim kami akan segera menghubungi.
            </p>
          </div>

          <!-- Jenis Kebutuhan -->
          <div class="space-y-1.5 mb-4">
            <Label>Jenis Kebutuhan</Label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="option in LEAD_SERVICE_CATEGORIES"
                :key="option.value"
                type="button"
                class="rounded-lg border px-3 py-2 text-sm text-left transition-colors"
                :class="selectedCategory === option.value
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted text-foreground'"
                @click="selectedCategory = option.value"
              >
                {{ CATEGORY_COPY[option.value].title }}
              </button>
            </div>
            <p class="text-xs text-muted-foreground pt-1">
              {{ CATEGORY_COPY[selectedCategory].description }}
            </p>
          </div>

          <form class="space-y-4" @submit.prevent="submitIntake">
            <div class="space-y-1.5">
              <Label for="li-name">Nama Kontak</Label>
              <Input id="li-name" v-model="contactName" placeholder="Nama lengkap Anda" />
            </div>
            <div class="space-y-1.5">
              <Label for="li-company">Nama Company (opsional)</Label>
              <Input id="li-company" v-model="companyName" placeholder="mis. PT Nama Perusahaan" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <Label for="li-phone">Telepon</Label>
                <Input id="li-phone" v-model="phone" placeholder="08xx-xxxx-xxxx" />
              </div>
              <div class="space-y-1.5">
                <Label for="li-email">Email</Label>
                <Input id="li-email" v-model="email" type="email" placeholder="nama@example.com" />
              </div>
            </div>
            <p class="text-xs text-muted-foreground -mt-2">
              Isi minimal salah satu: Telepon atau Email, agar tim kami dapat menghubungi Anda.
            </p>

            <div v-if="duplicateMatch" class="rounded-lg border border-info/30 bg-info/5 p-3">
              <p class="text-sm text-info">
                Sepertinya Anda pernah mengirim permintaan sebelumnya ({{ duplicateMatch.id }}). Tidak masalah bila ingin
                mengajukan permintaan baru — tim kami akan meninjau keduanya bersamaan.
              </p>
            </div>

            <div class="space-y-1.5">
              <Label for="li-destination">{{ CATEGORY_COPY[selectedCategory].destinationLabel }} (opsional)</Label>
              <Input id="li-destination" v-model="destination" placeholder="mis. Bali, Indonesia" />
            </div>
            <div class="space-y-1.5">
              <Label for="li-traveler">{{ CATEGORY_COPY[selectedCategory].travelerLabel }} (opsional)</Label>
              <Input id="li-traveler" v-model.number="travelerEstimate" type="number" placeholder="mis. 10" />
            </div>
            <div class="space-y-1.5">
              <Label for="li-summary">Ceritakan Kebutuhan Anda (opsional)</Label>
              <textarea
                id="li-summary"
                v-model="requirementSummary"
                rows="3"
                class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ringkasan singkat kebutuhan perjalanan Anda"
              />
            </div>

            <div class="space-y-1.5">
              <Label for="li-source">Bagaimana Anda mengetahui MANOVA?</Label>
              <select
                id="li-source"
                v-model="sourceField"
                class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                <option v-for="option in LEAD_SOURCES" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <!-- UTM/source/referrer preview -->
            <div class="rounded-lg border border-border bg-muted/40 p-3">
              <p class="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <ShieldCheck class="h-3.5 w-3.5" />Data Kunjungan (Preview)
              </p>
              <p v-if="!hasTrackingData" class="text-xs text-muted-foreground">
                Kunjungan langsung — tidak ada data UTM atau referrer terdeteksi.
              </p>
              <ul v-else class="text-xs text-muted-foreground space-y-0.5">
                <li v-if="utmSource">
                  utm_source: {{ utmSource }}
                </li>
                <li v-if="utmMedium">
                  utm_medium: {{ utmMedium }}
                </li>
                <li v-if="utmCampaign">
                  utm_campaign: {{ utmCampaign }}
                </li>
                <li v-if="referrer">
                  referrer: {{ referrer }}
                </li>
              </ul>
            </div>

            <!-- Consent -->
            <div class="space-y-2">
              <div class="flex items-start gap-2">
                <Checkbox v-model="consentAccepted" class="mt-0.5" />
                <Label class="!mb-0 font-normal leading-snug">
                  Saya menyetujui MANOVA menyimpan dan menghubungi saya terkait permintaan ini.
                </Label>
              </div>
              <button type="button" class="text-xs text-primary hover:underline" @click="showPrivacyDetail = !showPrivacyDetail">
                {{ showPrivacyDetail ? 'Sembunyikan' : 'Lihat' }} ringkasan kebijakan privasi
              </button>
              <p v-if="showPrivacyDetail" class="text-xs text-muted-foreground leading-relaxed">
                (Mock — bukan dokumen legal sesungguhnya.) Data yang Anda kirimkan hanya digunakan tim internal MANOVA untuk
                menindaklanjuti permintaan perjalanan Anda, tidak dibagikan ke pihak ketiga di luar kebutuhan operasional ini.
              </p>
            </div>

            <div v-if="hasAttemptedSubmit && missingFields.length > 0" class="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p class="text-sm font-medium text-warning">
                Sebelum mengirim, lengkapi dahulu:
              </p>
              <ul class="mt-1 text-xs text-muted-foreground list-disc list-inside">
                <li v-for="item in missingFields" :key="item">
                  {{ item }}
                </li>
              </ul>
            </div>

            <Button type="submit" class="w-full">
              Kirim Permintaan
            </Button>
          </form>
        </template>

        <!-- Footer -->
        <div class="mt-6 text-center">
          <p class="text-xs text-muted-foreground">
            Sistem mockup MANOVA — bukan lingkungan produksi. Data tidak dikirim ke server nyata.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
