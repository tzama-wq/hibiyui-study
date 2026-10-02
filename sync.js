// きょうだい間の「ランク・ゴール数」共有。Firebase Realtime Database の REST API を使う(SDK不要・無料枠)。
// 共有するのは name/grade/xp/goals/days/rank だけ。問題や解答履歴は送らない。
// データの場所は /hibiyui/<家族コード>/<こども>.json 。家族コードを知っている人だけが読み書きできる。
const LS = 'hibiyui.sync';
let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(LS)) || {}; } catch { cfg = {}; }

// 子ども用の設定リンク(#db=...&fc=...)を開いたら自動で設定する
try {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('db') && h.get('fc')) {
    cfg = { db: h.get('db'), fc: h.get('fc') };
    localStorage.setItem(LS, JSON.stringify(cfg));
    history.replaceState(null, '', location.pathname + location.search);
  }
} catch { /* 保存できなくても動く */ }

export const getCfg = () => cfg;
export const enabled = () => !!(cfg.db && cfg.fc);
export function setCfg(db, fc) {
  cfg = { db: db.trim(), fc: fc.trim() };
  try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch { /* ignore */ }
}
export const validCfg = (db, fc) => /^https:\/\/[^\s/]+/.test(db.trim()) && /^[A-Za-z0-9_-]{10,}$/.test(fc.trim());
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
export const shareLink = () => `${location.origin}${location.pathname}#${new URLSearchParams({ db: cfg.db, fc: cfg.fc })}`;

const base = () => `${cfg.db.replace(/\/+$/, '')}/hibiyui/${encodeURIComponent(cfg.fc)}`;
async function req(url, opt) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try { return await fetch(url, { ...opt, signal: ac.signal }); } finally { clearTimeout(timer); }
}
export async function push(id, data) {
  if (!enabled()) return false;
  try { return (await req(`${base()}/${id}.json`, { method: 'PUT', body: JSON.stringify({ ...data, t: Date.now() }) })).ok; } catch { return false; }
}
export async function pull() {
  if (!enabled()) return null;
  try {
    const r = await req(`${base()}.json`);
    return r.ok ? (await r.json()) || {} : null;
  } catch { return null; }
}
