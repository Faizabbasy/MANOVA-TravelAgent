<script setup lang="ts">
import { Send, Sparkles } from 'lucide-vue-next'
</script>

<template>
  <div class="bg-card rounded-xl card-shadow animate-fade-in overflow-hidden">
    <div class="p-6 border-b border-border">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-chart-4 flex items-center justify-center">
          <Sparkles class="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-foreground">AI Assistant</h3>
          <p class="text-sm text-muted-foreground">Get insights and help</p>
        </div>
      </div>
    </div>

    <div class="p-6 space-y-4">
      <div class="bg-muted/50 rounded-lg p-4">
        <p class="text-sm text-foreground">
          👋 Hi! I can help you analyze project performance, suggest optimizations, or answer questions about your data.
        </p>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" class="text-xs">
            Summarize overdue tasks
          </Button>
          <Button variant="outline" size="sm" class="text-xs">
            Budget recommendations
          </Button>
          <Button variant="outline" size="sm" class="text-xs">
            Team performance
          </Button>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-border">
      <div class="flex items-center gap-2">
        <Input
          placeholder="Ask me anything..."
          class="flex-1 bg-muted/50 border-0"
        />
        <Button size="icon" class="shrink-0">
          <Send class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
