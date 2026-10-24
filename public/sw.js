// Web Push: lib/push.ts#notifyProfile payload'ı { title, body, url } gönderir.
self.addEventListener('push', function (event) {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  // Yalnızca bu uygulamanın kendi sayfaları açılır.
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  const target = url.origin === self.location.origin ? url.href : self.location.origin + '/'
  event.waitUntil(clients.openWindow(target))
})
