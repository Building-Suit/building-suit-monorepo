<script setup lang="ts" generic="Input extends object, State extends object">
import { getCurrentInstance, reactive, watch } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  input: Input
  factory: (input: Input, emit: (event: string, ...args: unknown[]) => void) => State
}>()
const instance = getCurrentInstance()
const input = reactive({ ...props.input }) as Input
watch(() => props.input, value => {
  for (const key of Object.keys(input)) if (!(key in value)) Reflect.deleteProperty(input, key)
  Object.assign(input, value)
}, { flush: 'sync' })
function emit(event: string, ...args: unknown[]) {
  instance?.emit(event, ...args)
}
// The factory runs once in this component's lifecycle. Vue disposes its effects
// on unmount; reactive slot state keeps models writable without copying refs.
const state = reactive(props.factory(input, emit))
</script>

<template><slot :state="state" /></template>
