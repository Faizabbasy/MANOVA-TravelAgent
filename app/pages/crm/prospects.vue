<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus } from 'lucide-vue-next'
import { PARTIES, getContactsByParty, getOpportunitiesByParty, createParty } from '~/data'
import { formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Prospects' })

const { currentRole } = useCurrentUser()
const { canView } = usePermissions()

/**
 * Aksi tulis (buat prospect) sengaja dibatasi Sales/Super Admin saja, lebih sempit dari `canManage('crm')`
 * generik — akses modul CRM di `ROLE_MODULE_ACCESS` memberi Management level `APPROVE` (dipakai untuk
 * approve Opportunity Won, Section 09), yang secara rank melebihi `MANAGE` dan akan salah mengizinkan
 * Management membuat/mengubah Prospect bila dipakai apa adanya. Sesuai `docs/route-and-role-matrix.md`
 * bagian 1.2 ("Sales: MANAGE, Management: VIEW, Viewer: VIEW, lainnya: NONE"), bukan mekanisme role-check
 * baru — pengecualian sempit yang didokumentasikan, sama seperti granularity sub-domain Operations.
 * `account-executive` ditambahkan Prompt 19 (Change Request) — AE "mengelola relationship dengan
 * prospect/client" (literal responsibility split), Sales tetap dipertahankan.
 */
const canManageParty = computed(() => ['sales', 'account-executive', 'super-admin'].includes(currentRole.value))

const searchQuery = ref('')
const sortBy = ref<'name' | 'created'>('name')

const prospects = computed(() => PARTIES.filter(party => party.lifecycleStatus === 'prospect'))

const rows = computed(() => {
  let result = prospects.value.map(party => ({
    party,
    primaryContact: getContactsByParty(party.id)[0],
    activeOpportunityCount: getOpportunitiesByParty(party.id).filter(opp => !['won', 'lost'].includes(opp.stage)).length,
  }))

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.party.name.toLowerCase().includes(q))
  }

  result = [...result].sort((a, b) => sortBy.value === 'name'
    ? a.party.name.localeCompare(b.party.name)
    : b.party.createdAt.localeCompare(a.party.createdAt))

  return result
})

const isCreateOpen = ref(false)
const newName = ref('')
const newIndustry = ref('')

function submitCreate() {
  if (!newName.value.trim()) return
  const party = createParty({ name: newName.value.trim(), industry: newIndustry.value.trim() || undefined })
  newName.value = ''
  newIndustry.value = ''
  isCreateOpen.value = false
  navigateTo(`/crm/parties/${party.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Prospects"
      description="Daftar Party dengan lifecycle status Prospect."
      :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Prospects' }]"
    >
      <template v-if="canManageParty" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />Tambah Prospect</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Prospect Baru</DialogTitle>
              <DialogDescription>Party baru akan dibuat dengan lifecycle status Prospect.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="prospect-name">Nama Party</Label>
                <Input id="prospect-name" v-model="newName" placeholder="mis. PT Nama Perusahaan" />
              </div>
              <div class="space-y-1.5">
                <Label for="prospect-industry">Industri (opsional)</Label>
                <Input id="prospect-industry" v-model="newIndustry" placeholder="mis. Manufaktur, Retail, dll." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">Batal</Button>
              <Button :disabled="!newName.trim()" @click="submitCreate">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('crm')" module-label="modul CRM" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama prospect..." class="pl-9" />
        </div>
        <select
          v-model="sortBy"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="name">Urutkan: Nama (A-Z)</option>
          <option value="created">Urutkan: Terbaru Dibuat</option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Party</TableHead>
              <TableHead>Contact Utama</TableHead>
              <TableHead>Opportunity Aktif</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.party.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/crm/parties/${row.party.id}`)">
              <TableCell class="font-medium text-foreground">{{ row.party.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.primaryContact?.name ?? '—' }}</TableCell>
              <TableCell>{{ row.activeOpportunityCount }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(row.party.createdAt) }}</TableCell>
              <TableCell><StatusBadge label="Prospect" tone="info" /></TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="5">
              {{ searchQuery ? 'Tidak ada prospect yang cocok dengan pencarian.' : 'Belum ada prospect.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
