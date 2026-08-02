<script setup lang="ts">
import { Database, Users, ShieldCheck, History, UserCheck, Building2 } from 'lucide-vue-next'
import { ROLES } from '~/constants/roles'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Administration' })

const { canView } = usePermissions()
const { users, currentUser, setCurrentUser } = useCurrentUser()

const links = [
  { label: 'Master Data', description: 'Kelola daftar master lintas modul', to: '/admin/master-data', icon: Database },
  { label: 'Users', description: 'Kelola user, suspend/reaktivasi, dan access review', to: '/admin/users', icon: Users },
  { label: 'Roles and Permissions', description: 'Role & access matrix', to: '/admin/roles', icon: ShieldCheck },
  { label: 'Audit Trail', description: 'Log aktivitas lintas modul, dengan pencarian', to: '/admin/audit-trail', icon: History },
  /** Organization Profile (Section 23 — Administration, Master Data dan Audit, roadmap Section 00–24 baru, D-080). Kartu ke-5, pola sama 4 kartu existing. */
  { label: 'Organization Profile', description: 'Profil perusahaan travel agency (singleton)', to: '/admin/organization', icon: Building2 }
]

const canAdmin = computed(() => canView('administration'))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Administration"
      description="Master data, user, role & permission, dan audit trail."
      :breadcrumb="[{ label: 'Administration' }]"
    />

    <RoleAccessState v-if="!canAdmin" module-label="modul Administration" />

    <template v-else>
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
    </template>
  </div>
</template>
