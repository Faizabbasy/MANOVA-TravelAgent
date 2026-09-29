<script setup lang="ts">
import { ref, watch } from 'vue'
import { Building2 } from 'lucide-vue-next'
import { ORGANIZATION_PROFILE, updateOrganizationProfile } from '~/data'
import { formatDateTime } from '~/utils/format'

/**
 * Tab "Organization Profile" — Menu Administration > Ringkasan (Penyederhanaan 7-Role/Menu). Dulu
 * `/admin/organization`, kini tab dalam satu menu bersama Ringkasan — logika tidak diubah. Singleton —
 * profil perusahaan travel agency itu sendiri (BUKAN multi-tenancy, D-080).
 */

const { canView, canManage } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const canEdit = computed(() => canManage('administration'))

const form = ref({
  legalName: ORGANIZATION_PROFILE.legalName,
  displayName: ORGANIZATION_PROFILE.displayName,
  address: ORGANIZATION_PROFILE.address,
  defaultCurrencyCode: ORGANIZATION_PROFILE.defaultCurrencyCode,
  businessHours: ORGANIZATION_PROFILE.businessHours,
  contactEmail: ORGANIZATION_PROFILE.contactEmail,
  contactPhone: ORGANIZATION_PROFILE.contactPhone
})

const isDirty = ref(false)
watch(form, () => { isDirty.value = true }, { deep: true })

const isValid = computed(() =>
  form.value.legalName.trim().length > 0 &&
  form.value.displayName.trim().length > 0 &&
  form.value.address.trim().length > 0 &&
  form.value.contactEmail.trim().length > 0)

function resetForm () {
  form.value = {
    legalName: ORGANIZATION_PROFILE.legalName,
    displayName: ORGANIZATION_PROFILE.displayName,
    address: ORGANIZATION_PROFILE.address,
    defaultCurrencyCode: ORGANIZATION_PROFILE.defaultCurrencyCode,
    businessHours: ORGANIZATION_PROFILE.businessHours,
    contactEmail: ORGANIZATION_PROFILE.contactEmail,
    contactPhone: ORGANIZATION_PROFILE.contactPhone
  }
  isDirty.value = false
}

function submit () {
  if (!isValid.value) {
    showToast('Gagal Menyimpan', 'Legal Name, Display Name, Address, dan Contact Email wajib diisi.', 'error')
    return
  }
  updateOrganizationProfile(
    {
      legalName: form.value.legalName.trim(),
      displayName: form.value.displayName.trim(),
      address: form.value.address.trim(),
      defaultCurrencyCode: form.value.defaultCurrencyCode.trim(),
      businessHours: form.value.businessHours.trim(),
      contactEmail: form.value.contactEmail.trim(),
      contactPhone: form.value.contactPhone.trim()
    },
    currentUser.value.id
  )
  isDirty.value = false
  showToast('Profil Organisasi Disimpan', 'Perubahan tercatat di Audit Trail.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <template v-else>
      <SectionCard
        title="Profil Perusahaan"
        description="Data ini murni referensi tampilan (header dokumen, kontak resmi) — tidak mengubah entitas Party/Client/Vendor mana pun."
      >
        <template #actions>
          <Building2 class="h-5 w-5 text-muted-foreground" />
        </template>

        <div v-if="!canEdit" class="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground mb-4">
          Anda hanya memiliki akses lihat. Hubungi Super Admin untuk mengubah profil organisasi.
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="org-legal-name">Legal Name</Label>
            <Input id="org-legal-name" v-model="form.legalName" :disabled="!canEdit" />
          </div>
          <div class="space-y-1.5">
            <Label for="org-display-name">Display Name</Label>
            <Input id="org-display-name" v-model="form.displayName" :disabled="!canEdit" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="org-address">Address</Label>
            <Input id="org-address" v-model="form.address" :disabled="!canEdit" />
          </div>
          <div class="space-y-1.5">
            <Label for="org-currency">Default Currency Code</Label>
            <Input id="org-currency" v-model="form.defaultCurrencyCode" :disabled="!canEdit" placeholder="mis. IDR" />
          </div>
          <div class="space-y-1.5">
            <Label for="org-hours">Business Hours</Label>
            <Input id="org-hours" v-model="form.businessHours" :disabled="!canEdit" />
          </div>
          <div class="space-y-1.5">
            <Label for="org-email">Contact Email</Label>
            <Input id="org-email" v-model="form.contactEmail" type="email" :disabled="!canEdit" />
          </div>
          <div class="space-y-1.5">
            <Label for="org-phone">Contact Phone</Label>
            <Input id="org-phone" v-model="form.contactPhone" :disabled="!canEdit" />
          </div>
        </div>

        <p class="text-xs text-muted-foreground mt-4">
          Terakhir diperbarui {{ formatDateTime(ORGANIZATION_PROFILE.updatedAt) }} oleh {{ ORGANIZATION_PROFILE.updatedBy }}.
        </p>

        <div v-if="canEdit" class="flex items-center gap-2 mt-4">
          <Button :disabled="!isDirty || !isValid" @click="submit">
            Simpan Perubahan
          </Button>
          <Button variant="outline" :disabled="!isDirty" @click="resetForm">
            Batal
          </Button>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
