<script setup lang="ts">
import type { PrivateFileSource } from '~/types/api'
const props = defineProps<{ sourceType: PrivateFileSource; sourceId: string|null; canUpload?: boolean; allowSharing?: boolean }>()
const emit = defineEmits<{ 'update:sourceId': [value: string|null] }>()
</script>
<template>
  <ResponsiveFormSheet :open="!!props.sourceId" title="Bukti asli privat" description="File asli yang tertaut pada sumber ini." @update:open="v=>{if(!v){emit('update:sourceId',null)}}">
    <PrivateEvidencePanel v-if="props.sourceId" :source-type="sourceType" :source-id="props.sourceId" :can-upload="canUpload" :allow-sharing="allowSharing" />
  </ResponsiveFormSheet>
</template>
