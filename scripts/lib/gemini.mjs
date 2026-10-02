// Gemini API(REST)の薄いクライアント。APIキーは環境変数 GEMINI_API_KEY から読む(コードやリポジトリに書かない)。
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// モデル名は変わりやすいので、GEMINI_MODEL があればそれ、なければ使えるモデルから安定版の flash を選ぶ。
export async function pickModel(key) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    const { models = [] } = await r.json();
    const cands = models
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .map((n) => ({ n, m: n.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/) }))
      .filter((x) => x.m)
      .map((x) => ({ n: x.n, v: parseFloat(x.m[1]), lite: !!x.m[2] }))
      .sort((a, b) => b.v - a.v || a.lite - b.lite);
    if (cands.length) return cands[0].n;
  } catch {
    /* 下の既定値へ */
  }
  return 'gemini-2.5-flash';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeGen(key, model) {
  return async function gen(prompt, schema) {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, responseMimeType: 'application/json', responseSchema: schema },
    };
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const r = await fetch(`${BASE}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        });
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error(`HTTP ${r.status}`);
          await sleep(5000 * 3 ** attempt);
          continue;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
        const j = await r.json();
        const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        return JSON.parse(text);
      } catch (e) {
        lastErr = e;
        if (/^HTTP 4/.test(String(e.message))) throw e;
        await sleep(3000);
      }
    }
    throw lastErr;
  };
}
