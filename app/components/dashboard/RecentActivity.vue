<script setup lang="ts">
import { cn } from '~/lib/utils'
import { FileText, MessageSquare, CheckCircle2, Upload, UserPlus } from 'lucide-vue-next'

const activities = [
  {
    id: 1,
    type: 'file',
    user: { name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop&crop=face', initials: 'SC' },
    action: 'uploaded',
    target: 'Design_v2.fig',
    project: 'E-commerce Platform',
    time: '5 min ago',
    icon: Upload,
    iconColor: 'text-primary bg-primary/10',
  },
  {
    id: 2,
    type: 'task',
    user: { name: 'Mike Johnson', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face', initials: 'MJ' },
    action: 'completed',
    target: 'API Integration',
    project: 'Mobile Banking App',
    time: '23 min ago',
    icon: CheckCircle2,
    iconColor: 'text-success bg-success/10',
  },
  {
    id: 3,
    type: 'comment',
    user: { name: 'Emily Davis', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face', initials: 'ED' },
    action: 'commented on',
    target: 'User Flow Review',
    project: 'Healthcare Portal',
    time: '1 hour ago',
    icon: MessageSquare,
    iconColor: 'text-warning bg-warning/10',
  },
  {
    id: 4,
    type: 'member',
    user: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face', initials: 'AT' },
    action: 'added',
    target: 'Lisa Wong',
    project: 'SaaS Dashboard',
    time: '2 hours ago',
    icon: UserPlus,
    iconColor: 'text-chart-4 bg-chart-4/10',
  },
  {
    id: 5,
    type: 'document',
    user: { name: 'Jessica Lee', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=32&h=32&fit=crop&crop=face', initials: 'JL' },
    action: 'created',
    target: 'Q1 Report.pdf',
    project: 'DataDriven',
    time: '3 hours ago',
    icon: FileText,
    iconColor: 'text-chart-5 bg-chart-5/10',
  },
]
</script>

<template>
  <div class="bg-card rounded-xl card-shadow animate-fade-in">
    <div class="p-6 border-b border-border">
      <h3 class="text-lg font-semibold text-foreground">Recent Activity</h3>
      <p class="text-sm text-muted-foreground mt-1">Latest updates from your team</p>
    </div>

    <div class="divide-y divide-border">
      <div
        v-for="activity in activities"
        :key="activity.id"
        class="p-4 hover:bg-muted/50 transition-colors"
      >
        <div class="flex items-start gap-3">
          <Avatar class="h-8 w-8">
            <AvatarImage :src="activity.user.avatar" />
            <AvatarFallback>{{ activity.user.initials }}</AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-foreground">
              <span class="font-medium">{{ activity.user.name }}</span>{{ ' ' }}
              <span class="text-muted-foreground">{{ activity.action }}</span>{{ ' ' }}
              <span class="font-medium">{{ activity.target }}</span>
            </p>
            <p class="text-xs text-muted-foreground mt-1">{{ activity.project }}</p>
          </div>
          <div class="flex items-center gap-3">
            <div :class="cn('p-1.5 rounded-lg', activity.iconColor)">
              <component :is="activity.icon" class="h-3.5 w-3.5" />
            </div>
            <span class="text-xs text-muted-foreground whitespace-nowrap">{{ activity.time }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
