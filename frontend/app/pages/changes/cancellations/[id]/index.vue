<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getCancellationRecordById, getProjectById, getUserById } from '~/data'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/**
 * Cancellation Record detail (Section 19, D-076) — read-only setelah dibuat (immutable, dibuat aditif dari
 * hook UI-level di halaman detail booking Ticketing/Accommodation/Transportation/MICE, TIDAK punya status
 * lifecycle sendiri). Refund-nya dihitung dan diproses Finance (Phase 5) — kartu Finance di bawah menampilkannya.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView } = usePermissions()

const record = computed(() => getCancellationRecordById(String(route.params.id)))
useHead({ title: computed(() => record.value ? `Cancellation ${record.value.id}` : 'Cancellation Tidak Ditemukan') })

const project = computed(() => (record.value ? getProjectById(record.value.projectId) : undefined))

const summaryMetadata = computed(() => {
  if (!record.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? record.value.projectId },
    { label: 'Booking', value: `${record.value.bookingType} ${record.value.bookingId}` },
    { label: 'Dibatalkan Oleh', value: getUserById(record.value.cancelledBy)?.name ?? record.value.cancelledBy },
    { label: 'Tanggal Dibatalkan', value: formatDate(record.value.cancelledAt) },
    { label: 'Penalty', value: record.value.penaltyIdr !== undefined ? formatCurrencyIdr(record.value.penaltyIdr) : 'Tidak ada penalty' }
  ]
})

const bookingDetailHref = computed(() => {
  if (!record.value) { return undefined }
  const prefix: Record<string, string> = { flight: '/ticketing', hotel: '/accommodation', transport: '/transportation', mice: '/mice' }
  return `${prefix[record.value.bookingType]}/${record.value.bookingId}`
})

</script>

<template>
  <div class="space-y-6">
    <template v-if="!record">
      <PageHeader title="Cancellation Tidak Ditemukan" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=cancellations' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Cancellation tidak ditemukan" :description="`Cancellation dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/changes?tab=cancellations')">
            Kembali ke Changes & Incidents
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('changes')" module-label="modul Changes & Incidents" />

    <template v-else>
      <PageHeader :title="`Cancellation ${record.id}`" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=cancellations' }, { label: record.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="record.refundEligible ? 'Refund Eligible' : 'Tidak Eligible'" :tone="record.refundEligible ? 'success' : 'neutral'" />
            <NuxtLink v-if="bookingDetailHref" :to="bookingDetailHref">
              <Button size="sm" variant="outline">
                Lihat Booking
              </Button>
            </NuxtLink>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Alasan Pembatalan">
        <p class="text-sm text-foreground whitespace-pre-line">
          {{ record.reason }}
        </p>
      </SectionCard>

      <!-- Refunds are computed and tracked by Finance since Phase 5 (created when the booking is cancelled). -->
      <FinanceContextPanel :subject="{ type: 'booking', bookingType: record.bookingType, id: record.bookingId }" title="Refund & pembayaran" />
    </template>
  </div>
</template>
