import type { HqActivityTopic } from './useHqLiveEvents'

const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }
const devicePreference = 'bs-hq-notifications-disabled'
const workerPath = '/hq-notifications-sw.js'

export function useHqActivityNotifications(isFounder: () => boolean, activityLabel: (topic: HqActivityTopic) => string) {
  const status = ref<'loading' | 'permission' | 'off' | 'on' | 'denied' | 'unsupported' | 'unavailable' | 'error'>('loading')
  const busy = ref(false)
  const soundOn = ref(false)
  const liveOnly = ref(false)
  const live = useHqLiveEvents()
  let config: { registration: ServiceWorkerRegistration; key: string | null } | null = null
  let audio: AudioContext | null = null
  let scope = 0
  let mounted = false
  let entryPermissionRequested = false
  const recent = new Set<string>()

  const request = { headers, credentials: 'same-origin', retry: 0, timeout: 12_000 } as const

  function reset() {
    scope++
    config = null
    liveOnly.value = false
    recent.clear()
    busy.value = false
    soundOn.value = false
    status.value = 'loading'
    const previous = audio
    audio = null
    void previous?.close().catch(() => {})
  }

  async function load() {
    if (!mounted) return
    reset()
    if (!isFounder()) return
    if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      status.value = 'unsupported'
      return
    }
    const expected = scope
    try {
      const { publicKey } = await $fetch<{ publicKey: string | null }>('/api/hq/push/config', request)
      if (expected !== scope) return
      if (!publicKey && !import.meta.dev) { status.value = 'unavailable'; return }
      const registration = await navigator.serviceWorker.register(workerPath)
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Notification worker unavailable')), 8_000) }),
        ])
      }
      finally { clearTimeout(timeout) }
      const existing = publicKey ? await registration.pushManager.getSubscription() : null
      const enabled = existing ? (await $fetch<{ enabled: boolean }>('/api/hq/push/device', {
        ...request, method: 'POST', body: { action: 'check', endpoint: existing.endpoint },
      })).enabled : false
      if (expected !== scope) return
      config = { registration, key: publicKey }
      liveOnly.value = !publicKey
      const permission = Notification.permission
      const disabled = localStorage.getItem(devicePreference) === '1'
      status.value = permission === 'denied' ? 'denied' : disabled ? 'off' : permission === 'default' ? 'permission'
        : enabled || !publicKey ? 'on' : 'off'
      if (!disabled && !enabled && permission !== 'denied' && status.value !== 'on' && !entryPermissionRequested) {
        entryPermissionRequested = true
        await togglePush()
      }
    }
    catch { if (expected === scope) status.value = 'unavailable' }
  }

  async function togglePush() {
    if (!config || busy.value || !isFounder()) return
    const expected = scope
    const { registration, key } = config
    const disabling = status.value === 'on'
    busy.value = true
    try {
      // Also callable directly from the sidebar for browsers that require a gesture.
      if (!disabling && Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') {
        if (scope === expected) status.value = Notification.permission === 'denied' ? 'denied' : 'permission'
        return
      }
      if (scope !== expected) return
      if (!key) {
        setEnabled(!disabling)
        return
      }
      let subscription = await registration.pushManager.getSubscription()
      if (scope !== expected) return
      if (disabling) {
        if (subscription) {
          await $fetch('/api/hq/push/device', { ...request, method: 'POST', body: { action: 'disable', endpoint: subscription.endpoint } })
          await subscription.unsubscribe()
        }
        if (scope === expected) setEnabled(false)
        return
      }
      // The server has no current registration. Replace a stale endpoint so
      // a provider-expired subscription can be enabled again.
      if (subscription) {
        await subscription.unsubscribe()
        subscription = null
      }
      if (scope !== expected) return
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      if (scope !== expected) return
      const { p256dh, auth } = subscription.toJSON().keys ?? {}
      await $fetch('/api/hq/push/device', { ...request, method: 'POST', body: { action: 'enable', endpoint: subscription.endpoint, p256dh, auth } })
      if (scope === expected) setEnabled(true)
    }
    catch {
      if (scope === expected) {
        // Reconcile an uncertain write before allowing another toggle.
        await load()
        if (scope === expected + 1 && status.value === 'off') status.value = 'error'
      }
    }
    finally { if (scope === expected) busy.value = false }
  }

  function setEnabled(enabled: boolean) {
    if (enabled) localStorage.removeItem(devicePreference)
    else localStorage.setItem(devicePreference, '1')
    status.value = enabled ? 'on' : 'off'
    if (!enabled) soundOn.value = false
  }

  live.subscribeActivity(topic => {
    if (!liveOnly.value || !config || status.value !== 'on' || !isFounder() || !document.hasFocus()
      || Notification.permission !== 'granted') return
    void config.registration.showNotification('Building Suit HQ', { body: activityLabel(topic) }).catch(() => {})
    playChime()
  })

  async function toggleSound() {
    if (status.value !== 'on' || !isFounder() || !('AudioContext' in window)) return
    if (soundOn.value) { soundOn.value = false; return }
    const expected = scope
    try {
      audio ??= new AudioContext()
      await audio.resume()
      if (scope === expected) soundOn.value = audio?.state === 'running'
    }
    catch { soundOn.value = false }
  }

  function playSound(event: MessageEvent) {
    const worker = config?.registration.active
    if (!worker || event.source !== worker || status.value !== 'on' || !isFounder() || !soundOn.value || audio?.state !== 'running'
      || event.data?.type !== 'hq-activity' || typeof event.data.id !== 'string' || recent.has(event.data.id)) return
    recent.add(event.data.id)
    if (recent.size > 128) {
      const oldest = recent.values().next().value
      if (oldest !== undefined) recent.delete(oldest)
    }
    playChime()
  }

  function playChime() {
    if (!soundOn.value || audio?.state !== 'running') return
    const start = audio.currentTime
    const tone = audio.createOscillator()
    const gain = audio.createGain()
    tone.frequency.setValueAtTime(660, start)
    tone.frequency.setValueAtTime(880, start + 0.09)
    gain.gain.setValueAtTime(0.07, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
    tone.connect(gain).connect(audio.destination)
    tone.start(start)
    tone.stop(start + 0.23)
  }

  onMounted(() => {
    mounted = true
    navigator.serviceWorker?.addEventListener('message', playSound)
    void load()
  })
  watch(isFounder, load, { flush: 'sync' })
  onScopeDispose(() => {
    if (mounted) navigator.serviceWorker?.removeEventListener('message', playSound)
    mounted = false
    reset()
  })
  return { status, busy, soundOn, liveOnly, togglePush, toggleSound }
}
