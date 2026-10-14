<script setup lang="ts">
import registry from '../../../../../docs/shared/atomic-template-route-inventory.json'
const { locale } = useI18n()
const arabic = computed(() => locale.value === 'ar')
const rows = Object.entries(registry.registeredTemplates).map(([name, source]) => {
 const consumers = registry.entries.filter(entry => entry.destination === source)
 return { name, source, consumers: consumers.length, purposes: [...new Set(consumers.map(entry => 'purpose' in entry ? entry.purpose : '').filter(Boolean))].join(' · ') }
}).sort((a, b) => a.name.localeCompare(b.name))
const columns = computed(() => [{ key: 'name', field: 'name', header: arabic.value ? 'القالب' : 'Template', sortable: true }, { key: 'consumers', field: 'consumers', header: arabic.value ? 'الاستخدامات' : 'Consumers', align: 'end' as const }, { key: 'purposes', field: 'purposes', header: arabic.value ? 'الغرض' : 'Purpose' }, { key: 'source', field: 'source', header: arabic.value ? 'المصدر' : 'Source' }])
</script>
<template>
 <BsStack gap="lg"><BsPageHeader :title="arabic ? 'قوالب الصفحات المشتركة' : 'Shared page templates'" :subtitle="arabic ? 'واجهات عرض كاملة بعقود مكتوبة؛ منطق الأعمال والبيانات والإعدادات في المنتج، والسلوك التفاعلي في UX.' : 'Complete presentation with typed contracts. Products supply business logic, data and configuration; UX owns shared interaction behavior.'"/><BsAlert tone="info" :title="arabic ? 'التحقق' : 'Verification'" :description="arabic ? 'سجل الملكية يحدد المصادر والأغراض. نتائج التحقق النهائية موثقة في تقرير ترحيل القوالب.' : 'The ownership registry identifies sources and purposes. Final acceptance evidence is recorded in the template migration report.'"/><BsDataTable :value="rows" data-key="name" :label="arabic ? 'القوالب' : 'Templates'" :columns="columns"><template #cell-source="{ row }"><BsText as="span" size="xs" dir="ltr">{{ row.source }}</BsText></template></BsDataTable><BsLink to="/templates/access">{{ arabic ? 'معاينة إدارة الوصول' : 'Access management preview' }}</BsLink></BsStack>
</template>
