<script setup lang="ts">
import { KeyRound, PlugZap } from 'lucide-vue-next'

/**
 * Frame for every finance screen: page header plus the server-session gate. The content renders only once
 * the API session matches the signed-in user and it may read finance data — never someone else's figures,
 * never an empty screen that looks like "no money".
 */
const props = withDefaults(defineProps<{
  title: string
  description?: string
  breadcrumb?: { label: string; to?: string }[]
  /** Capability needed to see the page (server-computed). */
  capability?: string
}>(), { capability: 'finance.view-cash', breadcrumb: undefined, description: undefined })

const session = useServerSession()
const status = computed(() => session.state.value.status)
const allowed = computed(() => session.can(props.capability))

onMounted(() => { session.ensure().catch(() => undefined) })

const { currentUser } = useCurrentUser()
watch(() => currentUser.value.id, () => { session.ensure().catch(() => undefined) })

function signInAgain () {
  localStorage.removeItem('isAuthenticated')
  navigateTo('/login')
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1400px] space-y-6">
    <PageHeader :title="title" :description="description" :breadcrumb="breadcrumb ?? [{ label: 'Finance', to: '/finance' }, { label: title }]">
      <template v-if="$slots.actions && status === 'ready' && allowed" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <ClientOnly>
      <div v-if="status === 'idle' || status === 'checking'" class="space-y-4" role="status" aria-label="Menyiapkan sesi">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
        <div class="h-72 animate-pulse rounded-xl bg-muted" />
      </div>

      <Card v-else-if="status === 'offline'">
        <EmptyState :icon="PlugZap" title="Server belum terhubung" :description="session.state.value.message ?? undefined">
          <Button variant="outline" size="sm" @click="session.ensure().catch(() => undefined)">
            Coba lagi
          </Button>
        </EmptyState>
      </Card>

      <Card v-else-if="status === 'signed-out'">
        <EmptyState :icon="KeyRound" title="Perlu masuk lagi" :description="session.state.value.message ?? undefined">
          <Button size="sm" @click="signInAgain">
            Ke halaman masuk
          </Button>
        </EmptyState>
      </Card>

      <RoleAccessState v-else-if="!allowed" module-label="data Finance" />

      <slot v-else />

      <template #fallback>
        <div class="h-72 animate-pulse rounded-xl bg-muted" />
      </template>
    </ClientOnly>
  </div>
</template>
