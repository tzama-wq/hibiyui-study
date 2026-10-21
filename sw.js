const CACHE = 'hibiyui-v11';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'gen.js', 'sync.js', 'game.js', 'ui-game.js', 'manifest.webmanifest', 'icon.svg', 'match.js', 'playsim.js', 'play3d.js', 'airsim.js', 'air3d.js', 'vehicle3d.js', 'airnet.js', 'playnet.js', 'net.js', 'ui-net.js', 'vendor/qrcode.js', 'vendor/jsQR.js', 'ui-sky.js', 'vendor/three.module.min.js'];
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
