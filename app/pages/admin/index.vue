<script setup lang="ts">
import { computed } from 'vue'
import { Database, Users, History, UserCheck } from 'lucide-vue-next'
import { ROLES } from '~/constants/roles'
import OrganizationProfilePanel from '~/components/admin/OrganizationProfilePanel.vue'

/**
 * Administration > Ringkasan (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung hub link+role switcher (dulu halaman ini sendiri) dan Organization
 * Profile (dulu `/admin/organization`). Disusun sebagai section bertumpuk dalam satu halaman scroll
 * (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`. Kartu link diperbarui mengikuti
 * konsolidasi menu Administration (Users+Roles jadi satu, Audit Trail+Activity Center jadi satu).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Administration' })

const { canView } = usePermissions()
const { users, currentUser, setCurrentUser } = useCurrentUser()

const links = [
  { label: 'Master Data', description: 'Kelola daftar master lintas modul', to: '/admin/master-data', icon: Database },
  { label: 'Users & Roles', description: 'Kelola user, access review, dan role & permission', to: '/admin/users', icon: Users },
  { label: 'Audit & Activity', description: 'Log aktivitas project dan log sistem lintas-modul', to: '/admin/audit-trail', icon: History }
]

const canAdmin = computed(() => canView('administration'))
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Administration"
      description="Master data, user, role & permission, audit trail, dan profil organisasi."
      :breadcrumb="[{ label: 'Administration' }]"
    />

    <RoleAccessState v-if="!canAdmin" module-label="modul Administration" />

    <template v-else>
      <section id="overview" class="space-y-6 scroll-mt-20">
        <h2 class="text-lg font-semibold text-foreground">
          Ringkasan
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="block">
            <SectionCard :title="link.label" :description="link.description">
              <component :is="link.icon" class="h-5 w-5 text-muted-foreground" />
            </SectionCard>
          </NuxtLink>
        </div>

        <!-- Role Switcher Demo — reuse useCurrentUser() source of truth dari Settings -->
        <SectionCard
          title="Demo Role Switcher"
          description="Ganti user demo untuk melihat bagaimana navigasi, dashboard, dan halaman berubah sesuai role. Perubahan berlaku langsung ke seluruh aplikasi."
        >
          <template #actions>
            <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserCheck class="h-4 w-4" />
              <span>Aktif: <span class="font-medium text-foreground">{{ currentUser.name }}</span></span>
            </div>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                <span class="block text-xs text-muted-foreground">
                  {{ ROLES.find(r => r.value === user.role)?.label }}
                </span>
              </span>
              <StatusBadge
                v-if="user.id === currentUser.id"
                label="Aktif"
                tone="success"
              />
            </button>
          </div>
        </SectionCard>
      </section>

      <Separator />

      <section id="organization" class="space-y-4 scroll-mt-20">
        <h2 class="text-lg font-semibold text-foreground">
          Organization Profile
        </h2>
        <OrganizationProfilePanel />
      </section>
    </template>
  </div>
</template>
