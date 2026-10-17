<script setup lang="ts">
const form = defineModel<{ name: string; phone: string; email: string; dateOfBirth: string }>({ required: true })
defineProps<{ labels: { name: string; phone: string; email: string; dateOfBirth: string }; disabled: boolean; latestDate: string }>()
function update(key: keyof typeof form.value,value: unknown) { form.value = { ...form.value,[key]: String(value ?? '') } }
</script>
<template>
  <BsField v-slot="field" :label="labels.name" required><BsInput :id="field.id" :model-value="form.name" :disabled="disabled" :maxlength="160" required autocomplete="off" @update:model-value="update('name',$event)" /></BsField>
  <BsField v-slot="field" :label="labels.phone"><BsInput :id="field.id" :model-value="form.phone" :disabled="disabled" type="tel" :maxlength="50" autocomplete="off" @update:model-value="update('phone',$event)" /></BsField>
  <BsField v-slot="field" :label="labels.email"><BsInput :id="field.id" :model-value="form.email" :disabled="disabled" type="email" :maxlength="254" autocomplete="off" @update:model-value="update('email',$event)" /></BsField>
  <BsField v-slot="field" :label="labels.dateOfBirth"><BsInput :id="field.id" :model-value="form.dateOfBirth" :disabled="disabled" type="date" :max="latestDate" autocomplete="off" @update:model-value="update('dateOfBirth',$event)" /></BsField>
</template>
