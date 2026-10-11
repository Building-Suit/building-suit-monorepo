<script setup lang="ts">
import type { BsCustomerIdentityForm } from '../types/customerDirectoryPresentation'
defineProps<{ labels: { name: string; phone: string; email: string; address: string; notes: string } }>()
const form = defineModel<BsCustomerIdentityForm>({ required: true })
function update(key: keyof BsCustomerIdentityForm, value: string | number) { form.value = { ...form.value, [key]: String(value) } }
</script>
<template>
        <BsField v-slot="field" :label="labels.name">
          <BsInput :id="field.id" :model-value="form.name" :aria-describedby="field.describedby" type="text" :minlength="2" :maxlength="160" required @update:model-value="update('name', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="labels.phone">
          <BsInput :id="field.id" :model-value="form.phone" :aria-describedby="field.describedby" type="tel" :maxlength="50" autocomplete="tel" @update:model-value="update('phone', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="labels.email">
          <BsInput :id="field.id" :model-value="form.email" :aria-describedby="field.describedby" type="email" :maxlength="254" autocomplete="email" @update:model-value="update('email', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="labels.address">
          <BsTextarea :id="field.id" :model-value="form.address" :aria-describedby="field.describedby" :maxlength="500" :rows="2" @update:model-value="update('address', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="labels.notes">
          <BsTextarea :id="field.id" :model-value="form.notes" :aria-describedby="field.describedby" :maxlength="2000" :rows="3" @update:model-value="update('notes', $event)"/>
        </BsField>
</template>
