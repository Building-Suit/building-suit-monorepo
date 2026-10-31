<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{
 title: string; description: string; projectName: string; previewUrl: string; manifestUrl: string
 projects: { id: string; name: string }[]; selected: string; duration: number; time: number
 parameters: { receiptLift: number; cameraPush: number; goldIntensity: number }
 labels: { projects: string; scenes: string; assets: string; play: string; pause: string; replay: string; save: string; timeline: string; parameters: string; lift: string; camera: string; glow: string; local: string; sample: string }
}>()
const emit = defineEmits<{ select: [id: string]; seek: [time: number]; play: []; pause: []; parameter: [key: string, value: number] }>()
const frame = ref<HTMLIFrameElement>()
watch(() => props.parameters, parameters => frame.value?.contentWindow?.postMessage({ type: 'video-suit:parameters', parameters }, window.location.origin), { deep: true })
function send(type: string, time?: number) { frame.value?.contentWindow?.postMessage({ type: `video-suit:${type}`, time }, window.location.origin) }
</script>
<template>
  <main class="video-studio">
    <header><span class="eyebrow">VIDEO SUIT / STUDIO 01</span><h1>{{ title }}</h1><p>{{ description }}</p></header>
    <div class="studio-grid">
      <aside><h2>{{ labels.projects }}</h2><button v-for="p in projects" :key="p.id" :aria-pressed="selected === p.id" @click="emit('select', p.id)">{{ p.name }}<small>9:16 · 5s · 30fps</small></button><h2>{{ labels.scenes }}</h2><p>Counter → tablet / v1</p><h2>{{ labels.assets }}</h2><p>01 / Counter kit<br>02 / Receipt SVG<br>03 / Record icons<br>04 / Official brand assets</p></aside>
      <section class="preview"><iframe :key="previewUrl" ref="frame" :src="previewUrl" :title="projectName"/><div class="transport"><button @click="send('play'); emit('play')">{{ labels.play }}</button><button @click="send('pause'); emit('pause')">{{ labels.pause }}</button><button @click="send('seek', 0); emit('seek', 0)">{{ labels.replay }}</button></div></section>
      <section class="inspector"><span class="eyebrow">{{ labels.sample }}</span><h2>{{ projectName }}</h2><label>{{ labels.timeline }} · {{ time.toFixed(2) }}s<input type="range" min="0" :max="duration" step="0.0333333333" :value="time" @input="send('seek', Number(($event.target as HTMLInputElement).value)); emit('seek', Number(($event.target as HTMLInputElement).value))"></label><h2>{{ labels.parameters }}</h2><label v-for="(label, key) in { receiptLift: labels.lift, cameraPush: labels.camera, goldIntensity: labels.glow }" :key="key">{{ label }} · {{ parameters[key].toFixed(1) }}<input type="range" min="0.1" max="2" step="0.1" :value="parameters[key]" @input="emit('parameter', key, Number(($event.target as HTMLInputElement).value))"></label><a v-if="manifestUrl" :href="manifestUrl" download="project.json">{{ labels.save }}</a><p class="note">{{ labels.local }}</p></section>
    </div>
    <footer><span>00.00 — 01.20 / SCATTER</span><span>01.20 — 03.50 / ARRANGE</span><span>03.50 — 05.00 / CLARITY</span></footer>
  </main>
</template>
<style scoped>
.video-studio{padding:clamp(1rem,3vw,3rem);color:var(--bs-text);max-width:1600px;margin:auto}header{margin-bottom:2rem}h1{font-size:clamp(2rem,4vw,3.5rem);margin:.5rem 0}h2{font-size:1rem;margin:1.5rem 0 .8rem}.eyebrow{color:var(--bs-color-brand-premium-gold);font-size:.7rem;letter-spacing:.16em}.studio-grid{display:grid;grid-template-columns:210px minmax(240px,1fr) 270px;gap:2rem}aside,.inspector{padding:1.3rem;border:1px solid var(--bs-color-brand-steel-border);border-radius:1rem}button,a{display:block;padding:.8rem 1rem;border:1px solid var(--bs-color-brand-steel-border);border-radius:.6rem;color:inherit;background:transparent;cursor:pointer;text-decoration:none}button[aria-pressed=true],a{border-color:var(--bs-color-brand-premium-gold)}small{display:block;opacity:.65;margin-top:.5rem}.preview{display:grid;justify-items:center;background:var(--bs-color-brand-deep-structure-navy);border-radius:1rem;padding:1rem}iframe{aspect-ratio:9/16;width:100%;max-width:300px;border:0;border-radius:.8rem}.transport{display:flex;gap:.5rem;padding-top:1rem}label{display:block;margin:1.5rem 0}input{display:block;width:100%;margin-top:.8rem;accent-color:var(--bs-color-brand-premium-gold)}p,.note{line-height:1.7;opacity:.75}.note{font-size:.8rem}footer{display:flex;justify-content:space-between;gap:1rem;margin-top:2rem;font-size:.65rem;letter-spacing:.1em;opacity:.6}@media(max-width:900px){.studio-grid{grid-template-columns:1fr}.transport{flex-wrap:wrap}footer{flex-wrap:wrap}}
</style>
