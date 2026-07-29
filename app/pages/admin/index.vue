<script setup lang="ts">
import { Database, Users, ShieldCheck, History } from 'lucide-vue-next'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Administration' })

const { canView } = usePermissions()

const links = [
  { label: 'Master Data', description: 'Kelola daftar master lintas modul', to: '/admin/master-data', icon: Database },
  { label: 'Users', description: 'Kelola user & assignment role', to: '/admin/users', icon: Users },
  { label: 'Roles and Permissions', description: 'Role & access matrix', to: '/admin/roles', icon: ShieldCheck },
  { label: 'Audit Trail', description: 'Log aktivitas lintas modul', to: '/admin/audit-trail', icon: History },
]
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Administration"
      description="Master data, user, role & permission, dan audit trail."
      :breadcrumb="[{ label: 'Administration' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="block">
        <SectionCard :title="link.label" :description="link.description">
          <component :is="link.icon" class="h-5 w-5 text-muted-foreground" />
        </SectionCard>
      </NuxtLink>
    </div>
  </div>
</template>
