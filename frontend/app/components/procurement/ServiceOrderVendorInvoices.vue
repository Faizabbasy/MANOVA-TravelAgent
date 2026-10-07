<script setup lang="ts">
import { VENDOR_STATUS_LABEL } from '~/lib/finance/labels'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { ServiceOrderVendorInvoice } from '~/types/procurement'

/**
 * Vendor invoices Finance recorded for one service order (S5) — read-only. Review, approval and payment happen in
 * Finance → Utang Vendor; Procurement only sees whether the order was billed and how far it got.
 */
defineProps<{ invoices: ServiceOrderVendorInvoice[] }>()
const isMobile = useIsMobile()

const TONE: Record<ServiceOrderVendorInvoice['status'], 'info' | 'success' | 'neutral'> = {
  submitted: 'info',
  under_review: 'info',
  approved: 'success',
  rejected: 'neutral',
  void: 'neutral'
}
</script>

<template>
  <SectionCard title="Tagihan Vendor" description="Tagihan vendor yang dicatat Finance untuk Service Order ini. Review dan pembayaran dilakukan di Finance → Utang Vendor.">
    <ResponsiveDataView :items="invoices" :get-key="invoice => invoice.id">
      <template #desktop="{ items }">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Invoice Vendor</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="invoice in items" :key="invoice.id">
              <TableCell class="font-medium">
                {{ invoice.vendorInvoiceNumber }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(invoice.invoiceDate) }}
              </TableCell>
              <TableCell>{{ invoice.totalIdr !== undefined ? formatCurrencyIdr(invoice.totalIdr) : '—' }}</TableCell>
              <TableCell><StatusBadge :label="VENDOR_STATUS_LABEL[invoice.status]" :tone="TONE[invoice.status]" /></TableCell>
            </TableRow>
            <TableEmpty v-if="invoices.length === 0" :colspan="4">
              Belum ada tagihan vendor untuk Service Order ini.
            </TableEmpty>
          </TableBody>
        </Table>
      </template>
      <template #mobile-card="{ item: invoice }">
        <div class="rounded-lg border border-border p-3">
          <div class="flex items-start justify-between gap-2">
            <p class="font-medium text-foreground">
              {{ invoice.vendorInvoiceNumber }}
            </p>
            <StatusBadge :label="VENDOR_STATUS_LABEL[invoice.status]" :tone="TONE[invoice.status]" />
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ formatDate(invoice.invoiceDate) }} · {{ invoice.totalIdr !== undefined ? formatCurrencyIdr(invoice.totalIdr) : '—' }}
          </p>
        </div>
      </template>
    </ResponsiveDataView>
    <p v-if="isMobile && invoices.length === 0" class="text-sm text-muted-foreground">
      Belum ada tagihan vendor untuk Service Order ini.
    </p>
  </SectionCard>
</template>
