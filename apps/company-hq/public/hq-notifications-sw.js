/* global self */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data
    try { data = event.data?.json() }
    catch { return }
    if (!data || !/^[a-f0-9-]{36}$/i.test(data.id) || typeof data.activity !== 'string' || data.activity.length > 100) return
    await self.registration.showNotification('Building Suit HQ', {
      body: data.activity, tag: data.id, renotify: false,
    })
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    clients.find(client => client.focused)?.postMessage({ type: 'hq-activity', id: data.id })
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const hq = clients.find(client => client.url === new URL('/', self.location.origin).href)
    if (hq) await hq.focus()
    else await self.clients.openWindow('/')
  })())
})
