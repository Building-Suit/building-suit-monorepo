<script setup lang="ts">
import type { BsCatalogOfferForm, BsCatalogOffersView, BsCatalogOffersCopy } from '../types/storefrontBuilderPresentation'
defineProps<{ view: BsCatalogOffersView; copy: BsCatalogOffersCopy }>()
const form=defineModel<BsCatalogOfferForm>('form',{required:true}),editor=defineModel<boolean>('editor',{default:false})
const emit=defineEmits<{create:[];edit:[id:string];save:[];retry:[];page:[value:number];search:[value:string];more:[];retrySources:[];add:[key:string]}>()
function quantity(index:number,value:number){form.value={...form.value,lines:form.value.lines.map((line,i)=>i===index?{...line,quantity:value}:line)}}
function remove(index:number){form.value={...form.value,lines:form.value.lines.filter((_,i)=>i!==index)}}
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.help" />
  <BsStateSurface v-if="!view.available" state="empty" :title="copy.noShop" />
  <BsStateSurface v-else-if="view.loading" state="loading" :title="copy.loading" />
  <BsStateSurface v-else-if="view.failed" state="error" :title="copy.failed" :action-label="copy.retry" @action="emit('retry')" />
  <template v-else>
   <BsAlert v-if="view.success" tone="success">{{view.success}}</BsAlert><BsAlert v-if="view.error&&!editor" tone="error">{{view.error}}</BsAlert>
   <BsText as="p" tone="muted" size="sm">{{copy.matchHelp}}</BsText>
   <BsDataTable :value="view.rows" row-key="id" :label="copy.title" :columns="[{key:'name',field:'name',header:copy.name},{key:'items',field:'items',header:copy.items},{key:'oldPrice',field:'oldPrice',header:copy.oldPrice},{key:'price',field:'price',header:copy.price},{key:'status',field:'status',header:copy.status}]" :capabilities="{insert:view.canManage,edit:view.canManage}" :action-labels="{insert:copy.create,edit:copy.edit}" :row-action-pending="view.pending" @create="emit('create')" @edit="emit('edit',$event.id)" />
   <BsPagination :page="view.page" :total="view.total" :page-size="20" :label="copy.title" :previous-label="copy.previous" :next-label="copy.next" @update:page="emit('page',$event)" />
  </template>
  <BsRecordActionDialog v-model:visible="editor" :title="copy.edit" size="lg" :pending="view.pending" :dirty="view.dirty" :error="view.error" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="!form.lines.length" pinned-actions @submit="emit('save')">
   <BsField v-slot="field" :label="copy.name" required><BsInput :id="field.id" v-model="form.name" :maxlength="120" required /></BsField>
   <BsField v-slot="field" :label="copy.description"><BsTextarea :id="field.id" v-model="form.description" :maxlength="320" /></BsField>
   <BsField v-slot="field" :label="copy.price" required><BsInput :id="field.id" :model-value="form.price" type="number" :min="0.01" :max="9999999999.99" :step="0.01" required @update:model-value="form.price=Number($event)" /></BsField>
   <BsDescriptionList><BsDescriptionItem :term="copy.oldPrice">{{view.oldPrice}}</BsDescriptionItem><BsDescriptionItem :term="copy.saving">{{view.saving}}</BsDescriptionItem></BsDescriptionList>
   <BsHeading :level="3">{{copy.items}}</BsHeading>
   <BsEntityPicker v-if="form.lines.length<20" :model-value="null" :label="copy.addItem" :options="view.sourceOptions" option-label="label" option-value="key" :loading="view.sourceLoading" :error="view.sourceFailed?copy.failed:null" :has-more="view.sourceHasMore" :load-more-label="copy.more" :retry-label="copy.retry" @update:model-value="emit('add',String($event))" @search="emit('search',$event)" @load-more="emit('more')" @retry="emit('retrySources')" />
   <BsStack v-for="(line,i) in form.lines" :key="line.kind+line.sourceId" gap="sm"><BsInline justify="between"><BsText emphasis="semibold">{{line.name}}</BsText><BsText tone="muted">{{line.price}}</BsText></BsInline><BsInline><BsQuantityStepper :model-value="line.quantity" :min="0.001" :max="999" :step="1" :label="`${copy.quantity}: ${line.name}`" :decrease-label="copy.decrease" :increase-label="copy.increase" @update:model-value="quantity(i,$event)" /><BsButton variant="danger" :aria-label="`${copy.remove}: ${line.name}`" @click="remove(i)">{{copy.remove}}</BsButton></BsInline></BsStack>
   <BsDivider /><BsCheckbox v-model="form.active" :label="copy.active" /><BsCheckbox v-model="form.websiteVisible" :label="copy.websiteVisible" :disabled="!view.canPublish" /><BsText tone="muted" size="sm">{{copy.publicationHelp}}</BsText>
   <BsField v-slot="field" :label="copy.priority" :help="copy.priorityHelp"><BsInput :id="field.id" :model-value="form.priority" type="number" :min="0" :max="999999" :step="1" required @update:model-value="form.priority=Number($event)" /></BsField>
   <BsField v-slot="field" :label="copy.starts"><BsInput :id="field.id" v-model="form.startsAt" type="datetime-local" /></BsField><BsField v-slot="field" :label="copy.ends"><BsInput :id="field.id" v-model="form.endsAt" type="datetime-local" /></BsField>
  </BsRecordActionDialog>
 </BsStack>
</template>
