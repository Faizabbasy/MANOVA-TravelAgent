<script setup lang="ts">
import { computed } from 'vue'
import { Building2, Package, Users, User, MapPin, CalendarDays } from 'lucide-vue-next'
import { getPartyById, getUserById } from '~/data'
import { SERVICE_TYPES, PROJECT_CHARACTERISTICS, findStatusOption } from '~/constants/status'
import { formatDateRange, formatTravelerCount } from '~/utils/format'
import type { Project } from '~/types/project'

const props = defineProps<{ project: Project }>()

const party = computed(() => getPartyById(props.project.partyId))
const owner = computed(() => getUserById(props.project.ownerId))
const characteristic = computed(() => findStatusOption(PROJECT_CHARACTERISTICS, props.project.characteristic))

const facts = computed(() => [
  { icon: Building2, label: 'Customer', value: party.value?.name ?? '—', sub: party.value?.city },
  { icon: Package, label: 'Karakteristik', value: characteristic.value.label },
  { icon: MapPin, label: 'Destinasi', value: props.project.destination },
  { icon: CalendarDays, label: 'Tanggal Perjalanan', value: formatDateRange(props.project.travelStartDate, props.project.travelEndDate) },
  { icon: Users, label: 'Jumlah', value: formatTravelerCount(props.project.travelerCount) },
  { icon: User, label: 'Penanggung Jawab', value: owner.value?.name ?? '—' }
])
</script>

<template>
  <SectionCard>
    <h3 class="text-base font-semibold text-foreground mb-4">
      {{ project.name }}
    </h3>

    <div class="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
      <div v-for="fact in facts" :key="fact.label">
        <div class="flex items-center gap-1.5 text-muted-foreground">
          <component :is="fact.icon" class="h-3.5 w-3.5" />
          <span class="text-xs">{{ fact.label }}</span>
        </div>
        <p class="text-sm font-medium text-foreground mt-0.5">
          {{ fact.value }}
        </p>
        <p v-if="fact.sub" class="text-xs text-muted-foreground">
          {{ fact.sub }}
        </p>
      </div>
    </div>

    <div class="mt-4 pt-4 border-t border-border">
      <p class="text-xs font-medium text-muted-foreground mb-2">
        Service Scope
      </p>
      <div class="flex flex-wrap gap-2">
        <StatusBadge
          v-for="type in SERVICE_TYPES.filter(item => project.serviceScope.includes(item.value))"
          :key="type.value"
          :label="type.label"
          :tone="type.tone"
        />
        <span v-if="!project.serviceScope.length" class="text-xs text-muted-foreground">Belum ditentukan.</span>
      </div>
    </div>
  </SectionCard>
</template>
