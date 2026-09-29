<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Copy, Trash2, Search, Lock } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import type { RoleDefinition } from '~/types/rbac'

const props = defineProps<{
  roles: RoleDefinition[]
  selectedRoleId: string
  userCounts: Record<string, number>
  canManage: boolean
}>()

const emit = defineEmits<{
  select: [roleId: string]
  create: []
  clone: [roleId: string]
  remove: [roleId: string]
}>()

const query = ref('')

const filteredRoles = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) { return props.roles }
  return props.roles.filter(role => role.label.toLowerCase().includes(q) || role.id.includes(q))
})

const internalRoles = computed(() => filteredRoles.value.filter(role => role.kind === 'internal'))
const portalRoles = computed(() => filteredRoles.value.filter(role => role.kind === 'portal'))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="query" placeholder="Cari role..." class="pl-9" />
      </div>
      <Button v-if="canManage" size="sm" @click="emit('create')">
        <Plus class="h-4 w-4 mr-1" />
        Role
      </Button>
    </div>

    <div v-for="group in [{ label: 'Role Internal', items: internalRoles }, { label: 'Role Portal', items: portalRoles }]" :key="group.label">
      <p v-if="group.items.length" class="text-xs font-medium text-muted-foreground px-1 mb-1">
        {{ group.label }}
      </p>
      <ul class="space-y-1">
        <li v-for="role in group.items" :key="role.id">
          <div
            :class="cn(
              'group w-full rounded-lg border px-3 py-2 cursor-pointer transition-colors',
              role.id === selectedRoleId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            )"
            @click="emit('select', role.id)"
          >
            <div class="flex items-center gap-2">
              <StatusBadge :label="role.label" :tone="role.tone" />
              <Lock v-if="role.isSuperAdmin" class="h-3 w-3 text-muted-foreground shrink-0" />
              <span class="ml-auto text-xs text-muted-foreground shrink-0">
                {{ userCounts[role.id] ?? 0 }} user
              </span>
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              <span class="text-[11px] text-muted-foreground font-mono truncate">{{ role.id }}</span>
              <StatusBadge v-if="!role.isSystem" label="Custom" tone="info" />
              <span v-if="canManage" class="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Duplikat role ini"
                  @click.stop="emit('clone', role.id)"
                >
                  <Copy class="h-3.5 w-3.5" />
                </button>
                <button
                  v-if="!role.isSystem"
                  class="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Hapus role ini"
                  @click.stop="emit('remove', role.id)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <EmptyState v-if="!filteredRoles.length" title="Role tidak ditemukan" description="Coba kata kunci lain." />
  </div>
</template>
