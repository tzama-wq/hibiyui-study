// つまずきの「かせつ」(仮説)を たてて、たしかめて、けっろんを だす。画面(DOM)には さわらない 純粋な ロジック。
//
// 考え方: まちがい = すぐ「弱点」と きめつけない。「まちがえ方」から 原因の かせつを たて、
//         その まちがえ方が もう一度 できる 問題(罠つきの もんだい)で たしかめる。
//   - 罠を えらぶ         → かせつの こんきょ(sup)が ふえる
//   - せいかい を えらぶ   → かせつに はんする しょうこ(ref)が ふえる
//   - ほかの まちがい     → どちらにも かぞえない
//   テスト中(testing): こんきょ 3つで 「ほんとうに よわい(confirmed)」/ 3回れんぞくで 罠を さければ 「たまたま(cleared)」
//   確定(confirmed)  : 3回れんぞくせいかい かつ 2日いじょうに わたれば 「のりこえた(resolved)」
// ※ まちがえた 直後の やりなおし(immediate)は、直前に せつめいを 見たばかりなので、「はんする しょうこ」には かぞえない。

export const THRESH = { confirm: 3, clear: 3, resolveStreak: 3, resolveDays: 2, probesPerDay: 2, maxKeep: 40 };
const GENERIC_TAGS = new Set(['know_mixup']); // どの問題でも おなじ 理由に なる タグ → 「その問題」を かせつの たんいに する
const NO_HYP_TAGS = new Set(['unknown']);     // 「わからない」は かせつに しない(単元ぜんたいの 習熟で あつかう)

export const keyOf = (unit, tag, item) => (item ? `${unit}|item:${item}` : `${unit}|${tag}`);
const plain = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export function observe(p, { unitId, q, choice, ok, today, immediate = false }) {
  p.hyp = p.hyp || {};
  const events = [];
  const tag = !ok && choice ? choice.tag : null;
  // 1) すでに ある かせつ(テスト中・確定)に、この 問題が 手がかりに なるか
  for (const h of Object.values(p.hyp)) {
    if (h.unit !== unitId || !['testing', 'confirmed'].includes(h.status)) continue;
    const present = h.kind === 'item' ? q.id === h.item : (q.choices || []).some((c) => c.tag === h.tag);
    if (!present) continue;
    const trapped = h.kind === 'item' ? !ok : (!ok && tag === h.tag);
    if (trapped) {
      h.sup++; h.streak = 0; h.okDays = [];
    } else if (ok) {
      if (immediate) continue; // 直後の やりなおしは かぞえない
      h.ref++; h.streak++;
      if (!h.okDays.includes(today)) h.okDays.push(today);
    } else continue; // ほかの まちがい: どちらにも かぞえない
    h.last = today; h.seen++;
    settle(h, events);
  }
  // 2) まちがえたら 新しい かせつを たてる(おなじ かせつが なければ)
  if (!ok && choice && tag && !NO_HYP_TAGS.has(tag)) {
    const item = GENERIC_TAGS.has(tag) ? q.id : null;
    const key = keyOf(unitId, tag, item);
    const h = p.hyp[key];
    if (!h) {
      p.hyp[key] = { key, unit: unitId, kind: item ? 'item' : 'tag', tag: item ? null : tag, item: item || null, label: item ? (q.hlabel || plain(q.text).slice(0, 24)) : '', sup: 1, ref: 0, streak: 0, okDays: [], seen: 1, first: today, last: today, status: 'testing', probeDay: null };
      events.push({ type: 'new', h: p.hyp[key] });
    } else if (['cleared', 'resolved'].includes(h.status)) { // いちど おわった かせつが ぶりかえした
      Object.assign(h, { sup: 1, ref: 0, streak: 0, okDays: [], seen: h.seen + 1, last: today, status: 'testing' });
      events.push({ type: 'reopen', h });
    }
  }
  prune(p);
  return events;
}

function settle(h, events) {
  if (h.status === 'testing') {
    if (h.sup >= THRESH.confirm) { h.status = 'confirmed'; events.push({ type: 'confirmed', h }); }
    else if (h.streak >= THRESH.clear) { h.status = 'cleared'; events.push({ type: 'cleared', h }); }
  } else if (h.status === 'confirmed') {
    if (h.streak >= THRESH.resolveStreak && h.okDays.length >= THRESH.resolveDays) { h.status = 'resolved'; events.push({ type: 'resolved', h }); }
  }
}

function prune(p) {
  const all = Object.values(p.hyp);
  if (all.length <= THRESH.maxKeep) return;
  const done = all.filter((h) => ['cleared', 'resolved'].includes(h.status)).sort((a, b) => a.last.localeCompare(b.last));
  for (const h of done.slice(0, all.length - THRESH.maxKeep)) delete p.hyp[h.key];
}

// ---- たしかめる問題の えらびかた -----------------------------------------------------------
export const specFor = (h) => (h.kind === 'item' ? { itemId: h.item } : { tag: h.tag });
export const isActive = (h) => h.status === 'testing' || h.status === 'confirmed';
const score = (h) => (h.status === 'confirmed' ? 1000 : 0) + (h.sup - h.ref) * 10 + (h.last > '' ? Number(h.last.replace(/-/g, '')) / 1e8 : 0);

export function activeList(p) {
  return Object.values(p.hyp || {}).filter(isActive).sort((a, b) => score(b) - score(a));
}
// 1日に おなじ かせつを たしかめる 回数は 2回まで(おなじ ところを ぐりぐり しない)
export function nextProbes(p, today, n = 1, avoid = []) {
  const out = [];
  for (const h of activeList(p)) {
    if (out.length >= n) break;
    if (avoid.includes(h.key)) continue;
    const used = h.probeDay && h.probeDay.date === today ? h.probeDay.n : 0;
    if (used >= THRESH.probesPerDay) continue;
    out.push(h);
  }
  return out;
}
export function noteProbe(p, key, today) {
  const h = (p.hyp || {})[key]; if (!h) return;
  h.probeDay = h.probeDay && h.probeDay.date === today ? { date: today, n: h.probeDay.n + 1 } : { date: today, n: 1 };
}

export function counts(p) {
  const c = { testing: 0, confirmed: 0, cleared: 0, resolved: 0 };
  for (const h of Object.values(p.hyp || {})) c[h.status]++;
  return c;
}
