<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getProjectServiceById, getProjectById, getServiceOrderByService } from '~/data'
import { SERVICE_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const { canView, vendorScopeId } = usePermissions()

const service = computed(() => getProjectServiceById(String(route.params.id)))
const isOwn = computed(() => Boolean(service.value && vendorScopeId.value && service.value.vendorId === vendorScopeId.value))
const project = computed(() => (service.value ? getProjectById(service.value.projectId) : undefined))
const serviceOrder = computed(() => (service.value ? getServiceOrderByService(service.value.id) : undefined))

useHead({ title: computed(() => service.value ? service.value.label : 'Assignment Tidak Ditemukan') })
</script>

<template>
  <div class="space-y-6">
    <template v-if="!service || !isOwn">
      <PageHeader title="Assignment Tidak Ditemukan" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Orders', to: '/supplier/orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Assignment tidak ditemukan" description="Assignment ini tidak ada atau bukan milik company Anda." />
      </SectionCard>
    </template>

    <template v-else-if="!canView('supplier-portal')">
      <RoleAccessState module-label="Supplier Portal" />
    </template>

    <template v-else>
      <PageHeader
        :title="service.label"
        :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Orders', to: '/supplier/orders' }, { label: service.label }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(SERVICE_STATUSES, service.status).label" :tone="findStatusOption(SERVICE_STATUSES, service.status).tone" />
        </template>
      </PageHeader>

      <SectionCard title="Detail Assignment">
        <DetailMetadataList :items="[
          { label: 'Project Order', value: project?.name ?? service.projectId },
          { label: 'Jenis Layanan', value: findStatusOption(SERVICE_TYPES, service.type).label },
          { label: 'Booking Reference', value: service.bookingReference ?? '—' }
        ]" />
      </SectionCard>

      <SectionCard title="Service Order & Invoice">
        <template v-if="serviceOrder">
          <p class="text-sm text-muted-foreground mb-3">
            Assignment ini sudah tertaut ke Service Order <strong class="text-foreground">{{ serviceOrder.id }}</strong>.
            Ajukan invoice dari halaman Service Order setelah statusnya <strong>Fulfilled</strong>.
          </p>
          <NuxtLink :to="`/supplier/service-orders/${serviceOrder.id}`">
            <Button size="sm">Buka Service Order</Button>
          </NuxtLink>
        </template>
        <EmptyState v-else title="Belum ada Service Order terkait" description="Invoice belum bisa diajukan untuk assignment ini — hubungi tim Manova bila Anda perlu menagih." />
      </SectionCard>
    </template>
  </div>
</template>
