<script setup lang="ts">
import type { BsWebsiteCatalogForm, BsWebsiteCatalogView } from '../types/websiteCatalogPresentation'
defineProps<{view:BsWebsiteCatalogView}>()
const form=defineModel<BsWebsiteCatalogForm>('form',{required:true})
const open=defineModel<boolean>('open',{default:false})
const search=defineModel<string>('search',{default:''})
const emit=defineEmits<{edit:[id:string];save:[];publish:[id:string];unpublish:[id:string];retry:[];page:[page:number];selectImage:[file:File|File[]|null]}>()
function update(key:keyof BsWebsiteCatalogForm,value:string|number|boolean|null) { form.value={...form.value,[key]:value} }
</script>
<template>
  <BsPanel id="website-catalog" padding="md">
    <BsHeading :level="2">{{view.title}}</BsHeading>
    <BsText as="p" tone="muted">{{view.help}}</BsText>
    <BsText v-if="view.denied" role="status">{{view.copy.denied}}</BsText>
    <BsText v-else-if="view.loading" role="status">{{view.copy.loading}}</BsText>
    <BsAlert v-else-if="view.failed" tone="error">{{view.copy.failed}} <BsButton @click="emit('retry')">{{view.copy.retry}}</BsButton></BsAlert>
    <BsStack v-else gap="md">
      <BsSearchField v-model="search" :label="view.copy.search" />
      <BsText v-if="view.success" role="status">{{view.success}}</BsText>
      <BsAlert v-if="view.error && !open" tone="error">{{view.error}}</BsAlert>
      <BsDataTable :value="view.rows" row-key="id" :label="view.title" :columns="[{key:'name',field:'name',header:view.copy.name},{key:'kindLabel',field:'kindLabel',header:view.copy.kind},{key:'publicationLabel',field:'publicationLabel',header:view.copy.state},{key:'priceLabel',field:'priceLabel',header:view.copy.price}]" :capabilities="{edit:true}" :action-labels="{edit:view.copy.edit}" :row-action-pending="view.pending" @edit="emit('edit',$event.id)">
        <template #row-actions="{row}">
          <BsButton v-if="row.canPublish" :disabled="view.pending" @click="emit('publish',row.id)">{{view.copy.publish}}</BsButton>
          <BsButton v-if="row.canUnpublish" :disabled="view.pending" @click="emit('unpublish',row.id)">{{view.copy.unpublish}}</BsButton>
        </template>
      </BsDataTable>
      <BsPagination :page="view.page" :total="view.total" :page-size="20" :label="view.title" :previous-label="view.copy.previous" :next-label="view.copy.next" @update:page="emit('page',$event)" />
    </BsStack>
    <BsRecordActionDialog v-model:visible="open" :title="view.editorTitle" :pending="view.pending" :dirty="view.dirty" :error="view.error" :submit-label="view.copy.save" :cancel-label="view.copy.cancel" pinned-actions @submit="emit('save')">
      <BsField v-slot="field" :label="view.copy.publicName"><BsInput :id="field.id" :model-value="form.publicName" required :maxlength="160" @update:model-value="update('publicName',String($event))" /></BsField>
      <BsField v-slot="field" :label="view.copy.description"><BsTextarea :id="field.id" :model-value="form.description" :maxlength="2000" @update:model-value="update('description',String($event))" /></BsField>
      <BsField v-slot="field" :label="view.copy.image" :help="view.copy.imageHelp">
        <BsImage v-if="form.image" :src="form.image" :alt="form.publicName" :width="96" :height="96" fit="contain" />
        <BsFileInput :input-id="field.id" accept="image/png,image/jpeg,image/webp" :label="view.copy.image" :reset-after-select="true" @select="emit('selectImage',$event)" />
        <BsButton v-if="form.image" @click="update('image',null)">{{view.copy.removeImage}}</BsButton>
      </BsField>
      <BsField v-slot="field" :label="view.copy.displayOrder"><BsInput :id="field.id" type="number" :model-value="form.displayOrder" :min="0" :max="999999" :step="1" required @update:model-value="update('displayOrder',Number($event))" /></BsField>
      <BsCheckbox :model-value="form.showPrice" :label="view.copy.showPrice" @update:model-value="update('showPrice',$event === true)" />
    </BsRecordActionDialog>
  </BsPanel>
</template>
