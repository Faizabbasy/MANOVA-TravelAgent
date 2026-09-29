<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, ChevronDown, LayoutGrid, Loader2, ShieldCheck, Wallet } from 'lucide-vue-next'
import type { Component } from 'vue'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { getUserById } from '~/data'
import { DEMO_LOGIN_ACCOUNTS } from '~/data/users'
import { getRoleDefinition, getRoleLabel, isRoleSelectable } from '~/data/rbac'
import { isApiError } from '~/lib/api/errors'
import type { BadgeTone } from '~/types/common'

definePageMeta({
  layout: false
})
useHead({ title: 'Masuk' })

const api = useApi()
const { setCurrentUser } = useCurrentUser()
const { showToast } = useToast()

/**
 * Login satu-klik (Penyederhanaan 3-Role). Setiap kartu membuat sesi server sungguhan lewat
 * `POST /api/v1/auth/demo-login` (hanya aktif di lingkungan demo), lalu menyelaraskan user aktif di
 * aplikasi. Bila server API belum berjalan, aplikasi tetap bisa dipakai dalam mode lokal — dengan
 * pemberitahuan yang jelas, karena data dari server tidak akan tersedia.
 */

const ROLE_ICONS: Record<string, Component> = { 'super-admin': ShieldCheck, admin: LayoutGrid, finance: Wallet }
const AVATAR_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-chart-5/10 text-chart-5',
  purple: 'bg-chart-4/10 text-chart-4'
}

const accounts = computed(() => DEMO_LOGIN_ACCOUNTS
  .map(({ userId, summary }) => ({ user: getUserById(userId), summary }))
  .filter((entry): entry is { user: NonNullable<typeof entry.user>; summary: string } => !!entry.user && isRoleSelectable(entry.user.role))
  .map(({ user, summary }) => {
    const role = getRoleDefinition(user.role)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      summary,
      roleLabel: getRoleLabel(user.role),
      icon: ROLE_ICONS[user.role] ?? LayoutGrid,
      avatarClass: AVATAR_TONES[role?.tone ?? 'neutral']
    }
  }))

const pendingId = ref<string | null>(null)
const errorMessage = ref('')
const errorRequestId = ref<string | null>(null)
const statusMessage = ref('')

function initials (name: string): string {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')
}

/** Server tidak terjangkau / proxy gagal — bukan penolakan dari server. */
function isServerUnavailable (error: unknown): boolean {
  return isApiError(error) && (error.status === 0 || error.status >= 500 || error.code === 'UNEXPECTED_RESPONSE')
}

function showError (error: unknown, fallback: string) {
  errorMessage.value = isApiError(error) ? error.message : fallback
  errorRequestId.value = isApiError(error) ? error.requestId : null
  statusMessage.value = ''
}

async function enterApp (userId: string, email: string, mode: 'server' | 'local') {
  localStorage.setItem('isAuthenticated', 'true')
  localStorage.setItem('userEmail', email)
  setCurrentUser(userId)
  if (mode === 'local') {
    showToast('Masuk mode lokal', 'Server API belum berjalan, jadi data dari server belum tersedia. Jalankan `npm run dev` dari root untuk mode lengkap.', 'warning')
  }
  await navigateTo('/')
}

async function signInAs (account: { id: string; name: string; email: string }) {
  if (pendingId.value) { return }
  pendingId.value = account.id
  errorMessage.value = ''
  errorRequestId.value = null
  statusMessage.value = `Masuk sebagai ${account.name}…`
  try {
    await api.auth.demoLogin(account.id)
    await enterApp(account.id, account.email, 'server')
  } catch (error) {
    if (isServerUnavailable(error)) {
      await enterApp(account.id, account.email, 'local')
      return
    }
    if (isApiError(error) && error.isNotFound) {
      showError(error, '')
      errorMessage.value = error.code === 'ROUTE_NOT_FOUND'
        ? 'Login satu-klik tidak aktif di server ini. Gunakan email dan kata sandi.'
        : `Akun ${account.name} belum ada di database server. Jalankan \`bun run db:seed:demo\` di folder backend.`
    } else {
      showError(error, 'Gagal masuk. Coba lagi.')
    }
    pendingId.value = null
  }
}

/* ── Masuk dengan email & kata sandi (akun server) ─────────────────────────────────────────── */
const showPasswordForm = ref(false)
const email = ref('')
const password = ref('')
const isSubmitting = ref(false)

