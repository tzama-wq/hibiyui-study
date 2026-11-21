const CACHE = 'hibiyui-v95';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'gen.js', 'sync.js', 'game.js', 'soccer-figs.js', 'soccer-guide.js', 'ui-game.js', 'manifest.webmanifest', 'icon.svg', 'match.js', 'playsim.js', 'play3d.js', 'stadium3d.js', 'airsim.js', 'air3d.js', 'vehicle3d.js', 'world3d.js', 'fx3d.js', 'airnet.js', 'citysim.js', 'citymap.js', 'assets3d.js', 'citymap-data.js', 'terrain3d.js', 'terrain-data.js', 'cityhome.js', 'cityjobs.js', 'home3d.js', 'fonts/city-latin.woff2', 'fonts/city-jp.woff2', 'symbols-data.js', 'roadmarks3d.js', 'citymodels3d.js', 'post3d.js', 'facade3d.js', 'city3d.js', 'playnet.js', 'net.js', 'ui-net.js', 'push.js', 'vendor/qrcode.js', 'vendor/jsQR.js', 'ui-sky.js',  'cityquest.js', 'citycollect.js', 'citylook.js', 'models/gear/helmet.glb', 'models/gear/cap.glb', 'models/gear/vest.glb', 'models/gear/boot.glb', 'models/gear/goggles.glb', 'models/gear/pistol.glb', 'models/gear/rifle.glb', 'models/gear/shotgun.glb', 'models/gear/sniper.glb', 'citynet.js', 'audio/sfx/bigboom.mp3', 'audio/sfx/boom.mp3', 'audio/sfx/bump.mp3', 'audio/sfx/cash.mp3', 'audio/sfx/click.mp3', 'audio/sfx/coin.mp3', 'audio/sfx/door.mp3', 'audio/sfx/dry.mp3', 'audio/sfx/hit.mp3', 'audio/sfx/hitmark.mp3', 'audio/sfx/jump.mp3', 'audio/sfx/lose.mp3', 'audio/sfx/missile.mp3', 'audio/sfx/reload.mp3', 'audio/sfx/shot_pistol.mp3', 'audio/sfx/shot_rifle.mp3', 'audio/sfx/shot_sg.mp3', 'audio/sfx/shot_smg.mp3', 'audio/sfx/shot_sniper.mp3', 'audio/sfx/siren.mp3', 'audio/sfx/sparkle.mp3', 'audio/sfx/spray.mp3', 'audio/sfx/warn.mp3', 'audio/sfx/win.mp3', 'audio/bgm/city.mp3', 'audio/bgm/defense.mp3', 'audio/bgm/home.mp3', 'audio/bgm/wanted.mp3', 'weaponicons.js', 'textures/icons/armor.webp', 'textures/icons/assault.webp', 'textures/icons/assaultsg.webp', 'textures/icons/bat.webp', 'textures/icons/bsuit.webp', 'textures/icons/cap.webp', 'textures/icons/carbine.webp', 'textures/icons/crowbar.webp', 'textures/icons/goggle.webp', 'textures/icons/hammer.webp', 'textures/icons/headset.webp', 'textures/icons/heavypistol.webp', 'textures/icons/heavyrifle.webp', 'textures/icons/heavysniper.webp', 'textures/icons/hmask.webp', 'textures/icons/hoodie.webp', 'textures/icons/jersey.webp', 'textures/icons/knife.webp', 'textures/icons/fist.webp', 'textures/icons/lightning.webp', 'textures/icons/machete.webp', 'textures/icons/mg.webp', 'textures/icons/pistol.webp', 'textures/icons/pump.webp', 'textures/icons/revolver.webp', 'textures/icons/rider.webp', 'textures/icons/rocket.webp', 'textures/icons/runner.webp', 'textures/icons/sawedoff.webp', 'textures/icons/smg.webp', 'textures/icons/sneaker.webp', 'textures/icons/sniper.webp', 'textures/icons/spike.webp', 'textures/icons/tactical.webp', 'textures/icons/turbo.webp', 'textures/icons/u_boots.webp', 'textures/icons/u_helm.webp', 'textures/icons/u_suit.webp', 'textures/icons/vest.webp', 'textures/icons/visor.webp', 'textures/outfit/camo.jpg', 'textures/outfit/navy.jpg', 'textures/outfit/mesh.jpg', 'textures/outfit/hero.jpg', 'textures/outfit/denim.jpg', 'textures/outfit/gold.jpg', 'vendor/three.module.min.js'];
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
