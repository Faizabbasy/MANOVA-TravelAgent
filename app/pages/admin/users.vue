<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, UserCheck, UserX } from 'lucide-vue-next'
import { USERS, suspendUser, reactivateUser } from '~/data'
import { findStatusOption } from '~/constants/status'
import type { User, RoleId, ModuleKey } from '~/types/user'

/** Modul yang dapat diakses role tertentu (ringkas) — dari ROLE_MODULE_ACCESS existing. */
import { ROLES, ROLE_MODULE_ACCESS } from '~/constants/roles'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Users — Administration' })

const { canView, canManage } = usePermissions()
const { currentUser, setCurrentUser } = useCurrentUser()
const { showToast } = useToast()

const canManageUsers = computed(() => canManage('administration'))

/** Users vs Access Review (Section 23 — Administration, Master Data dan Audit, roadmap Section 00–24 baru, D-080) — tab tambahan, aditif ke UI list+search+role-switch existing di bawah. */
type UsersPageTab = 'directory' | 'access-review'
const activeTab = ref<UsersPageTab>('directory')

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
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }
  return result
})

// Detail panel
const selectedUser = ref<User | null>(null)
const isDetailOpen = ref(false)

function openDetail (user: User) {
  selectedUser.value = user
  isDetailOpen.value = true
}

function closeDetail () {
  isDetailOpen.value = false
  selectedUser.value = null
}

function switchToUser (userId: string) {
  setCurrentUser(userId)
  closeDetail()
}

function getRoleLabel (roleId: RoleId): string {
  return findStatusOption(ROLES, roleId).label
}

function getRoleTone (roleId: RoleId) {
  return findStatusOption(ROLES, roleId).tone
}

const MODULE_LABELS: { key: ModuleKey; label: string }[] = [
  { key: 'crm', label: 'CRM' },
  { key: 'project', label: 'Project' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'finance', label: 'Finance' },
  { key: 'reports', label: 'Reports' },
  { key: 'administration', label: 'Administration' }
]

const PERMISSION_TONE: Record<string, string> = {
  NONE: 'neutral',
  VIEW: 'info',
  MANAGE: 'primary',
  APPROVE: 'warning',
  ADMIN: 'destructive'
}

function permTone (level: string) {
  return PERMISSION_TONE[level] ?? 'neutral'
}

/**
 * Suspend/reactivate (Section 23 — Administration, Master Data dan Audit, roadmap Section 00–24 baru,
 * D-080, Wajib "Access review and suspended user state"). Alasan WAJIB saat suspend — pola sama seluruh
 * transisi destruktif lain di codebase ini (mandatory-reason). Additive ke UI list+search+role-switch
 * existing di atas — TIDAK merestrukturisasi apa pun yang sudah ada.
 */
const isSuspendOpen = ref(false)
const suspendTarget = ref<User | null>(null)
const suspendReason = ref('')

function openSuspendDialog (user: User) {
  suspendTarget.value = user
  suspendReason.value = ''
  isSuspendOpen.value = true
}

function submitSuspend () {
  if (!suspendTarget.value || !suspendReason.value.trim()) {
    showToast('Gagal Suspend', 'Alasan suspend wajib diisi.', 'error')
    return
  }
  const result = suspendUser(suspendTarget.value.id, suspendReason.value.trim(), currentUser.value.id)
  if (!result) { showToast('Gagal Suspend', 'Terjadi kesalahan.', 'error'); return }
  showToast('User Disuspend', `${result.name} tidak lagi aktif. Tercatat di Audit Trail.`, 'success')
  isSuspendOpen.value = false
  if (selectedUser.value?.id === result.id) { selectedUser.value = result }
}

function doReactivate (user: User) {
  const result = reactivateUser(user.id, currentUser.value.id)
  if (!result) { return }
  showToast('User Diaktifkan Kembali', `${result.name} aktif kembali.`, 'success')
  if (selectedUser.value?.id === result.id) { selectedUser.value = result }
}

/**
 * Access Review (Wajib) — "listing users for periodic review". TIDAK ADA field "last login" nyata di
 * `User` (LOCKED sejak Foundation) — brief eksplisit melarang fabrikasi field tsb bila tidak ada, jadi
 * scope disederhanakan menjadi: view filterable seluruh user aktif dengan aksi suspend satu-klik (via
 * dialog alasan-wajib di atas), TANPA klaim "terakhir login".
 */
