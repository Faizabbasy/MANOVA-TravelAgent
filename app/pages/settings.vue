<script setup lang="ts">
import { ref } from 'vue'
import { ROLES } from '~/constants/roles'
import { resetRbacToDefaults } from '~/data/rbac'
import { resetMockState, hasMockSnapshot } from '~/utils/mock-reset'
import { getVendorById } from '~/data'
import { SERVICE_TYPES, findStatusOption } from '~/constants/status'
import type { User } from '~/types/user'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Settings' })

const { users, currentUser, setCurrentUser } = useCurrentUser()
const { showToast } = useToast()

/** Untuk akun Vendor Portal, tampilkan kategori layanan vendor-nya (Flight/Hotel/Transportation/MICE) di
 * samping label role "Vendor" — supaya beberapa akun demo vendor bisa dibedakan sekilas saat mau demo per
 * kategori (bukan cuma "Vendor" polos yang ambigu kalau vendornya lebih dari satu). */
function userRoleLabel (user: User): string {
  const roleLabel = ROLES.value.find(role => role.value === user.role)?.label ?? user.role
  if (user.role === 'vendor' && user.vendorId) {
    const vendor = getVendorById(user.vendorId)
    const categoryLabel = vendor ? findStatusOption(SERVICE_TYPES, vendor.serviceType)?.label : undefined
    if (categoryLabel) { return `${roleLabel} — ${categoryLabel}` }
  }
  return roleLabel
}

/**
 * Pemulihan RBAC (Revisi 9-Modul) — SENGAJA ditempatkan di sini, bukan hanya di `/admin/roles`.
 * Bila sebuah role terlanjur kehilangan akses Administration, halaman Roles itu sendiri jadi tidak
 * terjangkau; Settings tidak digerbangi modul apa pun sehingga selalu bisa dibuka.
 */
const isRbacResetOpen = ref(false)

function submitRbacReset () {
  resetRbacToDefaults(currentUser.value.id)
  isRbacResetOpen.value = false
  showToast('RBAC Direset', 'Seluruh role custom dihapus dan permission 13 role bawaan kembali ke default.', 'success')
}

/** State reset / seed scenario (Section 01) — mengembalikan seluruh mock data ke kondisi seed awal. */
const isResetDialogOpen = ref(false)

function submitReset () {
  const success = resetMockState()
  isResetDialogOpen.value = false
  if (!success) {
    showToast('Reset Gagal', 'Snapshot data seed belum tersedia. Muat ulang halaman lalu coba lagi.', 'error')
    return
  }
  showToast('Demo Data Direset', 'Seluruh data mock dikembalikan ke kondisi seed awal.', 'success')
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <PageHeader
      title="Settings"
      description="Profil akun dan demo role switcher."
      :breadcrumb="[{ label: 'Settings' }]"
    />

    <SectionCard title="Profil Akun">
      <DetailMetadataList
        :items="[
          { label: 'Nama', value: currentUser.name },
          { label: 'Email', value: currentUser.email },
          { label: 'Role', value: ROLES.find(role => role.value === currentUser.role)?.label ?? currentUser.role },
        ]"
      />
    </SectionCard>

    <SectionCard
      title="Demo Role Switcher"
      description="Ganti user demo untuk melihat bagaimana navigasi dan dashboard berubah sesuai role (Prompt 5-I)."
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          v-for="user in users"
          :key="user.id"
          class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors"
          :class="user.id === currentUser.id
            ? 'border-primary/40 bg-primary/5 text-primary'
            : 'border-border hover:bg-muted text-foreground'"
          @click="setCurrentUser(user.id)"
        >
          <span>
            <span class="font-medium">{{ user.name }}</span>
            <span class="block text-xs text-muted-foreground">{{ userRoleLabel(user) }}</span>
          </span>
        </button>
      </div>
    </SectionCard>

    <SectionCard
      title="Pemulihan Role & Permission"
      description="Kembalikan seluruh konfigurasi role ke default bila ada role yang salah dikonfigurasi hingga kehilangan akses. Penugasan user ke role tidak ikut direset."
    >
      <Dialog v-model:open="isRbacResetOpen">
        <DialogTrigger as-child>
          <Button variant="outline">
            Reset Role & Permission
          </Button>
        </DialogTrigger>
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Role & Permission</DialogTitle>
            <DialogDescription>
              Seluruh role custom yang dibuat dari Admin &gt; Roles akan dihapus, dan grant modul, override
              menu, serta action flag 13 role bawaan dikembalikan ke kondisi seed. Aksi ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="isRbacResetOpen = false">
              Batal
            </Button>
            <Button variant="destructive" @click="submitRbacReset">
              Reset Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>

    <SectionCard
      title="Mock Data Management"
      description="Reset seluruh data demo (Lead, Opportunity, Quotation, Project, Vendor, Finance, Activity) ke kondisi seed awal. Hanya memengaruhi state di browser ini."
    >
      <Dialog v-model:open="isResetDialogOpen">
        <DialogTrigger as-child>
          <Button variant="outline" :disabled="!hasMockSnapshot()">
            Reset Demo Data
          </Button>
        </DialogTrigger>
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Demo Data</DialogTitle>
            <DialogDescription>
              Seluruh perubahan yang sudah dibuat pada mock data (Lead baru, Opportunity, Quotation, Project, dll.)
              akan dikembalikan ke kondisi seed awal. Aksi ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="isResetDialogOpen = false">
              Batal
            </Button>
            <Button variant="destructive" @click="submitReset">
              Reset Demo Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  </div>
</template>
