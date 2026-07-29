<script setup lang="ts">
import { ROLES, ROLE_MODULE_ACCESS } from '~/constants/roles'
import type { ModuleKey } from '~/types/user'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Roles and Permissions' })

const { canView } = usePermissions()

const modules: { key: ModuleKey; label: string }[] = [
  { key: 'crm', label: 'CRM' },
  { key: 'project', label: 'Project' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'finance', label: 'Finance' },
  { key: 'reports', label: 'Reports' },
  { key: 'administration', label: 'Administration' },
]
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Roles and Permissions"
      description="Role & Access Matrix — docs/route-and-role-matrix.md bagian 5."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Roles and Permissions' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <SectionCard v-else>
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead v-for="module in modules" :key="module.key">{{ module.label }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="role in ROLES" :key="role.value">
              <TableCell class="font-medium text-foreground whitespace-nowrap">{{ role.label }}</TableCell>
              <TableCell v-for="module in modules" :key="module.key">
                {{ ROLE_MODULE_ACCESS[role.value][module.key] }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  </div>
</template>