const accessReviewSearch = ref('')
const accessReviewUsers = computed(() => {
  let result = (USERS as User[]).filter(u => u.status === 'active')
  if (accessReviewSearch.value.trim()) {
    const q = accessReviewSearch.value.toLowerCase()
    result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }
  return result
})
const suspendedUsers = computed(() => (USERS as User[]).filter(u => u.status === 'suspended'))
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
      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="directory">
            Directory
          </TabsTrigger>
          <TabsTrigger value="access-review">
            Access Review
            <StatusBadge v-if="suspendedUsers.length > 0" :label="String(suspendedUsers.length)" tone="warning" class="ml-1.5" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory">
          <div class="space-y-6">
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
                <option value="all">
                  Semua Role
                </option>
                <option v-for="role in ROLES" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
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
                    <TableHead>Status Akun</TableHead>
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
                    <TableCell class="font-medium text-foreground">
                      {{ user.name }}
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ user.email }}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        :label="getRoleLabel(user.role)"
                        :tone="getRoleTone(user.role)"
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        :label="user.status === 'suspended' ? 'Suspended' : 'Aktif'"
                        :tone="user.status === 'suspended' ? 'destructive' : 'success'"
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
                      <div class="flex items-center justify-end gap-2">
                        <button
                          v-if="canManageUsers && user.status === 'active'"
                          class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          @click.stop="openSuspendDialog(user)"
                        >
                          Suspend
                        </button>
                        <button
                          v-else-if="canManageUsers && user.status === 'suspended'"
                          class="text-xs text-muted-foreground hover:text-success transition-colors"
                          @click.stop="doReactivate(user)"
                        >
                          Aktifkan
                        </button>
                        <button
                          class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          @click.stop="openDetail(user)"
                        >
                          Detail
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="access-review">
          <div class="space-y-6">
            <SectionCard
              title="Access Review — User Aktif"
              description="Tinjau berkala user dengan akses aktif. Tidak ada data 'terakhir login' (belum tersedia di data model) — gunakan Suspend bila akses perlu dicabut."
            >
              <template #actions>
                <div class="relative max-w-xs w-full">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input v-model="accessReviewSearch" placeholder="Cari user..." class="pl-9" />
                </div>
              </template>
              <EmptyState v-if="accessReviewUsers.length === 0" title="Tidak ada user aktif" description="Coba ubah kata kunci pencarian." />
              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead v-if="canManageUsers" class="text-right">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="user in accessReviewUsers" :key="user.id">
                    <TableCell class="font-medium text-foreground">
                      {{ user.name }}
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ user.email }}
                    </TableCell>
                    <TableCell><StatusBadge :label="getRoleLabel(user.role)" :tone="getRoleTone(user.role)" /></TableCell>
                    <TableCell v-if="canManageUsers" class="text-right">
                      <button class="text-xs text-muted-foreground hover:text-destructive transition-colors" @click="openSuspendDialog(user)">
                        Suspend
                      </button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </SectionCard>

            <SectionCard
              v-if="suspendedUsers.length > 0"
              title="User Disuspend"
              description="User dengan akses dinonaktifkan sementara, beserta alasan."
            >
              <ul class="divide-y divide-border">
                <li v-for="user in suspendedUsers" :key="user.id" class="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-medium text-foreground">
                      {{ user.name }} <span class="text-xs text-muted-foreground font-normal">({{ user.email }})</span>
                    </p>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ user.suspendedReason }} — {{ user.suspendedAt }}
                    </p>
                  </div>
                  <button v-if="canManageUsers" class="text-xs text-muted-foreground hover:text-success transition-colors shrink-0" @click="doReactivate(user)">
                    Aktifkan Kembali
                  </button>
                </li>
              </ul>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>

      <!-- Suspend Dialog -->
      <Dialog v-model:open="isSuspendOpen">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Suspend {{ suspendTarget?.name }}</DialogTitle>
            <DialogDescription>User tidak akan bisa dipilih sebagai user aktif demo sampai diaktifkan kembali. Alasan wajib diisi.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="suspend-reason">Alasan Suspend</Label>
            <Input id="suspend-reason" v-model="suspendReason" placeholder="mis. Cuti panjang, vendor tidak aktif, dst." />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isSuspendOpen = false">
              Batal
            </Button>
            <Button variant="destructive" :disabled="!suspendReason.trim()" @click="submitSuspend">
              <UserX class="h-4 w-4 mr-1.5" />Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <p class="text-sm font-medium mb-2">
                Akses Modul
              </p>
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
            <Button variant="outline" @click="closeDetail">
              Tutup
            </Button>
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
