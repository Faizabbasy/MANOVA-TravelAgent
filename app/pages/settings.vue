<script setup lang="ts">
import { ROLES } from '~/constants/roles'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Settings' })

const { users, currentUser, setCurrentUser } = useCurrentUser()
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <PageHeader
      title="Settings"
      description="Profil akun dan demo role switcher."
      :breadcrumb="[{ label: 'Settings' }]"
    />

    <SectionCard title="Profil Akun">
      <DetailMetadataList
        :items="[
          { label: 'Nama', value: currentUser.name },
          { label: 'Email', value: currentUser.email },
          { label: 'Role', value: ROLES.find(role => role.value === currentUser.role)?.label ?? currentUser.role },
        ]"
      />
    </SectionCard>

    <SectionCard
      title="Demo Role Switcher"
      description="Ganti user demo untuk melihat bagaimana navigasi dan dashboard berubah sesuai role (Prompt 5-I)."
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          v-for="user in users"
          :key="user.id"
          @click="setCurrentUser(user.id)"
          class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors"
          :class="user.id === currentUser.id
            ? 'border-primary/40 bg-primary/5 text-primary'
            : 'border-border hover:bg-muted text-foreground'"
        >
          <span>
            <span class="font-medium">{{ user.name }}</span>
            <span class="block text-xs text-muted-foreground">{{ ROLES.find(role => role.value === user.role)?.label }}</span>
          </span>
        </button>
      </div>
    </SectionCard>
  </div>
</template>
