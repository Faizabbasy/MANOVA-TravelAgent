<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcw, Pencil } from 'lucide-vue-next'
import { BUSINESS_MODULES } from '~/constants/modules'
import {
  ROLE_DEFINITIONS,
  countUsersByRole,
  getSortedRoles,
  createRole,
  updateRole,
  deleteRole,
  assignUserRole,
  setRoleModuleLevel,
  setRoleMenuGrant,
  clearRoleMenuGrant,
  setRoleCapability,
  resetRbacToDefaults,
  type RbacMutationResult
} from '~/data/rbac'
import type { PermissionLevel } from '~/types/user'
import type { RoleDefinition } from '~/types/rbac'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Roles and Permissions — Administration' })

const { canView, canManage, can, roleId: actorRoleId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const canManageRoles = computed(() => canManage('administration') && can('admin.manage-roles'))

const roles = computed(() => getSortedRoles())
const selectedRoleId = ref<string>('super-admin')
const selectedRole = computed<RoleDefinition | undefined>(() =>
  roles.value.find(role => role.id === selectedRoleId.value) ?? roles.value[0])

const userCounts = computed(() =>
  Object.fromEntries(ROLE_DEFINITIONS.map(role => [role.id, countUsersByRole(role.id)])))

type RoleTab = 'modules' | 'menus' | 'capabilities' | 'users' | 'preview'
const activeTab = ref<RoleTab>('modules')

/** Setiap mutator mengembalikan `{ success, reason }` — satu tempat untuk menampilkannya sebagai toast. */
function report (result: RbacMutationResult, successMessage: string) {
  if (result.success) {
    showToast('Berhasil', successMessage, 'success')
  } else {
    showToast('Ditolak', result.reason ?? 'Perubahan tidak dapat diterapkan.', 'error')
  }
  return result
}

/* ---------- Dialog buat / duplikat / ubah ---------- */
const isFormOpen = ref(false)
const formMode = ref<'create' | 'clone' | 'edit'>('create')
const formSourceRole = ref<RoleDefinition | undefined>()

function openCreate () {
  formMode.value = 'create'
  formSourceRole.value = undefined
  isFormOpen.value = true
}

function openClone (roleId: string) {
  formMode.value = 'clone'
  formSourceRole.value = roles.value.find(role => role.id === roleId)
  isFormOpen.value = true
}

function openEdit () {
  if (!selectedRole.value) { return }
  formMode.value = 'edit'
  formSourceRole.value = selectedRole.value
  isFormOpen.value = true
}

function submitForm (payload: { label: string; tone: RoleDefinition['tone']; kind: RoleDefinition['kind']; description: string; canViewFullFinancials: boolean; cloneFromRoleId?: string }) {
  if (formMode.value === 'edit' && formSourceRole.value) {
    const result = report(
      updateRole(formSourceRole.value.id, {
        label: payload.label,
        tone: payload.tone,
        description: payload.description,
        canViewFullFinancials: payload.canViewFullFinancials
      }, currentUser.value.id),
      `Role "${payload.label}" diperbarui.`
    )
    if (result.success) { isFormOpen.value = false }
    return
  }

  const result = report(
    createRole({
      label: payload.label,
      tone: payload.tone,
      kind: payload.kind,
      description: payload.description,
      cloneFromRoleId: payload.cloneFromRoleId
    }, currentUser.value.id),
    `Role "${payload.label}" dibuat.`
  )

  if (!result.success || !result.roleId) { return }

  if (payload.canViewFullFinancials) {
    updateRole(result.roleId, { canViewFullFinancials: true }, currentUser.value.id)
  }
  selectedRoleId.value = result.roleId
  activeTab.value = 'modules'
  isFormOpen.value = false
}

/* ---------- Hapus ---------- */
const pendingDeleteRole = ref<RoleDefinition | undefined>()

function confirmDelete () {
  if (!pendingDeleteRole.value) { return }
  const label = pendingDeleteRole.value.label
  const result = report(deleteRole(pendingDeleteRole.value.id, currentUser.value.id), `Role "${label}" dihapus.`)
  if (result.success && selectedRoleId.value === pendingDeleteRole.value.id) {
    selectedRoleId.value = roles.value[0]?.id ?? 'super-admin'
  }
  pendingDeleteRole.value = undefined
}

/* ---------- Mutasi permission ---------- */
function onModuleChange (payload: { moduleKey: string; level: PermissionLevel }) {
  if (!selectedRole.value) { return }
  report(
    setRoleModuleLevel(selectedRole.value.id, payload.moduleKey, payload.level, actorRoleId.value, currentUser.value.id),
    `Akses modul diubah menjadi ${payload.level}.`
  )
}

function onModuleBulk (level: PermissionLevel) {
  if (!selectedRole.value) { return }
  for (const module of BUSINESS_MODULES) {
    setRoleModuleLevel(selectedRole.value.id, module.key, level, actorRoleId.value, currentUser.value.id)
  }
  showToast('Berhasil', `Seluruh modul bisnis diset ke ${level}.`, 'success')
}

function onMenuSet (payload: { menuKey: string; level: PermissionLevel }) {
  if (!selectedRole.value) { return }
  report(
    setRoleMenuGrant(selectedRole.value.id, payload.menuKey, payload.level, currentUser.value.id),
    `Menu "${payload.menuKey}" di-override menjadi ${payload.level}.`
  )
}

function onMenuClear (menuKey: string) {
  if (!selectedRole.value) { return }
  report(clearRoleMenuGrant(selectedRole.value.id, menuKey, currentUser.value.id), `Menu "${menuKey}" kembali mengikuti modul.`)
}

function onCapabilityToggle (payload: { capabilityKey: string; granted: boolean }) {
  if (!selectedRole.value) { return }
  report(
    setRoleCapability(selectedRole.value.id, payload.capabilityKey, payload.granted, currentUser.value.id),
    `Action flag ${payload.granted ? 'diaktifkan' : 'dinonaktifkan'}.`
  )
}

function onAssignUser (payload: { userId: string; roleId: string }) {
  if (!payload.roleId) { return }
  report(assignUserRole(payload.userId, payload.roleId, currentUser.value.id), 'Role user diperbarui.')
}

/* ---------- Reset darurat ---------- */
const isResetOpen = ref(false)

function confirmReset () {
  resetRbacToDefaults(currentUser.value.id)
  selectedRoleId.value = 'super-admin'
  isResetOpen.value = false
  showToast('Berhasil', 'Konfigurasi role & permission dikembalikan ke default.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Roles and Permissions"
      description="Buat role, atur akses per modul dan per menu, serta tetapkan action flag — seluruhnya langsung berlaku."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Roles and Permissions' }]"
    >
      <template #actions>
        <Button v-if="canManageRoles" variant="outline" size="sm" @click="isResetOpen = true">
          <RotateCcw class="h-4 w-4 mr-1.5" />
          Reset ke Default
        </Button>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <template v-else>
      <div v-if="!canManageRoles" class="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Anda dapat melihat konfigurasi role, tetapi tidak mengubahnya. Dibutuhkan level MANAGE pada modul
        Administration beserta action flag "Kelola role & permission".
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <SectionCard class="xl:col-span-4" title="Daftar Role">
          <RoleListPanel
            :roles="roles"
            :selected-role-id="selectedRole?.id ?? ''"
            :user-counts="userCounts"
            :can-manage="canManageRoles"
            @select="value => selectedRoleId = value"
            @create="openCreate"
            @clone="openClone"
            @remove="value => pendingDeleteRole = roles.find(role => role.id === value)"
          />
        </SectionCard>

        <SectionCard v-if="selectedRole" class="xl:col-span-8">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-foreground">
                  {{ selectedRole.label }}
                </h2>
                <StatusBadge :label="selectedRole.isSystem ? 'Bawaan Sistem' : 'Custom'" :tone="selectedRole.isSystem ? 'neutral' : 'info'" />
              </div>
              <p v-if="selectedRole.description" class="text-sm text-muted-foreground mt-1">
                {{ selectedRole.description }}
              </p>
            </div>
            <Button v-if="canManageRoles && !selectedRole.isSuperAdmin" variant="outline" size="sm" @click="openEdit">
              <Pencil class="h-4 w-4 mr-1.5" />
              Ubah Detail
            </Button>
          </div>

          <Tabs v-model="activeTab">
            <TabsList>
              <TabsTrigger value="modules">
                Modules
              </TabsTrigger>
              <TabsTrigger value="menus">
                Menus
              </TabsTrigger>
              <TabsTrigger value="capabilities">
                Action Flags
              </TabsTrigger>
              <TabsTrigger value="users">
                Users
              </TabsTrigger>
              <TabsTrigger value="preview">
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="modules" class="pt-4">
              <RolePermissionMatrix
                :role="selectedRole"
                :can-manage="canManageRoles"
                @change="onModuleChange"
                @bulk="onModuleBulk"
              />
            </TabsContent>

            <TabsContent value="menus" class="pt-4">
              <RoleMenuTree
                :role="selectedRole"
                :can-manage="canManageRoles"
                @set="onMenuSet"
                @clear="onMenuClear"
              />
            </TabsContent>

            <TabsContent value="capabilities" class="pt-4">
              <RoleCapabilityList
                :role="selectedRole"
                :can-manage="canManageRoles"
                @toggle="onCapabilityToggle"
              />
            </TabsContent>

            <TabsContent value="users" class="pt-4">
              <RoleUserAssignment
                :role="selectedRole"
                :roles="roles"
                :can-manage="canManageRoles"
                @assign="onAssignUser"
              />
            </TabsContent>

            <TabsContent value="preview" class="pt-4">
              <RoleAccessPreview :role="selectedRole" />
            </TabsContent>
          </Tabs>
        </SectionCard>
      </div>

      <RoleFormDialog
        v-model:open="isFormOpen"
        :mode="formMode"
        :roles="roles"
        :source-role="formSourceRole"
        @submit="submitForm"
      />

      <Dialog :open="Boolean(pendingDeleteRole)" @update:open="value => { if (!value) pendingDeleteRole = undefined }">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus role "{{ pendingDeleteRole?.label }}"?</DialogTitle>
            <DialogDescription>
              Seluruh grant modul, override menu, dan action flag milik role ini ikut terhapus. Role bawaan
              sistem dan role yang masih dipakai user tidak dapat dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="pendingDeleteRole = undefined">
              Batal
            </Button>
            <Button variant="destructive" @click="confirmDelete">
              Hapus Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog v-model:open="isResetOpen">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset role & permission ke default?</DialogTitle>
            <DialogDescription>
              Seluruh role custom dihapus dan grant 13 role bawaan dikembalikan ke kondisi seed. Penugasan
              user ke role TIDAK ikut direset. Gunakan ini bila sebuah role terlanjur salah dikonfigurasi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="isResetOpen = false">
              Batal
            </Button>
            <Button variant="destructive" @click="confirmReset">
              Reset Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
