<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BadgeTone } from '~/types/common'
import type { RoleDefinition } from '~/types/rbac'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'clone' | 'edit'
  roles: RoleDefinition[]
  /** Role sumber saat `clone`, atau role yang sedang diubah saat `edit`. */
  sourceRole?: RoleDefinition
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: { label: string; tone: BadgeTone; kind: RoleDefinition['kind']; description: string; canViewFullFinancials: boolean; cloneFromRoleId?: string }]
}>()

const TONES: { value: BadgeTone; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'purple', label: 'Purple' },
  { value: 'destructive', label: 'Destructive' },
  { value: 'neutral', label: 'Neutral' }
]

const label = ref('')
const tone = ref<BadgeTone>('primary')
const kind = ref<RoleDefinition['kind']>('internal')
const description = ref('')
const canViewFullFinancials = ref(false)
const cloneFromRoleId = ref('')

const title = computed(() => ({
  create: 'Buat Role Baru',
  clone: `Duplikat Role ${props.sourceRole?.label ?? ''}`,
  edit: `Ubah Role ${props.sourceRole?.label ?? ''}`
}[props.mode]))

const cloneableRoles = computed(() => props.roles.filter(role => !role.isSuperAdmin))

watch(() => props.open, (isOpen) => {
  if (!isOpen) { return }
  if (props.mode === 'edit' && props.sourceRole) {
    label.value = props.sourceRole.label
    tone.value = props.sourceRole.tone
    kind.value = props.sourceRole.kind
    description.value = props.sourceRole.description ?? ''
    canViewFullFinancials.value = props.sourceRole.canViewFullFinancials
    cloneFromRoleId.value = ''
    return
  }
  if (props.mode === 'clone' && props.sourceRole) {
    label.value = `${props.sourceRole.label} (Salinan)`
    tone.value = props.sourceRole.tone
    kind.value = props.sourceRole.kind
    description.value = ''
    canViewFullFinancials.value = props.sourceRole.canViewFullFinancials
    cloneFromRoleId.value = props.sourceRole.id
    return
  }
  label.value = ''
  tone.value = 'primary'
  kind.value = 'internal'
  description.value = ''
  canViewFullFinancials.value = false
  cloneFromRoleId.value = ''
})

const isValid = computed(() => label.value.trim().length > 0)

function submit () {
  if (!isValid.value) { return }
  emit('submit', {
    label: label.value.trim(),
    tone: tone.value,
    kind: kind.value,
    description: description.value.trim(),
    canViewFullFinancials: canViewFullFinancials.value,
    cloneFromRoleId: props.mode === 'edit' ? undefined : (cloneFromRoleId.value || undefined)
  })
}
</script>

<template>
  <Dialog :open="open" @update:open="value => emit('update:open', value)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          Role baru dimulai tanpa akses apa pun kecuali disalin dari role lain. Atur permission modul, menu,
          dan action flag setelah role dibuat.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <Label>Nama Role</Label>
          <Input v-model="label" placeholder="mis. Supervisor Operations" />
        </div>

        <div v-if="mode !== 'edit'" class="space-y-1.5">
          <Label>Mulai Dari</Label>
          <select v-model="cloneFromRoleId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="">
              Kosong — tanpa akses apa pun
            </option>
            <option v-for="role in cloneableRoles" :key="role.id" :value="role.id">
              Salin dari {{ role.label }}
            </option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label>Warna Badge</Label>
            <select v-model="tone" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option v-for="option in TONES" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label>Jenis</Label>
            <select v-model="kind" :disabled="mode === 'edit'" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:opacity-60">
              <option value="internal">
                Internal
              </option>
              <option value="portal">
                Portal Eksternal
              </option>
            </select>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label>Deskripsi</Label>
          <textarea
            v-model="description"
            rows="2"
            placeholder="Ringkas wewenang role ini."
            class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <label class="flex items-start gap-2 cursor-pointer">
          <Checkbox v-model="canViewFullFinancials" class="mt-0.5" />
          <span class="text-sm text-foreground">
            Boleh melihat breakdown finansial penuh
            <span class="block text-xs text-muted-foreground">Budget, actual cost, dan margin internal.</span>
          </span>
        </label>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Batal
        </Button>
        <Button :disabled="!isValid" @click="submit">
          {{ mode === 'edit' ? 'Simpan' : 'Buat Role' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
