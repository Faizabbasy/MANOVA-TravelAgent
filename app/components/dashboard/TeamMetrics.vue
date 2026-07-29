<script setup lang="ts">
const teamMembers = [
  {
    name: 'Sarah Chen',
    role: 'Lead Designer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop&crop=face',
    initials: 'SC',
    utilization: 92,
    tasks: 8,
  },
  {
    name: 'Mike Johnson',
    role: 'Senior Developer',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face',
    initials: 'MJ',
    utilization: 85,
    tasks: 12,
  },
  {
    name: 'Emily Davis',
    role: 'Project Manager',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face',
    initials: 'ED',
    utilization: 78,
    tasks: 15,
  },
  {
    name: 'Alex Thompson',
    role: 'Full Stack Developer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face',
    initials: 'AT',
    utilization: 95,
    tasks: 10,
  },
]
</script>

<template>
  <div class="bg-card rounded-xl card-shadow animate-fade-in">
    <div class="p-6 border-b border-border">
      <h3 class="text-lg font-semibold text-foreground">Team Utilization</h3>
      <p class="text-sm text-muted-foreground mt-1">Current workload distribution</p>
    </div>

    <div class="divide-y divide-border">
      <div
        v-for="member in teamMembers"
        :key="member.name"
        class="p-4 hover:bg-muted/50 transition-colors"
      >
        <div class="flex items-center gap-3">
          <Avatar class="h-10 w-10">
            <AvatarImage :src="member.avatar" />
            <AvatarFallback>{{ member.initials }}</AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-sm font-medium text-foreground">{{ member.name }}</p>
                <p class="text-xs text-muted-foreground">{{ member.role }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold text-foreground">{{ member.utilization }}%</p>
                <p class="text-xs text-muted-foreground">{{ member.tasks }} tasks</p>
              </div>
            </div>
            <Progress
              :model-value="member.utilization"
              class="h-1.5"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