async function handlePasswordLogin () {
  errorMessage.value = ''
  errorRequestId.value = null
  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Isi email dan kata sandi.'
    return
  }
  isSubmitting.value = true
  statusMessage.value = 'Memeriksa akun…'
  try {
    const { data: me } = await api.auth.login(email.value.trim(), password.value)
    const localUser = getUserById(me.user.id)
    if (!localUser || !isRoleSelectable(localUser.role)) {
      await api.auth.logout().catch(() => undefined)
      errorMessage.value = 'Akun ini valid, tetapi belum tersedia di aplikasi. Hubungi admin MANOVA.'
      statusMessage.value = ''
      return
    }
    await enterApp(localUser.id, me.user.email, 'server')
  } catch (error) {
    showError(error, 'Gagal masuk. Coba lagi.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <!-- Panel brand (desktop) -->
    <aside class="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between p-12">
      <div aria-hidden="true" class="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" class="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-2xl" />

      <div class="relative flex items-center gap-3">
        <div class="h-11 w-11 overflow-hidden rounded-full bg-white">
          <img src="/logo-sweet-escape.jpg" alt="" class="h-full w-full scale-150 object-cover">
        </div>
        <span class="text-lg font-bold tracking-tight">MANOVA</span>
      </div>

      <div class="relative max-w-md space-y-4">
        <h2 class="text-3xl font-bold leading-tight tracking-tight">
          Operasional travel dan keuangan, dalam satu tempat.
        </h2>
        <p class="text-sm leading-relaxed text-primary-foreground/80">
          Dari lead dan project sampai booking, vendor, dan arus kas. Setiap peran melihat apa yang ia butuhkan, tidak lebih.
        </p>
      </div>

      <p class="relative text-xs text-primary-foreground/70">
        Lingkungan demo internal MANOVA — bukan data produksi.
      </p>
    </aside>

    <!-- Pemilihan akun -->
    <section class="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <div class="h-10 w-10 overflow-hidden rounded-full bg-white card-shadow">
            <img src="/logo-sweet-escape.jpg" alt="" class="h-full w-full scale-150 object-cover">
          </div>
          <span class="text-lg font-bold tracking-tight text-foreground">MANOVA</span>
        </div>

        <header class="mb-6">
          <h1 class="text-2xl font-bold tracking-tight text-foreground">
            Masuk ke MANOVA
          </h1>
          <p class="mt-1.5 text-sm text-muted-foreground">
            Pilih akun, langsung masuk. Tanpa kata sandi.
          </p>
        </header>

        <ul class="space-y-3" aria-label="Akun demo">
          <li v-for="account in accounts" :key="account.id">
            <button
              type="button"
              class="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left card-shadow transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
              :disabled="pendingId !== null || isSubmitting"
              :aria-busy="pendingId === account.id"
              :aria-label="`Masuk sebagai ${account.name}, ${account.roleLabel}`"
              @click="signInAs(account)"
            >
              <span
                class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                :class="account.avatarClass"
                aria-hidden="true"
              >
                {{ initials(account.name) }}
                <span class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-card">
                  <component :is="account.icon" class="h-3 w-3" />
                </span>
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="font-semibold text-foreground">{{ account.roleLabel }}</span>
                  <span class="text-xs text-muted-foreground">· {{ account.name }}</span>
                </span>
                <span class="mt-1 block text-xs leading-relaxed text-muted-foreground">{{ account.summary }}</span>
              </span>

              <Loader2 v-if="pendingId === account.id" class="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
              <ArrowRight v-else class="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <p class="sr-only" aria-live="polite">
          {{ statusMessage }}
        </p>

        <div
          v-if="errorMessage"
          role="alert"
          class="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <p>{{ errorMessage }}</p>
          <p v-if="errorRequestId" class="mt-1 text-xs text-destructive/70">
            Request ID: {{ errorRequestId }}
          </p>
        </div>

        <!-- Alternatif: email & kata sandi -->
        <div class="mt-8 border-t border-border pt-5">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :aria-expanded="showPasswordForm"
            aria-controls="password-login"
            @click="showPasswordForm = !showPasswordForm"
          >
            Masuk dengan email & kata sandi
            <ChevronDown class="h-4 w-4 transition-transform duration-200" :class="{ 'rotate-180': showPasswordForm }" aria-hidden="true" />
          </button>

          <form
            v-show="showPasswordForm"
            id="password-login"
            class="mt-4 space-y-4"
            novalidate
            @submit.prevent="handlePasswordLogin"
          >
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="nama@manova.id"
                autocomplete="email"
                :disabled="isSubmitting"
              />
            </div>
            <div class="space-y-2">
              <Label for="password">Kata sandi</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                :disabled="isSubmitting"
              />
            </div>
            <Button type="submit" class="w-full" :disabled="isSubmitting || pendingId !== null">
              <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              {{ isSubmitting ? 'Memeriksa…' : 'Masuk' }}
            </Button>
          </form>
        </div>

        <p class="mt-8 text-center text-xs text-muted-foreground">
          Ingin mengajukan permintaan perjalanan?
          <NuxtLink to="/lead-intake" class="font-medium text-primary hover:underline">
            Isi form di sini
          </NuxtLink>
        </p>
      </div>
    </section>
  </main>
</template>
