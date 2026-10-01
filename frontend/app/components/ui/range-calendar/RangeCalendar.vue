<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { RangeCalendarHeading, RangeCalendarNext, RangeCalendarPrev, RangeCalendarRoot, type RangeCalendarRootProps, useForwardPropsEmits } from 'reka-ui'
import { cn } from '~/lib/utils'
import RangeCalendarCell from './RangeCalendarCell.vue'
import RangeCalendarCellTrigger from './RangeCalendarCellTrigger.vue'
import RangeCalendarGrid from './RangeCalendarGrid.vue'
import RangeCalendarGridBody from './RangeCalendarGridBody.vue'
import RangeCalendarGridHead from './RangeCalendarGridHead.vue'
import RangeCalendarGridRow from './RangeCalendarGridRow.vue'
import RangeCalendarHeadCell from './RangeCalendarHeadCell.vue'

/** Kalender range asli (klik tanggal langsung, bukan native `&lt;input type="date"&gt;`) — dipakai Dashboard
 * "Custom" period filter. Dibangun dari primitive `reka-ui` (paket yang sama dengan seluruh UI kit lain di
 * app/components/ui/), pola sama shadcn-vue "range-calendar" recipe. */
const props = defineProps<RangeCalendarRootProps & { class?: string }>()
const emits = defineEmits<{ 'update:modelValue': [value: typeof props.modelValue] }>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ grid, weekDays }"
    :class="cn('p-3', props.class)"
    v-bind="forwarded"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between px-1">
        <RangeCalendarPrev class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40">
          <ChevronLeft class="h-4 w-4" />
        </RangeCalendarPrev>
        <RangeCalendarHeading class="text-sm font-semibold text-foreground" />
        <RangeCalendarNext class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40">
          <ChevronRight class="h-4 w-4" />
        </RangeCalendarNext>
      </div>

      <RangeCalendarGrid v-for="month in grid" :key="month.value.toString()">
        <RangeCalendarGridHead>
          <RangeCalendarGridRow class="grid grid-cols-7">
            <RangeCalendarHeadCell v-for="day in weekDays" :key="day">
              {{ day }}
            </RangeCalendarHeadCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridHead>
        <RangeCalendarGridBody>
          <RangeCalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-1 grid grid-cols-7">
            <RangeCalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
              <RangeCalendarCellTrigger :day="weekDate" :month="month.value" />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
  </RangeCalendarRoot>
</template>
