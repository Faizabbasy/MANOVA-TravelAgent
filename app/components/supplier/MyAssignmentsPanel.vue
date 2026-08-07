<script setup lang="ts">
import { computed } from 'vue'
import { getVendorById, getServicesByVendor, getVendorQuotations, getProjectById } from '~/data'
import { SERVICE_STATUSES, VENDOR_QUOTATION_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/** Tab "Assignment & Quotation" — Menu Vendor Portal > Orders (Penyederhanaan 7-Role/Menu). Dulu
 * `/supplier/orders`, kini tab dalam satu menu bersama Service Orders/Vendor Orders — logika tidak diubah. */

const { canView, vendorScopeId } = usePermissions()

/** Vendor isolation (Prompt 19) — reuse `getServicesByVendor`/`getVendorQuotations` (Section 13) di-scope ke `vendorScopeId`, tidak pernah membaca `PROJECT_SERVICES`/`VENDOR_QUOTATIONS` penuh. */
const vendor = computed(() => (vendorScopeId.value ? getVendorById(vendorScopeId.value) : undefined))
const assignments = computed(() => (vendorScopeId.value ? getServicesByVendor(vendorScopeId.value) : []))
const quotations = computed(() => (vendorScopeId.value ? getVendorQuotations(vendorScopeId.value) : []))

function projectLabel (projectId: string) {
  return getProjectById(projectId)?.name ?? projectId
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('supplier-portal') || !vendor" module-label="Vendor Portal" />

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
            <TableRow v-for="service in assignments" :key="service.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/supplier/orders/${service.id}`)">
              <TableCell class="text-muted-foreground">
                {{ projectLabel(service.projectId) }}
              </TableCell>
              <TableCell class="font-medium text-foreground">
                {{ service.label }}
              </TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SERVICE_STATUSES, service.status).label" :tone="findStatusOption(SERVICE_STATUSES, service.status).tone" /></TableCell>
              <TableCell class="text-muted-foreground">
                {{ service.bookingReference ?? '—' }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="assignments.length === 0" :colspan="4">
              Belum ada assignment.
            </TableEmpty>
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
            <TableRow
              v-for="quotation in quotations"
              :key="quotation.id"
              :class="quotation.serviceId ? 'cursor-pointer hover:bg-muted/50' : ''"
              @click="quotation.serviceId && navigateTo(`/supplier/orders/${quotation.serviceId}`)"
            >
              <TableCell class="text-muted-foreground">
                {{ projectLabel(quotation.projectId) }}
              </TableCell>
              <TableCell class="font-medium text-foreground">
                {{ formatCurrencyIdr(quotation.amountIdr) }}
              </TableCell>
              <TableCell><StatusBadge :label="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).label" :tone="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).tone" /></TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(quotation.submittedAt) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ quotation.notes ?? '—' }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="quotations.length === 0" :colspan="5">
              Belum ada quotation.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
