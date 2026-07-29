<script setup lang="ts">
import { computed } from 'vue'
import { Receipt, Wallet, AlertTriangle } from 'lucide-vue-next'
import { getOutstandingInvoices, INVOICES } from '~/data'
import { isInvoiceOverdue } from '~/utils/attention'
import { formatCurrencyIdr, formatNumber } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Finance' })

const { canView, canViewFinancials } = usePermissions()

const outstanding = computed(() => getOutstandingInvoices())
const outstandingTotal = computed(() => outstanding.value.reduce((sum, invoice) => sum + invoice.amountIdr, 0))
const overdueCount = computed(() => INVOICES.filter(invoice => isInvoiceOverdue(invoice)).length)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Finance"
      description="Ringkasan invoice dan pembayaran lintas-project."
      :breadcrumb="[{ label: 'Finance' }]"
    />

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Invoice Outstanding" :value="formatNumber(outstanding.length)" :icon="Receipt" />
        <StatsCard
          v-if="canViewFinancials"
          title="Total Outstanding"
          :value="formatCurrencyIdr(outstandingTotal)"
          :icon="Wallet"
          icon-color="warning"
        />
        <StatsCard title="Invoice Overdue" :value="formatNumber(overdueCount)" :icon="AlertTriangle" icon-color="destructive" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NuxtLink to="/finance/invoices" class="block">
          <SectionCard title="Invoices" description="Lihat seluruh invoice lintas-project">
            <p class="text-sm text-muted-foreground">Buka daftar invoice →</p>
          </SectionCard>
        </NuxtLink>
        <NuxtLink to="/finance/payments" class="block">
          <SectionCard title="Payments" description="Lihat seluruh payment lintas-project">
            <p class="text-sm text-muted-foreground">Buka daftar payment →</p>
          </SectionCard>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
