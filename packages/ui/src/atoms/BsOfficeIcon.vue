<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string,string> = {
 mail: 'M3 5h18v14H3z M3 5l9 8 9-8',
 user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M5 21v-2a7 7 0 0 1 14 0v2',
 team: 'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M6 21v-3a6 6 0 0 1 12 0v3 M19 4a3 3 0 0 1 0 6 M21 19v-2a5 5 0 0 0-2-4',
 dashboard: 'M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
 settings: 'M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9 M12 3v18',
 notification: 'M12 3l10 18H2z M12 8v5 M12 17v1',
 repeat: 'M20 7v5h-5 M20 12a8 8 0 1 0-2 6',
 image: 'M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M8 7h1',
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.dashboard" /></svg></template>
