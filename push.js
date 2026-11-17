// プッシュつうちの じゅんび(この スマホで 1かいだけ)。ほんもの の つうちは GitHub Actions が おくる(scripts/send-push.mjs)。
//   サーバーに わたすのは「つうちの おくりさき(subscription)」だけ。家族の きょうゆう データベースの その子の きろくに のせる。
const LS = 'hibiyui.push';
export const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
export const stored = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch { return null; } };
const b64uToU8 = (s) => { const p = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4); const r = atob(p); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
// 'unsupported' | 'denied' | 'on' | 'off'
export function state(kidId) {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const st = stored(); return st && st.kid === kidId && Notification.permission === 'granted' ? 'on' : 'off';
}
export async function enable(kidId) {
  if (!supported()) return { ok: false, reason: 'unsupported' };
  const perm = await Notification.requestPermission(); if (perm !== 'granted') return { ok: false, reason: 'denied' };
  let key; try { key = (await (await fetch('data/push-config.json', { cache: 'no-cache' })).json()).publicKey; } catch { return { ok: false, reason: 'config' }; }
  try {
    const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(key) });
    localStorage.setItem(LS, JSON.stringify({ kid: kidId, sub: sub.toJSON() })); return { ok: true };
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
}
export async function disable() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch { /* ok */ }
  try { localStorage.removeItem(LS); } catch { /* ok */ }
}
// この スマホの その子の おくりさき(きょうゆうする ときに つかう)。なければ undefined
export const subFor = (kidId) => { const st = stored(); return st && st.kid === kidId && st.sub && st.sub.endpoint ? st.sub : undefined; };
// その ばで 見本の つうちを だす(ONに した しゅんかんの かくにん)
export async function preview(title, body) { try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, { body, tag: 'hibiyui-preview' }); return true; } catch { return false; } }
