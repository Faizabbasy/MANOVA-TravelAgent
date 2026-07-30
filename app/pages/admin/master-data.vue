<script setup lang="ts">
import { ref, computed } from 'vue'
import { Database, Layers, MapPin, Building2, FolderKanban } from 'lucide-vue-next'
import {
  MASTER_PROJECT_TYPES,
  MASTER_SERVICE_TYPES,
  MASTER_DESTINATIONS,
  MASTER_VENDOR_CATEGORIES,
} from '~/constants/master-data'
import type { MasterDataItem } from '~/constants/master-data'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Master Data — Administration' })

const { canView } = usePermissions()

const activeFilter = ref<'all' | 'active' | 'inactive'>('all')

function filteredItems(items: MasterDataItem[]) {
  if (activeFilter.value === 'active') return items.filter(i => i.isActive)
  if (activeFilter.value === 'inactive') return items.filter(i => !i.isActive)
  return items
}

const sections = [
  {
    id: 'project-types',
    label: 'Tipe / Karakteristik Project',
    icon: FolderKanban,
    description: 'Kategori karakteristik project (Normal, High-Change, Complex). Sesuai docs/route-and-role-matrix.md bagian 3.',
    items: MASTER_PROJECT_TYPES,
  },
  {
    id: 'service-types',
    label: 'Tipe Layanan Operasional',
    icon: Layers,
    description: 'Jenis layanan yang dikelola per project (Flight, Hotel, Transportation, MICE, Additional).',
    items: MASTER_SERVICE_TYPES,
  },
  {
    id: 'destinations',
    label: 'Destinasi',
    icon: MapPin,
    description: 'Daftar destinasi yang tersedia untuk project. Mencakup domestik dan internasional.',
    items: MASTER_DESTINATIONS,
  },
  {
    id: 'vendor-categories',
    label: 'Kategori Vendor',
    icon: Building2,
    description: 'Jenis layanan yang disediakan vendor — dipakai saat registrasi dan filter vendor.',
    items: MASTER_VENDOR_CATEGORIES,
  },
]

// Active section tab
const activeSectionId = ref('project-types')
const activeSection = computed(() => sections.find(s => s.id === activeSectionId.value) ?? sections[0])
const displayedItems = computed(() => filteredItems(activeSection.value.items))

function totalActive(items: MasterDataItem[]) {
  return items.filter(i => i.isActive).length
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Master Data"
      description="Daftar master data referensi lintas modul. Data bersifat read-only — perubahan production dilakukan oleh Super Admin."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Master Data' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <template v-else>
      <!-- Section summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          v-for="section in sections"
          :key="section.id"
          @click="activeSectionId = section.id"
          class="flex flex-col items-start gap-1 p-3 rounded-xl border transition-colors text-left"
          :class="section.id === activeSectionId
            ? 'border-primary/40 bg-primary/5'
            : 'border-border hover:bg-muted'"
        >
          <component :is="section.icon" class="h-5 w-5 text-muted-foreground mb-0.5" />
          <span class="text-sm font-medium text-foreground leading-tight">{{ section.label }}</span>
          <span class="text-xs text-muted-foreground">
            {{ totalActive(section.items) }} aktif / {{ section.items.length }} total
          </span>
        </button>
      </div>

      <!-- Active section detail -->
      <SectionCard :title="activeSection.label" :description="activeSection.description">
        <template #actions>
          <select
            v-model="activeFilter"
            class="appearance-none px-3 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <option value="all">Semua</option>
            <option value="active">Aktif saja</option>
            <option value="inactive">Non-aktif saja</option>
          </select>
        </template>

        <EmptyState
          v-if="displayedItems.length === 0"
          title="Tidak ada item"
          description="Tidak ada item yang cocok dengan filter saat ini."
        />

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead class="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in displayedItems" :key="item.id">
              <TableCell class="font-mono text-xs text-muted-foreground">{{ item.id }}</TableCell>
              <TableCell class="font-medium text-foreground">{{ item.label }}</TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ item.description ?? '—' }}</TableCell>
              <TableCell class="text-center">
                <StatusBadge
                  :label="item.isActive ? 'Aktif' : 'Non-aktif'"
                  :tone="item.isActive ? 'success' : 'neutral'"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
