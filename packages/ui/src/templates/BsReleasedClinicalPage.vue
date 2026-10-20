<script setup lang="ts">
import type {BsClinicalCopy,BsReleasedClinicalView} from '../utils/clinicalPresentation'
const props=defineProps<{view:BsReleasedClinicalView;copy:BsClinicalCopy}>()
const emit=defineEmits<{retry:[];print:[];download:[id:string]}>()
const prescriptionColumns=computed(()=>['name','identity','strength','form','amount','route','segments','instructions'].map(key=>({key,field:key,header:props.copy[key as keyof BsClinicalCopy]})))
const resultColumns=computed(()=>[{key:'order',field:'order',header:props.copy.order},{key:'annotation',field:'annotation',header:props.copy.annotation}])
const documentColumns=computed(()=>[{key:'name',field:'name',header:props.copy.filename},{key:'download',header:props.copy.download}])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="view.title"><template #actions><BsButton v-if="view.available" :disabled="view.pending || view.loading" @click="emit('print')">{{ copy.print }}</BsButton></template></BsPageHeader>
  <BsAlert tone="warning" :description="view.notice" />
  <BsSectionSkeleton v-if="view.loading && !view.available" :rows="4" />
  <BsStateSurface v-else-if="!view.available" state="permission" :title="view.unavailable"><BsButton :disabled="view.pending || view.loading" @click="emit('retry')">{{ copy.retry }}</BsButton></BsStateSurface>
  <template v-else>
   <BsAlert v-if="view.error" tone="error" :description="view.error" />
   <BsDescriptionList :columns="2"><BsDescriptionItem v-for="item in view.metadata" :key="item.label" :term="item.label">{{ item.value }}</BsDescriptionItem></BsDescriptionList>
   <BsHeading :level="2">{{ copy.prescriptions }}</BsHeading><BsDataTable :value="view.prescriptions" :columns="prescriptionColumns" row-key="id" :label="copy.prescriptions" />
   <BsHeading :level="2">{{ copy.results }}</BsHeading><BsDataTable :value="view.results" :columns="resultColumns" row-key="id" :label="copy.results" />
   <BsHeading :level="2">{{ copy.document }}</BsHeading><BsDataTable :value="view.documents" :columns="documentColumns" row-key="id" :label="copy.document"><template #cell-download="{data}"><BsButton variant="text" :disabled="view.pending" @click="emit('download',data.id)">{{ copy.download }}: {{ data.name }}</BsButton></template></BsDataTable>
  </template>
 </BsStack>
</template>
