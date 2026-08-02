<script setup lang="ts">
import { computed } from 'vue'
import { Target, Users, Handshake, FileText } from 'lucide-vue-next'
import { PARTIES, OPPORTUNITIES, QUOTATIONS } from '~/data'
import { formatNumber } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'CRM' })

const { canView } = usePermissions()

const summary = computed(() => ({
  prospects: PARTIES.filter(party => party.lifecycleStatus === 'prospect').length,
  clients: PARTIES.filter(party => party.lifecycleStatus === 'client').length,
  activeOpportunities: OPPORTUNITIES.filter(opp => !['won', 'lost'].includes(opp.stage)).length,
  quotations: QUOTATIONS.length
}))

const cards = computed(() => [
  { label: 'Prospects', value: summary.value.prospects, icon: Target, to: '/crm/prospects' },
  { label: 'Clients', value: summary.value.clients, icon: Users, to: '/crm/clients' },
  { label: 'Opportunity Aktif', value: summary.value.activeOpportunities, icon: Handshake, to: '/crm/opportunities' },
  { label: 'Quotations', value: summary.value.quotations, icon: FileText, to: '/crm/quotations' }
])
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="CRM"
      description="Ringkasan pihak (prospect/client), opportunity, dan quotation."
      :breadcrumb="[{ label: 'CRM' }]"
    />

    <RoleAccessState v-if="!canView('crm')" module-label="modul CRM" />

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink v-for="card in cards" :key="card.label" :to="card.to" class="block">
        <StatsCard :title="card.label" :value="formatNumber(card.value)" :icon="card.icon" />
      </NuxtLink>
    </div>
  </div>
</template>
