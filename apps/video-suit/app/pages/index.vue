<script setup lang="ts">
import { reviseProject } from '../../scene/manifest.mjs'
const { locale } = useI18n()
const { data: projects } = await useFetch<{ id: string; name: string; duration: number; parameters: { receiptLift: number; cameraPush: number; goldIntensity: number }; revision: number }[]>('/catalog.json')
const selected = ref(projects.value?.[0]?.id || '')
const project = computed(() => projects.value?.find(p => p.id === selected.value))
const time = ref(0)
const parameters = ref({ receiptLift: 1.1, cameraPush: 1, goldIntensity: 1 })
watch(project, p => { if (p) parameters.value = { ...p.parameters }; time.value = 0 }, { immediate: true })
// Catalog entries are complete validated manifests; avoid mixing asynchronous sources on project changes.
const manifestUrl = computed(() => project.value ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(reviseProject(project.value, parameters.value), null, 2))}` : '')
const ar = computed(() => locale.value === 'ar')
const labels = computed(() => ar.value ? { projects:'المشاريع', scenes:'المشاهد', assets:'الأصول', play:'تشغيل', pause:'إيقاف', replay:'البداية', save:'تنزيل المشروع', timeline:'الزمن', parameters:'إعدادات الحركة', lift:'ارتفاع الإيصالات', camera:'حركة الكاميرا', glow:'الضوء الذهبي', local:'التغييرات مؤقتة. نزّل المشروع ثم استبدل project.json في مجلده لإعادة استخدامه.', sample:'مشهد تجريبي صامت' } : { projects:'Video projects', scenes:'Reusable scenes', assets:'Asset library', play:'Play', pause:'Pause', replay:'Restart', save:'Download project JSON', timeline:'Timeline', parameters:'Motion parameters', lift:'Receipt lift', camera:'Camera height', glow:'Gold intensity', local:'Edits are temporary. Download the manifest and replace project.json in its video folder to save. Rebuild to reopen your saved changes.', sample:'SILENT CINEMATIC SAMPLE' })
function parameter(key: string, value: number) { if (!(key in parameters.value)) return; parameters.value = { ...parameters.value, [key]: value } }
</script>
<template><BsVideoStudioPage :title="ar ? 'كل مشهد، بداية جديدة.' : 'Every scene. A new possibility.'" :description="ar ? 'مشاهد قابلة لإعادة الاستخدام، وأصول محفوظة لكل فيديو.' : 'A permanent home for your films, scenes and reusable assets.'" :project-name="project?.name || 'No projects'" :projects="projects || []" :selected="selected" :duration="project?.duration || 5" :time="time" :parameters="parameters" :labels="labels" :preview-url="`/render.html?project=${selected}`" :manifest-url="manifestUrl" @select="selected = $event" @seek="time = $event" @parameter="parameter" /></template>
