<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

/**
 * Padanan `ResponsiveDataView` untuk form input/edit: `Dialog` di desktop (markup existing, tidak
 * disentuh), `Sheet side="bottom"` di mobile — pola native app, konsisten dengan preferensi standing
 * "Dialog -> Sheet" ([[feedback-modal-to-sidebar]]) tapi diterapkan hanya untuk breakpoint mobile supaya
 * desktop persis sama seperti sebelumnya. Satu titik pemakaian per form, tidak perlu duplikasi
 * Dialog/Sheet manual di tiap halaman.
 */
interface Props {
  title: string
  description?: string
  /** Class tambahan untuk `DialogContent` (mis. `max-w-md`) — Sheet mobile selalu full-width bawaan. */
  contentClass?: HTMLAttributes['class']
}

defineProps<Props>()
const open = defineModel<boolean>('open', { default: false })
const isMobile = useIsMobile()
</script>

<template>
  <Dialog v-if="!isMobile" v-model:open="open">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogContent :class="contentClass ?? 'max-w-md'">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">
          {{ description }}
        </DialogDescription>
      </DialogHeader>
      <slot />
      <DialogFooter v-if="$slots.footer">
        <slot name="footer" />
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Sheet v-else v-model:open="open">
    <SheetTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </SheetTrigger>
    <SheetContent side="bottom" class="max-h-[85vh] overflow-y-auto rounded-t-2xl">
      <SheetHeader class="text-left">
        <SheetTitle>{{ title }}</SheetTitle>
        <SheetDescription v-if="description">
          {{ description }}
        </SheetDescription>
      </SheetHeader>
      <div class="py-2">
        <slot />
      </div>
      <SheetFooter v-if="$slots.footer" class="mt-2">
        <slot name="footer" />
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
