<script setup lang="ts">
import { computed } from 'vue'
import { getVendorsWithProcurementActivity, getVendorProcurementPerformance } from '~/data'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/** Tab "Rating & Performance" — Menu Vendor & Partner > Data Vendor (Penyederhanaan 7-Role/Menu). Dulu
 * `/procurement/performance`, kini tab dalam satu menu bersama Data Vendor — logika tidak diubah. */

const { canView } = usePermissions()

/** DERIVASI murni dari `RFQ`/`RFQResponse`/`ServiceOrder` existing — lihat `getVendorProcurementPerformance` (`app/data/index.ts`), bukan field tersimpan. */
const rows = computed(() => getVendorsWithProcurementActivity().map(vendor => ({
  vendor,
  performance: getVendorProcurementPerformance(vendor.id)
})))
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('vendor')" module-label="modul Vendor & Partner" />

    <template v-else>
      <SectionCard>
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>RFQ Diundang</TableHead>
                <TableHead>RFQ Direspons</TableHead>
                <TableHead>RFQ Menang</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>Rata-rata Waktu Respons</TableHead>
                <TableHead>Service Order</TableHead>
                <TableHead>On-Time Fulfillment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in rows" :key="row.vendor.id">
                <TableCell class="font-medium text-foreground">
                  <NuxtLink :to="`/vendors/${row.vendor.id}`" class="hover:text-primary hover:underline">
                    {{ row.vendor.name }}
                  </NuxtLink>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.performance.rfqInvitedCount }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.performance.rfqRespondedCount }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.performance.rfqWinCount }}
                </TableCell>
                <TableCell class="text-foreground">
                  {{ row.performance.winRatePercent !== undefined ? `${row.performance.winRatePercent}%` : '—' }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.performance.avgResponseDays !== undefined ? `${row.performance.avgResponseDays} hari` : '—' }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.performance.fulfilledServiceOrderCount }} / {{ row.performance.serviceOrderCount }}
                </TableCell>
                <TableCell class="text-foreground">
                  {{ row.performance.onTimeFulfillmentPercent !== undefined ? `${row.performance.onTimeFulfillmentPercent}%` : '—' }}
                </TableCell>
              </TableRow>
              <TableEmpty v-if="rows.length === 0" :colspan="8">
                Belum ada aktivitas RFQ/Service Order untuk vendor manapun.
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">
          "On-Time Fulfillment" disederhanakan sebagai rasio Service Order yang mencapai status "Fulfilled" terhadap seluruh Service Order milik vendor (tidak ada field due-date terpisah untuk dibandingkan dengan tanggal fulfillment aktual — lihat D-074).
        </p>
      </SectionCard>

      <SectionCard v-for="row in rows" :key="`history-${row.vendor.id}`" :title="`Quotation History — ${row.vendor.name}`">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RFQ</TableHead>
              <TableHead>Total Penawaran</TableHead>
              <TableHead>Diajukan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="response in row.performance.quotationHistory" :key="response.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/procurement/rfq/${response.rfqId}`)">
              <TableCell class="font-medium text-foreground">
                {{ response.rfqId }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(response.totalAmountIdr) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(response.submittedAt) }}
              </TableCell>
              <TableCell><StatusBadge :label="response.status" :tone="response.status === 'selected' ? 'success' : response.status === 'rejected' ? 'destructive' : 'info'" /></TableCell>
            </TableRow>
            <TableEmpty v-if="row.performance.quotationHistory.length === 0" :colspan="4">
              Belum ada riwayat quotation.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
