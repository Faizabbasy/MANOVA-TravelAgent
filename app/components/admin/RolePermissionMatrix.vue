<script setup lang="ts">
import { computed } from 'vue'
import { MODULES } from '~/constants/modules'
import { PERMISSION_LEVELS, getModuleLevel } from '~/data/rbac'
import type { PermissionLevel } from '~/types/user'
import type { RoleDefinition } from '~/types/rbac'

const props = defineProps<{
  role: RoleDefinition
  canManage: boolean
}>()

const emit = defineEmits<{
  change: [payload: { moduleKey: string; level: PermissionLevel }]
  bulk: [level: PermissionLevel]
}>()

const PERMISSION_META: Record<PermissionLevel, { tone: string; description: string }> = {
  NONE: { tone: 'neutral', description: 'Tidak ada akses — menu modul ini tidak tampil' },
  VIEW: { tone: 'info', description: 'Hanya baca' },
  MANAGE: { tone: 'primary', description: 'Baca, tulis, dan hapus' },
  APPROVE: { tone: 'warning', description: 'Manage + aksi approval' },
  ADMIN: { tone: 'destructive', description: 'Akses penuh termasuk konfigurasi' }
}

const isLocked = computed(() => props.role.isSuperAdmin || !props.canManage)

const rows = computed(() => MODULES.map(module => ({
  ...module,
  level: getModuleLevel(props.role.id, module.key)
})))

const businessRows = computed(() => rows.value.filter(row => row.group === 'business'))
const systemRows = computed(() => rows.value.filter(row => row.group === 'system'))

const grantedCount = computed(() => rows.value.filter(row => row.level !== 'NONE').length)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">
        <span class="font-medium text-foreground">{{ grantedCount }}</span> dari {{ rows.length }} modul dapat diakses.
      </p>
      <div v-if="!isLocked" class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Set semua modul bisnis:</span>
        <Button v-for="level in (['NONE', 'VIEW', 'MANAGE'] as PermissionLevel[])" :key="level" size="sm" variant="outline" @click="emit('bulk', level)">
          {{ level }}
        </Button>
      </div>
    </div>

    <div v-if="role.isSuperAdmin" class="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-foreground">
      Permission <span class="font-medium">{{ role.label }}</span> sengaja dikunci. Role ini mem-bypass seluruh matriks
      dan selalu berakses penuh — ia adalah satu-satunya jalur pemulihan bila konfigurasi role lain salah,
      karena aplikasi ini tidak punya backend untuk memulihkan akses.
    </div>

    <div class="flex flex-wrap gap-3">
      <div v-for="level in PERMISSION_LEVELS" :key="level" class="flex items-center gap-1.5">
        <StatusBadge :label="level" :tone="PERMISSION_META[level].tone as never" />
        <span class="text-xs text-muted-foreground">{{ PERMISSION_META[level].description }}</span>
      </div>
    </div>

    <div v-for="section in [{ label: 'Modul Bisnis', items: businessRows }, { label: 'Modul Sistem', items: systemRows }]" :key="section.label" class="space-y-2">
      <p class="text-xs font-medium text-muted-foreground">
        {{ section.label }}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Modul</TableHead>
            <TableHead class="w-[44%]">
              Cakupan
            </TableHead>
            <TableHead class="w-[160px] text-right">
              Level Akses
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in section.items" :key="row.key">
            <TableCell>
              <div class="flex items-center gap-2">
                <component :is="row.icon" class="h-4 w-4 text-muted-foreground shrink-0" />
                <span class="text-sm font-medium text-foreground">{{ row.label }}</span>
              </div>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground">
              {{ row.description }}
            </TableCell>
            <TableCell class="text-right">
              <select
                :value="row.level"
                :disabled="isLocked"
                class="appearance-none px-2.5 py-1.5 text-xs font-medium rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                @change="emit('change', { moduleKey: row.key, level: ($event.target as HTMLSelectElement).value as PermissionLevel })"
              >
                <option v-for="level in PERMISSION_LEVELS" :key="level" :value="level">
                  {{ level }}
                </option>
              </select>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
