<script setup lang="ts">
import { computed } from 'vue'
import SalesFunnelPanel from '~/components/sales/SalesFunnelPanel.vue'
import SalesLeadsPanel from '~/components/sales/SalesLeadsPanel.vue'
import SalesLeadSourceRecapPanel from '~/components/sales/SalesLeadSourceRecapPanel.vue'
import SalesQuotationsPanel from '~/components/sales/SalesQuotationsPanel.vue'

/**
 * Sales > Pipeline — satu menu menampung seluruh corong Lead → Quotation yang sebelumnya tersebar di 2
 * modul (Sales: Leads/Opportunities/Quotation & Invoice; CRM: Customer Journey/Lead Source Recap). Section
 * "Opportunities" DIHAPUS (entitas Opportunity dihapus — lihat komentar desain di `app/types/lead.ts`) —
 * status quotation per Lead sekarang tampil langsung sebagai kolom di `SalesLeadsPanel`, bukan panel
 * terpisah. Disusun sebagai `<Tabs>` (navbar Leads/Funnel/Rekap Sumber Lead/Quotation) — tab aktif
 * disinkronkan ke `route.hash` (bukan disimpan di komponen saja) supaya redirect route lama (lihat
 * `app/pages/customer-journey/**`, `app/pages/crm/**`) dan link internal antar-tahap funnel yang masih
 * memakai anchor `#leads` / `#funnel` / `#lead-sources` / `#quotations` tetap membuka tab yang benar,
 * bukan sekadar men-scroll.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Sales Pipeline' })

type TabKey = 'leads' | 'funnel' | 'lead-sources' | 'quotations'
const TAB_KEYS: TabKey[] = ['leads', 'funnel', 'lead-sources', 'quotations']

const route = useRoute()
const router = useRouter()

const activeTab = computed<TabKey>({
  get: () => {
    const hash = route.hash.replace('#', '')
    return TAB_KEYS.includes(hash as TabKey) ? (hash as TabKey) : 'leads'
  },
  set: (value) => {
    router.replace({ path: route.path, query: route.query, hash: `#${value}` })
  }
})
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Sales Pipeline"
      description="Lead → Qualified → Quotation → Management Approval → Won, dalam satu menu."
      :breadcrumb="[{ label: 'Sales Pipeline' }]"
    />

    <Tabs v-model="activeTab">
      <TabsList>
        <TabsTrigger value="leads">
          Leads
        </TabsTrigger>
        <TabsTrigger value="funnel">
          Funnel
        </TabsTrigger>
        <TabsTrigger value="lead-sources">
          Rekap Sumber Lead
        </TabsTrigger>
        <TabsTrigger value="quotations">
          Quotation
        </TabsTrigger>
      </TabsList>

      <TabsContent value="leads" class="pt-4">
        <SalesLeadsPanel />
      </TabsContent>

      <TabsContent value="funnel" class="pt-4">
        <SalesFunnelPanel />
      </TabsContent>

      <TabsContent value="lead-sources" class="pt-4">
        <SalesLeadSourceRecapPanel />
      </TabsContent>

      <TabsContent value="quotations" class="pt-4">
        <SalesQuotationsPanel />
      </TabsContent>
    </Tabs>
  </div>
</template>
