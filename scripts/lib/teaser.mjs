// おしらせ(プッシュつうち)に のせる「かんたんな もんだい」を つくる。こたえは つうちに かかない(アプリを ひらくと わかる)。
//   makeTeaser(grade, rnd, knowledgeUnits) → { q, a, b, ans, why, key }   a/b=2つの せんたくし、ans='a'|'b'
const RUBY = /\{([^|{}]+)\|([^{}]+)\}/g;
const plain = (s) => String(s).replace(RUBY, '$1');
const ri = (rnd, a, b) => Math.floor(rnd() * (b - a + 1)) + a;
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// がくねんごとの かんたんな けいさん
function mathQ(grade, rnd) {
  let q; let ans;
  if (grade <= 1) { const a = ri(rnd, 2, 9); const b = ri(rnd, 2, 9); if (rnd() < 0.5 && a + b <= 12) { q = `${a} + ${b} = ?`; ans = a + b; } else { const x = Math.max(a, b); const y = Math.min(a, b); q = `${x} − ${y} = ?`; ans = x - y; } }
  else if (grade === 2) { if (rnd() < 0.6) { const a = ri(rnd, 2, 9); const b = ri(rnd, 2, 9); q = `${a} × ${b} = ?`; ans = a * b; } else { const a = ri(rnd, 20, 60); const b = ri(rnd, 11, 39); q = `${a} + ${b} = ?`; ans = a + b; } }
  else if (grade === 3) { if (rnd() < 0.5) { const a = ri(rnd, 12, 49); const b = ri(rnd, 3, 9); q = `${a} × ${b} = ?`; ans = a * b; } else { const b = ri(rnd, 3, 9); const c = ri(rnd, 4, 12); q = `${b * c} ÷ ${b} = ?`; ans = c; } }
  else { const r = rnd(); if (r < 0.34) { const a = ri(rnd, 12, 35); const b = ri(rnd, 6, 19); q = `${a} × ${b} = ?`; ans = a * b; } else if (r < 0.67) { const b = ri(rnd, 6, 14); const c = ri(rnd, 8, 25); q = `${b * c} ÷ ${b} = ?`; ans = c; } else { const a = ri(rnd, 2, 9); const b = ri(rnd, 2, 9); q = `0.${a} + 0.${b} = ?`; ans = Math.round((a + b)) / 10; } }
  // まちがいの せんたくしは、ありそうな まちがい(ちかい かず)
  const near = [ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, ans - 2].filter((x) => x !== ans && x >= 0);
  const wrong = pick(rnd, near);
  return { q, correct: String(ans), wrong: String(Number.isInteger(wrong) ? wrong : Math.round(wrong * 10) / 10), why: `${q.replace('?', String(ans))}` };
}

// 事実リスト(理科・社会・サッカーなど)から 1もん
function knowQ(units, grade, rnd) {
  const pool = units.filter((u) => u.grade <= grade && ['理科', '社会', '生活', 'サッカー', '英語'].includes(u.subject) && u.items && u.items.length);
  if (!pool.length) return null;
  const u = pick(rnd, pool); const it = pick(rnd, u.items.filter((x) => !x.svg && !x.fig && !x.raw && plain(x.q).length <= 34));
  if (!it) return null;
  return { q: plain(it.q), correct: plain(it.correct), wrong: plain(pick(rnd, it.wrong).label), why: plain(it.why), key: `${u.id}:${it.q}` };
}

export function makeTeaser(grade, rnd = Math.random, units = []) {
  const useKnow = units.length && rnd() < 0.5;
  const t = (useKnow ? knowQ(units, grade, rnd) : null) || mathQ(grade, rnd);
  const swap = rnd() < 0.5;
  return { q: t.q, a: swap ? t.wrong : t.correct, b: swap ? t.correct : t.wrong, ans: swap ? 'b' : 'a', why: t.why || '' };
}

const HOOKS = ['もんだい! わかるかな? 🤔', 'クイズ! こたえは どっち? 👀', 'ちょうせんじょう! とけるかな? 💪', 'かんたん クイズ! 10びょうで こたえて! ⏱'];
const LATE = ['さいごの チャンス! これ とける? 🔥', 'まだ まにあう! ちょっとだけ やろう ⚽', 'あと すこし! こたえ きに ならない? 👀'];
export const titleOf = (slot, rnd = Math.random) => pick(rnd, slot === 'late' ? LATE : HOOKS);
// つうちの ほんぶん。こたえを みたく なる ように「どっち?」の かたちに する
export function notificationOf(kidName, t, slot, rnd = Math.random) {
  return { title: `${titleOf(slot, rnd)}`, body: `${kidName}、${t.q}\nA: ${t.a}   B: ${t.b}\n👉 タップして こたえあわせ!`, data: { q: t.q, a: t.a, b: t.b, ans: t.ans, why: t.why } };
}
// パパへの まとめ(だれが まだか)
export function papaNotification(rows) {
  const miss = rows.filter((r) => !r.did);
  if (!miss.length) return null;
  return { title: '📊 まだ やっていない 子が いるよ', body: `${miss.map((r) => r.name).join('・')} は きょう まだ れんしゅうしていません。\nこえを かけて あげてね(アプリで「みんなの がくしゅう じょうきょう」を ひらけるよ)` };
}
