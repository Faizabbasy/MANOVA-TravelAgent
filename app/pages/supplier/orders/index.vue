<script setup lang="ts">
import { computed } from 'vue'
import { getVendorById, getServicesByVendor, getVendorQuotations, getProjectById } from '~/data'
import { SERVICE_STATUSES, VENDOR_QUOTATION_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Assignment & Quotation Saya' })

const { canView, vendorScopeId } = usePermissions()

/** Vendor isolation (Prompt 19) — reuse `getServicesByVendor`/`getVendorQuotations` (Section 13) di-scope ke `vendorScopeId`, tidak pernah membaca `PROJECT_SERVICES`/`VENDOR_QUOTATIONS` penuh. */
const vendor = computed(() => (vendorScopeId.value ? getVendorById(vendorScopeId.value) : undefined))
const assignments = computed(() => (vendorScopeId.value ? getServicesByVendor(vendorScopeId.value) : []))
const quotations = computed(() => (vendorScopeId.value ? getVendorQuotations(vendorScopeId.value) : []))

function projectLabel(projectId: string) {
  return getProjectById(projectId)?.name ?? projectId
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Assignment & Quotation Saya"
      :description="vendor ? `Order/assignment dan quotation milik ${vendor.name} saja.` : 'Assignment dan quotation.'"
      :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Orders' }]"
    />

    <RoleAccessState v-if="!canView('supplier-portal') || !vendor" module-label="Supplier Portal" />

    <template v-else>
      <SectionCard title="Active Assignments" description="Service yang ditugaskan ke company Anda pada Project Order terkait.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Order</TableHead>
              <TableHead>Layanan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Booking Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="service in assignments" :key="service.id">
              <TableCell class="text-muted-foreground">{{ projectLabel(service.projectId) }}</TableCell>
              <TableCell class="font-medium text-foreground">{{ service.label }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SERVICE_STATUSES, service.status).label" :tone="findStatusOption(SERVICE_STATUSES, service.status).tone" /></TableCell>
              <TableCell class="text-muted-foreground">{{ service.bookingReference ?? '—' }}</TableCell>
            </TableRow>
            <TableEmpty v-if="assignments.length === 0" :colspan="4">Belum ada assignment.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Quotation" description="Quotation yang pernah diajukan untuk company Anda.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Order</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Diajukan</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="quotation in quotations" :key="quotation.id">
              <TableCell class="text-muted-foreground">{{ projectLabel(quotation.projectId) }}</TableCell>
              <TableCell class="font-medium text-foreground">{{ formatCurrencyIdr(quotation.amountIdr) }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).label" :tone="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).tone" /></TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(quotation.submittedAt) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ quotation.notes ?? '—' }}</TableCell>
            </TableRow>
            <TableEmpty v-if="quotations.length === 0" :colspan="5">Belum ada quotation.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
