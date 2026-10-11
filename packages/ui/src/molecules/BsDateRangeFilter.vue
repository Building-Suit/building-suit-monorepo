<script setup lang="ts">
const from = defineModel<string>('from', { default: '' })
const to = defineModel<string>('to', { default: '' })

withDefaults(defineProps<{
  legend: string
  fromLabel: string
  toLabel: string
  description?: string
  hint?: string
  error?: string | null
  disabled?: boolean
  required?: boolean
  fromId?: string
  toId?: string
}>(), {
  description: undefined,
  hint: undefined,
  error: null,
  disabled: false,
  required: false,
  fromId: undefined,
  toId: undefined,
})

const generatedId = useId()
</script>

<template>
  <BsFieldGroup
    v-slot="group"
    :legend="legend"
    :description="description"
    :hint="hint"
    :error="error"
    :disabled="disabled"
    :required="required"
    layout="grid"
    :columns="2"
  >
    <BsField v-slot="field" :label="fromLabel" :for="fromId || `${generatedId}-from`" :required="required">
      <BsInput
        :id="fromId || `${generatedId}-from`"
        v-model="from"
        type="date"
        :max="to || undefined"
        :disabled="disabled"
        :required="required"
        :invalid="group.invalid || field.invalid"
        :aria-describedby="[group.describedby, field.describedby].filter(Boolean).join(' ') || undefined"
      />
    </BsField>
    <BsField v-slot="field" :label="toLabel" :for="toId || `${generatedId}-to`" :required="required">
      <BsInput
        :id="toId || `${generatedId}-to`"
        v-model="to"
        type="date"
        :min="from || undefined"
        :disabled="disabled"
        :required="required"
        :invalid="group.invalid || field.invalid"
        :aria-describedby="[group.describedby, field.describedby].filter(Boolean).join(' ') || undefined"
      />
    </BsField>
  </BsFieldGroup>
</template>
