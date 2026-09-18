export function useVerificationTimer(expirySeconds = 3600, resendSeconds = 60) {
  const expiresAt = ref(0)
  const resendAt = ref(0)
  const now = ref(Date.now())
  const expiresIn = computed(() => Math.max(0, Math.ceil((expiresAt.value - now.value) / 1000)))
  const resendIn = computed(() => Math.max(0, Math.ceil((resendAt.value - now.value) / 1000)))
  const expired = computed(() => expiresIn.value === 0)
  let timer: ReturnType<typeof setInterval> | undefined
  function start() { now.value = Date.now(); expiresAt.value = now.value + expirySeconds * 1000; resendAt.value = now.value + resendSeconds * 1000 }
  function format(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` }
  onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
  onBeforeUnmount(() => { if (timer) clearInterval(timer) })
  return { expiresAt, resendAt, expiresIn, resendIn, expired, start, format }
}
