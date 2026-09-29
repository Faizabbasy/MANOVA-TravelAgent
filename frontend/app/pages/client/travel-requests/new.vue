<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { TravelRequest } from '~/types/travel-request'

/** Travel Requests — Create (Repair Phase Section 3). Form penuh via `TravelRequestForm` (shared component, dipakai juga oleh `[id]/edit.vue`). */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Ajukan Travel Request' })

const router = useRouter()
const { canView, clientScopeId } = usePermissions()

function onSaved (result: TravelRequest) {
  router.push(`/client/travel-requests/${result.id}/edit`)
}
function onSubmitted (result: TravelRequest) {
  router.push(`/client/travel-requests/${result.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Ajukan Travel Request"
      description="Lengkapi kebutuhan perjalanan Anda — dapat disimpan sebagai draft untuk dilanjutkan nanti."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Approval' }, { label: 'Travel Requests', to: '/client/travel-requests' }, { label: 'Baru' }]"
    />

    <RoleAccessState v-if="!canView('client-portal') || !clientScopeId" module-label="Client Portal" />
    <TravelRequestForm v-else @saved="onSaved" @submitted="onSubmitted" />
  </div>
</template>
