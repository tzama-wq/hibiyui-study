// Gemini API(REST)の薄いクライアント。APIキーは環境変数 GEMINI_API_KEY から読む(コードやリポジトリに書かない)。
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// つかえる flash 系モデルを、おすすめ順(安定版の新しいもの → lite の新しいもの)に ならべる。
// モデル名は かわりやすいので、GEMINI_MODEL があれば それを先頭にする。
export async function listModels(key) {
  const first = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];
  let found = [];
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    const { models = [] } = await r.json();
    found = models
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .map((n) => ({ n, m: n.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/) }))
      .filter((x) => x.m)
      .map((x) => ({ n: x.n, v: parseFloat(x.m[1]), lite: !!x.m[2] }))
      .sort((a, b) => a.lite - b.lite || b.v - a.v)
      .map((x) => x.n);
  } catch {
    /* 下の既定値へ */
  }
  const out = [...new Set([...first, ...found])];
  return out.length ? out : ['gemini-2.5-flash'];
}
export const pickModel = async (key) => (await listModels(key))[0];

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAITS = [8000, 25000, 60000]; // 混雑(429/5xx)のときの待ち時間。モデルごとに 3回ためす

// models: 使うモデルの じゅんばん。1つめが 混雑で だめなら 次のモデルに きりかえる。
export function makeGen(key, models, opt = {}) {
  const list = Array.isArray(models) ? models : [models];
  const sleep = opt.sleep || defaultSleep;
  const attempts = opt.attempts || WAITS.length;
  return async function gen(prompt, schema) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, responseMimeType: 'application/json', responseSchema: schema },
    };
    let lastErr;
    for (const model of list) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const r = await fetch(`${BASE}/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60000),
          });
          if (r.status === 404) { lastErr = new Error(`HTTP 404 (${model})`); break; } // そのモデルは ない → 次へ
          if (r.status === 429 || r.status >= 500) {
            lastErr = new Error(`HTTP ${r.status} (${model})`);
            if (attempt < attempts - 1) await sleep(WAITS[Math.min(attempt, WAITS.length - 1)] + Math.floor(Math.random() * 3000));
            continue;
          }
          if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`), { fatal: true });
          const j = await r.json();
          const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
          return JSON.parse(text);
        } catch (e) {
          if (e.fatal) throw e; // 400/403 など: 作りなおしても なおらない
          lastErr = e; // タイムアウト・JSONの こわれ など: まって やりなおす
          if (attempt < attempts - 1) await sleep(3000);
        }
      }
      console.warn(`モデル ${model} が だめだった (${lastErr?.message}) → 次のモデルへ`);
    }
    throw lastErr;
  };
}
