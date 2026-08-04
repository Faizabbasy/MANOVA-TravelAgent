<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { NAV_ITEMS, type NavItem } from '~/constants/navigation'
import { PERMISSION_LEVELS, RANK, getMenuGrant, getMenuLevel, getModuleLevel } from '~/data/rbac'
import { getModuleLabel } from '~/constants/modules'
import type { PermissionLevel } from '~/types/user'
import type { RoleDefinition } from '~/types/rbac'

const props = defineProps<{
  role: RoleDefinition
  canManage: boolean
}>()

const emit = defineEmits<{
  set: [payload: { menuKey: string; level: PermissionLevel }]
  clear: [menuKey: string]
}>()

const isLocked = computed(() => props.role.isSuperAdmin || !props.canManage)

interface MenuRow {
  item: NavItem
  /** Level yang berlaku sekarang (override bila ada, kalau tidak mewarisi modul). */
  effective: PermissionLevel
  /** Level yang akan berlaku bila override dihapus. */
  inherited: PermissionLevel
  hasOverride: boolean
  visible: boolean
}

function toRow (item: NavItem): MenuRow {
  const inherited = item.moduleKey ? getModuleLevel(props.role.id, item.moduleKey) : 'ADMIN'
  const effective = item.moduleKey ? getMenuLevel(props.role.id, item.key, item.moduleKey) : 'ADMIN'
  return {
    item,
    inherited,
    effective,
    hasOverride: Boolean(getMenuGrant(props.role.id, item.key)),
    visible: RANK[effective] >= RANK.VIEW
  }
}

const groups = computed(() => NAV_ITEMS.map(parent => ({
  parent: toRow(parent),
  children: (parent.children ?? []).map(toRow)
})))

const visibleCount = computed(() =>
  groups.value.reduce((total, group) => total + (group.children.length
    ? group.children.filter(child => child.visible).length
    : Number(group.parent.visible)), 0))

const overrideCount = computed(() =>
  groups.value.reduce((total, group) => total + Number(group.parent.hasOverride) + group.children.filter(child => child.hasOverride).length, 0))

/** Nilai kosong pada dropdown berarti "kembali mewarisi modul", bukan level `NONE`. */
function onLevelChange (menuKey: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (!value) { emit('clear', menuKey); return }
  emit('set', { menuKey, level: value as PermissionLevel })
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p class="text-sm text-foreground">
        <span class="font-medium">{{ visibleCount }}</span> menu terlihat ·
        <span class="font-medium">{{ overrideCount }}</span> override aktif
      </p>
      <p class="text-xs text-muted-foreground mt-1">
        Secara default setiap menu mewarisi level modulnya. Override di sini hanya berlaku untuk satu entri
        menu — berguna saat sebuah role perlu melihat sebagian besar modul tapi bukan satu halaman tertentu.
      </p>
    </div>

    <div v-if="role.isSuperAdmin" class="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-foreground">
      {{ role.label }} melihat seluruh menu dan mengabaikan override apa pun.
    </div>

    <div v-for="group in groups" :key="group.parent.item.key" class="rounded-lg border border-border overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <component :is="group.parent.item.icon" class="h-4 w-4 text-muted-foreground shrink-0" />
        <span class="text-sm font-medium text-foreground">{{ group.parent.item.label }}</span>
        <span v-if="group.parent.item.moduleKey" class="text-[11px] text-muted-foreground">
          modul {{ getModuleLabel(group.parent.item.moduleKey) }}
        </span>
        <StatusBadge v-if="!group.parent.visible" label="Tersembunyi" tone="neutral" class="ml-auto" />
      </div>

      <ul class="divide-y divide-border">
        <li
          v-for="row in (group.children.length ? group.children : [group.parent])"
          :key="row.item.key"
          class="flex items-center gap-3 px-4 py-2"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm text-foreground truncate">
              {{ row.item.label }}
            </p>
            <p class="text-[11px] text-muted-foreground font-mono truncate">
              {{ row.item.key }}
            </p>
          </div>

          <span v-if="!row.hasOverride" class="text-[11px] text-muted-foreground shrink-0">
            warisan: {{ row.inherited }}
          </span>
          <StatusBadge v-else label="Override" tone="warning" />

          <select
            :value="row.hasOverride ? row.effective : ''"
            :disabled="isLocked || !row.item.moduleKey"
            class="appearance-none px-2.5 py-1.5 text-xs font-medium rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            @change="onLevelChange(row.item.key, $event)"
          >
            <option value="">
              Ikut modul
            </option>
            <option v-for="level in PERMISSION_LEVELS" :key="level" :value="level">
              {{ level }}
            </option>
          </select>

          <button
            v-if="row.hasOverride && !isLocked"
            class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
            title="Kembalikan ke level modul"
            @click="emit('clear', row.item.key)"
          >
            <RotateCcw class="h-3.5 w-3.5" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
