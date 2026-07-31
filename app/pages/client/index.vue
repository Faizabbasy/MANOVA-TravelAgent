<script setup lang="ts">
import { computed } from 'vue'
import { Building2, Briefcase, FolderKanban } from 'lucide-vue-next'
import { getPartyById, getOpportunitiesByParty, getProjectsByParty } from '~/data'
import { OPPORTUNITY_STAGES, PROJECT_STATUSES, findStatusOption } from '~/constants/status'
import { formatDateRange } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Client Portal' })

const { canView, clientScopeId } = usePermissions()

/**
 * Client isolation (Section 02) — seluruh data di halaman ini di-scope ke `clientScopeId` (company/`Party`
 * milik user login), tidak pernah membaca `PARTIES`/`OPPORTUNITIES`/`PROJECTS` penuh. Shell minimal:
 * profil company, daftar Opportunity, dan daftar Project Order milik company sendiri — TANPA nilai
 * komersial (estimasi nilai/quotation/margin) sesuai larangan eksplisit "Jangan menampilkan internal
 * cost/margin kepada Client" (protokol). Fitur penuh (quotation confirm, document, traveler submission,
 * dst.) adalah tanggung jawab Section 08 — Client Portal.
 */
const party = computed(() => (clientScopeId.value ? getPartyById(clientScopeId.value) : undefined))
const opportunities = computed(() => (clientScopeId.value ? getOpportunitiesByParty(clientScopeId.value) : []))
const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Client Portal"
      :description="party ? `${party.name} — akses terbatas ke company Anda sendiri.` : 'Portal client.'"
      :breadcrumb="[{ label: 'Client Portal' }]"
    />

    <RoleAccessState v-if="!canView('client-portal') || !party" module-label="Client Portal" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Status Company" :value="party.lifecycleStatus === 'client' ? 'Active Client' : 'Prospect'" :icon="Building2" />
        <StatsCard title="Opportunity" :value="String(opportunities.length)" :icon="Briefcase" />
        <StatsCard title="Project Order" :value="String(projects.length)" :icon="FolderKanban" />
      </div>

      <SectionCard title="Profil Company">
        <DetailMetadataList :items="[
          { label: 'Nama Company', value: party.name },
          { label: 'Kota', value: party.city || '—' },
          { label: 'Telepon', value: party.phone || '—' },
        ]" />
      </SectionCard>

      <SectionCard title="Opportunity">
        <ul v-if="opportunities.length" class="divide-y divide-border">
          <li v-for="opportunity in opportunities" :key="opportunity.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground truncate">{{ opportunity.title }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ opportunity.destination }}</p>
            </div>
            <StatusBadge
              :label="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).label"
              :tone="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).tone"
            />
          </li>
        </ul>
        <EmptyState v-else title="Belum ada Opportunity" description="Opportunity company Anda akan tampil di sini." />
      </SectionCard>

      <SectionCard title="Project Order">
        <ul v-if="projects.length" class="divide-y divide-border">
          <li v-for="project in projects" :key="project.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <NuxtLink :to="`/projects/${project.id}`" class="text-sm font-medium text-primary hover:underline truncate block">{{ project.name }}</NuxtLink>
              <p class="text-xs text-muted-foreground truncate">
                {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
              </p>
            </div>
            <StatusBadge
              :label="findStatusOption(PROJECT_STATUSES, project.status).label"
              :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
            />
          </li>
        </ul>
        <EmptyState v-else title="Belum ada Project Order" description="Project Order company Anda akan tampil di sini setelah Opportunity Won." />
      </SectionCard>
    </template>
  </div>
</template>
