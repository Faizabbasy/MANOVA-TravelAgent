<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

definePageMeta({
  layout: false,
})

const router = useRouter()
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

const handleLogin = async () => {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'Please fill in all fields'
    return
  }

  isLoading.value = true

  // Simulate API call
  setTimeout(() => {
    // Simple auth check (replace with actual API call)
    if (email.value && password.value) {
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('userEmail', email.value)
      router.push('/')
    } else {
      error.value = 'Invalid credentials'
    }
    isLoading.value = false
  }, 500)
}
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex justify-center mb-8">
        <img src="/logo.svg" alt="Daffascript" class="h-12 w-auto" />
      </div>

      <!-- Login Card -->
      <div class="bg-card rounded-3xl p-8 card-shadow">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-foreground mb-2">Welcome back</h1>
          <p class="text-sm text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Email Field -->
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="john@example.com"
              autocomplete="email"
              :disabled="isLoading"
            />
          </div>

          <!-- Password Field -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="password">Password</Label>
              <button
                type="button"
                class="text-xs text-primary hover:underline"
                @click.prevent
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              :disabled="isLoading"
            />
          </div>

          <!-- Error Message -->
          <div v-if="error" class="text-sm text-destructive">
            {{ error }}
          </div>

          <!-- Submit Button -->
          <Button
            type="submit"
            class="w-full"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Signing in...' : 'Sign in' }}
          </Button>
        </form>

        <!-- Footer -->
        <div class="mt-6 text-center">
          <p class="text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      <!-- Additional Info -->
      <div class="mt-6 flex items-center justify-center gap-2">
        <span class="text-sm text-muted-foreground">Made with ❤️ by</span>
        <img src="/daffascript.svg" alt="Daffascript" class="h-6 w-auto" />
      </div>
    </div>
  </div>
</template>
