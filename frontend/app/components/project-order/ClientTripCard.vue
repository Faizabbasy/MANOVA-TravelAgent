<script setup lang="ts">
import { Megaphone, Send } from 'lucide-vue-next'
import { createSaveGate } from '~/lib/save-gate'
import { ITINERARY_VERSION_STATUSES, findStatusOption } from '~/constants/status'
import { formatDateTime } from '~/utils/format'
import type { ItineraryVersionDto, TripAnnouncementDto } from '~/types/api'

/**
 * S12c-4: what the client sees of this project's itinerary, from the server. "Terbitkan versi" freezes the items
 * marked visible to the client (never vendor or cost) as the next version for the client to approve or revise; the
 * newest version supersedes the older ones. Announcements go to the client's users; some ask for a confirmation.
 */
const props = defineProps<{ projectId: string }>()

const api = useApi()
const session = useServerSession()
const { can } = usePermissions()
const { showToast } = useToast()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
const canPublish = computed(() => can('project-order.manage-operations'))

const versions = ref<ItineraryVersionDto[]>([])
const announcements = ref<TripAnnouncementDto[]>([])
const loadError = ref('')
async function load () {
  try {
    await session.ensure()
    const [v, a] = await Promise.all([api.core.listItineraryVersions(props.projectId), api.core.listAnnouncements(props.projectId)])
    versions.value = v.data
    announcements.value = a.data
    loadError.value = ''
  } catch {
    loadError.value = 'Versi itinerary & pengumuman belum bisa dimuat.'
  }
}
onMounted(load)
watch(() => props.projectId, load)

const latest = computed(() => versions.value[0])

const isVersionOpen = ref(false)
const versionNote = ref('')
async function publishVersion () {
  const note = versionNote.value.trim()
  const saved = await gate.run('Versi Gagal Diterbitkan', () => api.core.publishItineraryVersion(props.projectId, note || undefined))
  if (!saved) { return }
  isVersionOpen.value = false
  versionNote.value = ''
  showToast('Versi Diterbitkan', `Itinerary v${saved.data.versionNumber} dikirim ke client untuk disetujui.`, 'success')
  await load()
}

const isAnnouncementOpen = ref(false)
const form = reactive({ title: '', message: '', requiresConfirmation: false })
async function publishAnnouncement () {
  if (!form.title.trim() || !form.message.trim()) { return }
  const input = { title: form.title.trim(), message: form.message.trim(), requiresConfirmation: form.requiresConfirmation }
  const saved = await gate.run('Pengumuman Gagal Dikirim', () => api.core.publishAnnouncement(props.projectId, input))
  if (!saved) { return }
  isAnnouncementOpen.value = false
  Object.assign(form, { title: '', message: '', requiresConfirmation: false })
  showToast('Pengumuman Dikirim', 'Client diberi tahu di portal.', 'success')
  await load()
}
</script>

