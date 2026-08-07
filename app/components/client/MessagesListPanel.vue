<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, MessageSquare } from 'lucide-vue-next'
import { getProjectsByParty, getClientProjectMessages, getUnreadProjectMessageCount } from '~/data'
import { formatDate } from '~/utils/format'

/**
 * Tab "Messages" — Menu Client Portal > Documents & Support (Penyederhanaan 7-Role/Menu). Dulu
 * `/client/messages`, kini tab dalam satu menu bersama Documents/Support — logika tidak diubah. Konsolidasi
 * PER PROJECT (route `/client/messages/[projectId]`) — "Quotation conversation"/"Itinerary conversation"/
 * "Change request conversation" DIWUJUDKAN sebagai link ke comment thread yang SUDAH ADA masing-masing
 * (`QuotationComment`/`ItineraryComment`/`ChangeRequestComment`), BUKAN diimplementasikan ulang sebagai
 * channel `Message` kedua untuk entitas yang sama.
 */
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()

const search = ref('')
const unreadOnly = ref(false)

const rows = computed(() => {
  const projects = clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []
  return projects.map((project) => {
    const messages = getClientProjectMessages(project.id)
    return {
      project,
      lastMessage: messages[messages.length - 1],
      unreadCount: getUnreadProjectMessageCount(project.id, currentUser.value.id)
    }
  })
})

const filteredRows = computed(() => {
  let result = rows.value
  if (unreadOnly.value) { result = result.filter(row => row.unreadCount > 0) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(row => row.project.name.toLowerCase().includes(q) || (row.lastMessage?.body ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => (b.lastMessage?.sentAt ?? '').localeCompare(a.lastMessage?.sentAt ?? ''))
})
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari project atau isi pesan..." class="pl-9" />
          </div>
          <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer shrink-0">
            <Checkbox v-model="unreadOnly" />Hanya belum dibaca
          </label>
        </div>

        <ul v-if="filteredRows.length" class="divide-y divide-border">
          <li v-for="row in filteredRows" :key="row.project.id">
            <NuxtLink :to="`/client/messages/${row.project.id}`" class="py-3 flex items-center justify-between gap-3 group block">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                    {{ row.project.name }}
                  </p>
                  <span v-if="row.unreadCount > 0" class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground shrink-0">{{ row.unreadCount }}</span>
                </div>
                <p class="text-sm text-muted-foreground truncate">
                  {{ row.lastMessage?.body ?? 'Belum ada pesan' }}
                </p>
              </div>
              <span v-if="row.lastMessage" class="text-xs text-muted-foreground shrink-0">{{ formatDate(row.lastMessage.sentAt) }}</span>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="MessageSquare" title="Tidak ada percakapan" description="Percakapan dengan tim kami akan tampil di sini." />
      </SectionCard>
    </template>
  </div>
</template>
