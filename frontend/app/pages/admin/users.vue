<script setup lang="ts">
import UsersDirectoryPanel from '~/components/admin/UsersDirectoryPanel.vue'
import RolesPermissionsPanel from '~/components/admin/RolesPermissionsPanel.vue'

/**
 * Administration > Users & Roles (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Users (dulu halaman ini sendiri, dengan sub-tab internal Directory/
 * Access Review yang TIDAK berubah) dan Roles and Permissions (dulu `/admin/roles`). Konten tiap section
 * dipindah apa adanya ke `app/components/admin/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu
 * halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Users & Roles' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Users & Roles"
      description="Directory user, access review, dan konfigurasi role & permission — dalam satu menu."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Users & Roles' }]"
    />

    <section id="users" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Users
      </h2>
      <UsersDirectoryPanel />
    </section>

    <Separator />

    <section id="roles" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Roles and Permissions
      </h2>
      <RolesPermissionsPanel />
    </section>
  </div>
</template>
