const CACHE = 'hibiyui-v49';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'gen.js', 'sync.js', 'game.js', 'soccer-figs.js', 'soccer-guide.js', 'ui-game.js', 'manifest.webmanifest', 'icon.svg', 'match.js', 'playsim.js', 'play3d.js', 'stadium3d.js', 'airsim.js', 'air3d.js', 'vehicle3d.js', 'world3d.js', 'fx3d.js', 'airnet.js', 'citysim.js', 'citymap.js', 'assets3d.js', 'citymap-data.js', 'terrain3d.js', 'terrain-data.js', 'roadmarks3d.js', 'citymodels3d.js', 'post3d.js', 'facade3d.js', 'city3d.js', 'playnet.js', 'net.js', 'ui-net.js', 'push.js', 'vendor/qrcode.js', 'vendor/jsQR.js', 'ui-sky.js', 'vendor/three.module.min.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// ネット優先、だめなら保存分(オフラインでも動く)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // 共有DBへの通信は保存しない
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => { // GitHub Pages の 10ぷんキャッシュを とばして、いつも さいしんを たしかめる(かわって なければ 304 で かるい)
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request))
  );
});

// プッシュつうち(GitHub Actions の scripts/send-push.mjs が おくる): れんしゅうの おしらせ(かんたんな もんだい)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'ひびゆいFC', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ひびゆいFC', { body: d.body || '', tag: d.tag || 'hibiyui', renotify: true, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { for (const c of cs) { if ('focus' in c) { if (c.navigate) c.navigate(url).catch(() => {}); return c.focus(); } } return self.clients.openWindow(url); }));
});
