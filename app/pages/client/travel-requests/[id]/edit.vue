<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getTravelRequestById } from '~/data'
import type { TravelRequest } from '~/types/travel-request'

/** Travel Requests — Edit Draft (Repair Phase Section 3). Hanya dapat diakses saat `draft`/`need-clarification` (guard mutator sendiri di `updateTravelRequestDraft`). */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()

const travelRequest = computed(() => getTravelRequestById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(travelRequest.value && clientScopeId.value && travelRequest.value.clientPartyId === clientScopeId.value))
const isEditable = computed(() => Boolean(travelRequest.value && ['draft', 'need-clarification'].includes(travelRequest.value.status)))
useHead({ title: computed(() => travelRequest.value ? `Edit — ${travelRequest.value.requestName}` : 'Tidak Ditemukan') })

function onSaved (result: TravelRequest) {
  router.push(`/client/travel-requests/${result.id}`)
}
function onSubmitted (result: TravelRequest) {
  router.push(`/client/travel-requests/${result.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!travelRequest || !isOwnCompany || !isEditable">
      <PageHeader title="Tidak Dapat Diedit" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Travel Request tidak dapat diedit" description="Permintaan ini tidak ditemukan, bukan milik company Anda, atau sudah tidak berstatus draft/need-clarification.">
          <Button @click="router.push('/client/travel-requests')">
            Kembali ke Travel Requests
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="`Edit — ${travelRequest.requestName}`"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Commercial' }, { label: 'Travel Requests', to: '/client/travel-requests' }, { label: travelRequest.requestName, to: `/client/travel-requests/${travelRequest.id}` }, { label: 'Edit' }]"
      />
      <TravelRequestForm :initial="travelRequest" @saved="onSaved" @submitted="onSubmitted" />
    </template>
  </div>
</template>
