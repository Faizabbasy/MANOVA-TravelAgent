<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import { PARTIES, getContactsByParty, getOpportunitiesByParty, getProjectsByParty } from '~/data'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Clients' })

const { canView } = usePermissions()

const searchQuery = ref('')

const clients = computed(() => PARTIES.filter(party => party.lifecycleStatus === 'client'))

const rows = computed(() => {
  let result = clients.value.map(party => ({
    party,
    primaryContact: getContactsByParty(party.id)[0],
    projectCount: getProjectsByParty(party.id).length,
    opportunityCount: getOpportunitiesByParty(party.id).length
  }))

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.party.name.toLowerCase().includes(q))
  }

  return [...result].sort((a, b) => a.party.name.localeCompare(b.party.name))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Clients"
      description="Daftar Party dengan lifecycle status Client. Status ini hanya berubah otomatis saat Opportunity milik party menjadi Won — tidak ada aksi 'convert' manual di sini."
      :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Clients' }]"
    />

    <RoleAccessState v-if="!canView('crm')" module-label="modul CRM" />

    <template v-else>
      <div class="relative max-w-sm w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Cari nama client..." class="pl-9" />
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Party</TableHead>
              <TableHead>Jumlah Project</TableHead>
              <TableHead>Jumlah Opportunity</TableHead>
              <TableHead>Contact Utama</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.party.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/crm/parties/${row.party.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ row.party.name }}
              </TableCell>
              <TableCell>{{ row.projectCount }}</TableCell>
              <TableCell>{{ row.opportunityCount }}</TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.primaryContact?.name ?? '—' }}
              </TableCell>
              <TableCell><StatusBadge label="Client" tone="success" /></TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="5">
              {{ searchQuery ? 'Tidak ada client yang cocok dengan pencarian.' : 'Belum ada client.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
