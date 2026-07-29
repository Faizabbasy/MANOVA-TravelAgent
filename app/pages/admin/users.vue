<script setup lang="ts">
import { USERS } from '~/data'
import { ROLES } from '~/constants/roles'
import { findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Users' })

const { canView } = usePermissions()
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Users"
      description="Daftar user demo dan role masing-masing."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Users' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <SectionCard v-else description="Manajemen user penuh (create/edit/deactivate) menyusul di fase Administration.">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="user in USERS" :key="user.id">
            <TableCell class="font-medium text-foreground">{{ user.name }}</TableCell>
            <TableCell class="text-muted-foreground">{{ user.email }}</TableCell>
            <TableCell>
              <StatusBadge
                :label="findStatusOption(ROLES, user.role).label"
                :tone="findStatusOption(ROLES, user.role).tone"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </SectionCard>
  </div>
</template>
