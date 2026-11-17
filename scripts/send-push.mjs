// 「まだ やってない 子」に プッシュつうち(かんたんな もんだい)を おくる。GitHub Actions(.github/workflows/push-reminder.yml)から うごく。
//   ひつような ひみつ(GitHub の Settings → Secrets): FIREBASE_DB(データベースの URL) / FAMILY_CODE(かぞくコード) / VAPID_PRIVATE_KEY
//   つかいかた: node scripts/send-push.mjs <first|late|papa> [--dry]    (dry=おくらず ようすだけ ひょうじ)
import { readFile } from 'node:fs/promises';
import { makeTeaser, notificationOf, papaNotification } from './lib/teaser.mjs';

const slot = ['first', 'late', 'papa'].includes(process.argv[2]) ? process.argv[2] : 'first';
const DRY = process.argv.includes('--dry');
const { FIREBASE_DB, FAMILY_CODE, VAPID_PRIVATE_KEY } = process.env;
const cfg = JSON.parse(await readFile(new URL('../data/push-config.json', import.meta.url), 'utf8'));
const KIDS = { hibito: { name: 'ひびと', grade: 4 }, yuito: { name: 'ゆいと', grade: 2 }, papa: { name: 'パパ', grade: 4 } };

if (!FIREBASE_DB || !FAMILY_CODE) { console.log('FIREBASE_DB / FAMILY_CODE が ありません(Secrets を せっていしてね)。なにも おくりません。'); process.exit(0); }
if (!DRY && !VAPID_PRIVATE_KEY) { console.log('VAPID_PRIVATE_KEY が ありません。なにも おくりません。'); process.exit(0); }

const jst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const today = jst();
const res = await fetch(`${FIREBASE_DB.replace(/\/+$/, '')}/hibiyui/${encodeURIComponent(FAMILY_CODE)}.json`);
if (!res.ok) { console.error(`データを よめません: ${res.status}`); process.exit(1); }
const data = (await res.json()) || {};
const units = (JSON.parse(await readFile(new URL('../data/knowledge.json', import.meta.url), 'utf8')).units) || [];

const did = (r) => !!r && ((r.learn && r.learn.last === today) || (r.recent || []).includes(today));
const rows = Object.keys(KIDS).map((id) => ({ id, ...KIDS[id], rec: data[id] || null })).map((r) => ({ ...r, did: did(r.rec) }));
console.log(`today(JST)=${today} slot=${slot}`, rows.map((r) => `${r.name}:${r.did ? 'やった' : 'まだ'}${r.rec && r.rec.push ? '(つうちOK)' : ''}`).join(' '));

let webpush = null;
if (!DRY) { webpush = (await import('web-push')).default; webpush.setVapidDetails('https://github.com/tzama-wq/hibiyui-study', cfg.publicKey, VAPID_PRIVATE_KEY); }
const send = async (sub, payload, label) => {
  if (DRY) { console.log(`[dry] ${label}:`, JSON.stringify(payload)); return; }
  try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3 * 3600 }); console.log(`おくった: ${label}`); } catch (e) { console.log(`しっぱい ${label}: ${e.statusCode || ''} ${e.body || e.message}`); }
};

if (slot === 'papa') {
  const n = papaNotification(rows.filter((r) => !r.id.startsWith('papa')));
  const papa = data.papa;
  if (n && papa && papa.push) await send(papa.push, { ...n, url: './', tag: 'hibiyui-papa' }, 'パパ');
  else console.log(n ? 'パパの スマホは つうちが OK じゃ ないので おくりません' : 'みんな やったので パパには おくりません');
} else {
  for (const r of rows) {
    if (r.did || !r.rec || !r.rec.push) continue;
    const t = makeTeaser(r.grade, Math.random, units); const n = notificationOf(r.name, t, slot);
    const q = Buffer.from(JSON.stringify({ ...n.data, kid: r.id }), 'utf8').toString('base64url');
    await send(r.rec.push, { title: n.title, body: n.body, url: `./?t=${q}`, tag: 'hibiyui-remind' }, r.name);
  }
}
