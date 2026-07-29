<script setup lang="ts">
import { VENDORS } from '~/data'
import { SERVICE_TYPES, findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Vendors' })

const { canView } = usePermissions()
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Vendors"
      description="Direktori vendor lintas-project (flight, hotel, transportation, MICE)."
      :breadcrumb="[{ label: 'Vendors' }]"
    />

    <RoleAccessState v-if="!canView('vendor')" module-label="modul Vendors" />

    <SectionCard v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Jenis Layanan</TableHead>
            <TableHead>Kontak</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="vendor in VENDORS" :key="vendor.id">
            <TableCell class="font-medium text-foreground">{{ vendor.name }}</TableCell>
            <TableCell>
              <StatusBadge
                :label="findStatusOption(SERVICE_TYPES, vendor.serviceType).label"
                :tone="findStatusOption(SERVICE_TYPES, vendor.serviceType).tone"
              />
            </TableCell>
            <TableCell class="text-muted-foreground">{{ vendor.contactName }}</TableCell>
          </TableRow>
          <TableEmpty v-if="VENDORS.length === 0" :colspan="3">Belum ada vendor.</TableEmpty>
        </TableBody>
      </Table>
    </SectionCard>
  </div>
</template>
