<script setup lang="ts">
import { computed, ref } from 'vue'
import { UserPlus, ArrowRightLeft } from 'lucide-vue-next'
import { USERS } from '~/data'
import { getUsersByRole, getRoleLabel, resolveRoleId } from '~/data/rbac'
import type { RoleDefinition } from '~/types/rbac'

const props = defineProps<{
  role: RoleDefinition
  roles: RoleDefinition[]
  canManage: boolean
}>()

const emit = defineEmits<{
  assign: [payload: { userId: string; roleId: string }]
}>()

const selectedUserId = ref('')

const members = computed(() => getUsersByRole(props.role.id))

/** Kandidat = seluruh user yang belum berada di role ini. */
const candidates = computed(() => USERS.filter(user => resolveRoleId(user.role) !== props.role.id))

const otherRoles = computed(() => props.roles.filter(role => role.id !== props.role.id))

function assignSelected () {
  if (!selectedUserId.value) { return }
  emit('assign', { userId: selectedUserId.value, roleId: props.role.id })
  selectedUserId.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="canManage" class="flex flex-col sm:flex-row gap-2">
      <select v-model="selectedUserId" class="flex-1 appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
        <option value="">
          Pilih user untuk dipindahkan ke {{ role.label }}...
        </option>
        <option v-for="user in candidates" :key="user.id" :value="user.id">
          {{ user.name }} — {{ getRoleLabel(user.role) }}
        </option>
      </select>
      <Button :disabled="!selectedUserId" @click="assignSelected">
        <UserPlus class="h-4 w-4 mr-1.5" />
        Tetapkan
      </Button>
    </div>

    <Table v-if="members.length">
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Status</TableHead>
          <TableHead v-if="canManage" class="w-[220px] text-right">
            Pindahkan ke Role Lain
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="user in members" :key="user.id">
          <TableCell>
            <p class="text-sm font-medium text-foreground">
              {{ user.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ user.email }}
            </p>
          </TableCell>
          <TableCell>
            <StatusBadge
              :label="user.status === 'active' ? 'Aktif' : 'Suspended'"
              :tone="user.status === 'active' ? 'success' : 'destructive'"
            />
          </TableCell>
          <TableCell v-if="canManage" class="text-right">
            <div class="flex items-center justify-end gap-1.5">
              <ArrowRightLeft class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value=""
                class="appearance-none px-2.5 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                @change="emit('assign', { userId: user.id, roleId: ($event.target as HTMLSelectElement).value })"
              >
                <option value="" disabled>
                  Pilih role...
                </option>
                <option v-for="other in otherRoles" :key="other.id" :value="other.id">
                  {{ other.label }}
                </option>
              </select>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <EmptyState
      v-else
      title="Belum ada user pada role ini"
      :description="canManage ? 'Tetapkan user lewat dropdown di atas.' : 'Role ini belum dipakai user mana pun.'"
    />
  </div>
</template>
