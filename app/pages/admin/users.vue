<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, UserCheck } from 'lucide-vue-next'
import { USERS } from '~/data'
import { ROLES } from '~/constants/roles'
import { findStatusOption } from '~/constants/status'
import type { User } from '~/types/user'
import type { RoleId } from '~/types/user'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Users — Administration' })

const { canView } = usePermissions()
const { currentUser, setCurrentUser } = useCurrentUser()

const searchQuery = ref('')
const roleFilter = ref<'all' | RoleId>('all')

const filteredUsers = computed(() => {
  let result = USERS as User[]
  if (roleFilter.value !== 'all') {
    result = result.filter(u => u.role === roleFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }
  return result
})

// Detail panel
const selectedUser = ref<User | null>(null)
const isDetailOpen = ref(false)

function openDetail(user: User) {
  selectedUser.value = user
  isDetailOpen.value = true
}

function closeDetail() {
  isDetailOpen.value = false
  selectedUser.value = null
}

function switchToUser(userId: string) {
  setCurrentUser(userId)
  closeDetail()
}

function getRoleLabel(roleId: RoleId): string {
  return findStatusOption(ROLES, roleId).label
}

function getRoleTone(roleId: RoleId) {
  return findStatusOption(ROLES, roleId).tone
}

/** Modul yang dapat diakses role tertentu (ringkas) — dari ROLE_MODULE_ACCESS existing. */
import { ROLE_MODULE_ACCESS } from '~/constants/roles'
import type { ModuleKey } from '~/types/user'

const MODULE_LABELS: { key: ModuleKey; label: string }[] = [
  { key: 'crm', label: 'CRM' },
  { key: 'project', label: 'Project' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'finance', label: 'Finance' },
  { key: 'reports', label: 'Reports' },
  { key: 'administration', label: 'Administration' },
]

const PERMISSION_TONE: Record<string, string> = {
  NONE: 'neutral',
  VIEW: 'info',
  MANAGE: 'primary',
  APPROVE: 'warning',
  ADMIN: 'destructive',
}

function permTone(level: string) {
  return PERMISSION_TONE[level] ?? 'neutral'
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Users"
      description="Daftar user demo dan role masing-masing. Klik user untuk melihat detail akses."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Users' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <template v-else>
      <!-- Filters -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama atau email..." class="pl-9" />
        </div>
        <select
          v-model="roleFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">Semua Role</option>
          <option v-for="role in ROLES" :key="role.value" :value="role.value">{{ role.label }}</option>
        </select>
      </div>

      <!-- User table -->
      <SectionCard>
        <EmptyState v-if="filteredUsers.length === 0" title="Tidak ada user ditemukan" description="Coba ubah filter atau kata kunci pencarian." />
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status Demo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="user in filteredUsers"
              :key="user.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="openDetail(user)"
            >
              <TableCell class="font-medium text-foreground">{{ user.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ user.email }}</TableCell>
              <TableCell>
                <StatusBadge
                  :label="getRoleLabel(user.role)"
                  :tone="getRoleTone(user.role)"
                />
              </TableCell>
              <TableCell>
                <StatusBadge
                  v-if="user.id === currentUser.id"
                  label="Login Aktif"
                  tone="success"
                />
                <span v-else class="text-xs text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="text-right">
                <button
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  @click.stop="openDetail(user)"
                >
                  Detail
                </button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SectionCard>

      <!-- Detail Dialog -->
      <Dialog :open="isDetailOpen" @update:open="v => { if (!v) closeDetail() }">
        <DialogContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>{{ selectedUser?.name }}</DialogTitle>
            <DialogDescription>{{ selectedUser?.email }} · ID: {{ selectedUser?.id }}</DialogDescription>
          </DialogHeader>

          <div v-if="selectedUser" class="space-y-4">
            <!-- Role badge -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">Role:</span>
              <StatusBadge
                :label="getRoleLabel(selectedUser.role)"
                :tone="getRoleTone(selectedUser.role)"
              />
              <StatusBadge
                v-if="selectedUser.id === currentUser.id"
                label="Login Aktif"
                tone="success"
              />
            </div>

            <!-- Access matrix for this role -->
            <div>
              <p class="text-sm font-medium mb-2">Akses Modul</p>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="mod in MODULE_LABELS"
                  :key="mod.key"
                  class="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm"
                >
                  <span class="text-muted-foreground">{{ mod.label }}</span>
                  <StatusBadge
                    :label="ROLE_MODULE_ACCESS[selectedUser.role][mod.key]"
                    :tone="permTone(ROLE_MODULE_ACCESS[selectedUser.role][mod.key])"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter class="gap-2">
            <Button variant="outline" @click="closeDetail">Tutup</Button>
            <Button
              v-if="selectedUser && selectedUser.id !== currentUser.id"
              variant="default"
              @click="switchToUser(selectedUser!.id)"
            >
              <UserCheck class="h-4 w-4 mr-1.5" />
              Beralih ke User Ini
            </Button>
            <span
              v-else
              class="text-xs text-muted-foreground self-center"
            >
              Ini adalah user aktif saat ini
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