<template>
  <div class="space-y-4">
    <SectionCard compact title="Versi Itinerary untuk Client" description="Item yang ditandai terlihat client dibekukan menjadi versi yang disetujui client.">
      <template v-if="canPublish" #actions>
        <Button size="sm" variant="outline" @click="isVersionOpen = true">
          <Send class="h-4 w-4 mr-1" />Terbitkan Versi
        </Button>
      </template>
      <p v-if="loadError" class="text-xs text-destructive">
        {{ loadError }}
      </p>
      <template v-else-if="latest">
        <p v-if="latest.status === 'revision-requested'" class="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          <span class="font-medium">Client minta revisi v{{ latest.versionNumber }}:</span> {{ latest.revisionComment }}
        </p>
        <ul class="divide-y divide-border">
          <li v-for="v in versions" :key="v.id" class="py-2 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground">
                v{{ v.versionNumber }} · {{ v.items.length }} item
              </p>
              <p class="text-xs text-muted-foreground">
                {{ v.createdByName }} · {{ formatDateTime(v.createdAt) }}<template v-if="v.note">
                  · {{ v.note }}
                </template>
                <template v-if="v.decidedAt">
                  · diputuskan {{ formatDateTime(v.decidedAt) }}
                </template>
              </p>
            </div>
            <StatusBadge :label="findStatusOption(ITINERARY_VERSION_STATUSES, v.status).label" :tone="findStatusOption(ITINERARY_VERSION_STATUSES, v.status).tone" />
          </li>
        </ul>
      </template>
      <p v-else class="text-sm text-muted-foreground">
        Belum ada versi yang dikirim ke client.
      </p>
    </SectionCard>

    <SectionCard compact title="Pengumuman Perjalanan" description="Pesan satu arah ke client; sebagian meminta konfirmasi sudah dibaca.">
      <template v-if="canPublish" #actions>
        <Button size="sm" variant="outline" @click="isAnnouncementOpen = true">
          <Megaphone class="h-4 w-4 mr-1" />Buat Pengumuman
        </Button>
      </template>
      <ul v-if="announcements.length" class="divide-y divide-border">
        <li v-for="a in announcements" :key="a.id" class="py-2">
          <div class="flex items-start justify-between gap-3">
            <p class="text-sm font-medium text-foreground">
              {{ a.title }}
            </p>
            <StatusBadge v-if="a.requiresConfirmation" :label="`${a.confirmations.length} konfirmasi`" :tone="a.confirmations.length ? 'success' : 'warning'" />
          </div>
          <p class="text-sm text-foreground whitespace-pre-line">
            {{ a.message }}
          </p>
          <p class="text-xs text-muted-foreground mt-0.5">
            {{ a.publishedByName }} · {{ formatDateTime(a.publishedAt) }}<template v-if="a.confirmations.length">
              · dikonfirmasi {{ a.confirmations.map(c => c.name).join(', ') }}
            </template>
          </p>
        </li>
      </ul>
      <p v-else class="text-sm text-muted-foreground">
        Belum ada pengumuman.
      </p>
    </SectionCard>

    <EntityComments entity-type="itinerary" :entity-id="projectId" title="Komentar Itinerary dengan Client" description="Terlihat oleh client di halaman itinerary portal." />

    <ResponsiveFormSheet v-model:open="isVersionOpen" title="Terbitkan Versi Itinerary" description="Item yang terlihat client dibekukan dan dikirim untuk disetujui; versi sebelumnya digantikan." content-class="max-w-md">
      <div class="space-y-1.5 py-2">
        <Label for="itv-note">Catatan untuk client (opsional)</Label>
        <textarea id="itv-note" v-model="versionNote" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Hari 2 ditambah free time" />
      </div>
      <template #footer>
        <Button variant="outline" @click="isVersionOpen = false">
          Batal
        </Button>
        <Button :disabled="gate.saving.value" @click="publishVersion">
          Terbitkan
        </Button>
      </template>
    </ResponsiveFormSheet>

    <ResponsiveFormSheet v-model:open="isAnnouncementOpen" title="Buat Pengumuman" description="Dikirim ke semua user client company ini." content-class="max-w-md">
      <div class="space-y-3 py-2">
        <div class="space-y-1.5">
          <Label for="ann-title">Judul</Label>
          <Input id="ann-title" v-model="form.title" placeholder="mis. Perubahan titik kumpul" />
        </div>
        <div class="space-y-1.5">
          <Label for="ann-message">Isi</Label>
          <textarea id="ann-message" v-model="form.message" rows="4" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <label class="flex items-center gap-2 text-sm text-foreground">
          <Checkbox v-model="form.requiresConfirmation" />
          Minta client mengonfirmasi
        </label>
      </div>
      <template #footer>
        <Button variant="outline" @click="isAnnouncementOpen = false">
          Batal
        </Button>
        <Button :disabled="gate.saving.value || !form.title.trim() || !form.message.trim()" @click="publishAnnouncement">
          Kirim
        </Button>
      </template>
    </ResponsiveFormSheet>
  </div>
</template>
