<script setup lang="ts">
import { ref } from 'vue'
import { ROLES } from '~/constants/roles'
import { resetMockState, hasMockSnapshot } from '~/utils/mock-reset'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Settings' })

const { users, currentUser, setCurrentUser } = useCurrentUser()
const { showToast } = useToast()

/** State reset / seed scenario (Section 01) — mengembalikan seluruh mock data ke kondisi seed awal. */
const isResetDialogOpen = ref(false)

function submitReset() {
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
          @click="setCurrentUser(user.id)"
          class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors"
          :class="user.id === currentUser.id
            ? 'border-primary/40 bg-primary/5 text-primary'
            : 'border-border hover:bg-muted text-foreground'"
        >
          <span>
            <span class="font-medium">{{ user.name }}</span>
            <span class="block text-xs text-muted-foreground">{{ ROLES.find(role => role.value === user.role)?.label }}</span>
          </span>
        </button>
      </div>
    </SectionCard>

    <SectionCard
      title="Mock Data Management"
      description="Reset seluruh data demo (Lead, Opportunity, Quotation, Project, Vendor, Finance, Activity) ke kondisi seed awal. Hanya memengaruhi state di browser ini."
    >
      <Dialog v-model:open="isResetDialogOpen">
        <DialogTrigger as-child>
          <Button variant="outline" :disabled="!hasMockSnapshot()">Reset Demo Data</Button>
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
            <Button variant="outline" @click="isResetDialogOpen = false">Batal</Button>
            <Button variant="destructive" @click="submitReset">Reset Demo Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  </div>
</template>
