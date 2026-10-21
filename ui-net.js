// ローカル つうしんの つなぎがめん(ホスト/ゲスト・QR・コード)。サッカーと 地球防衛隊 きょうつう。
import { hostOffer, guestJoin, qrSvg, scanQr } from './net.js';

const esc = (s) => String(s).replace(/[<>&"]/g, '');
let cleanup = null;

export function closeModal() { if (cleanup) { try { cleanup(); } catch { /* ok */ } cleanup = null; } document.querySelectorAll('.netm').forEach((e) => e.remove()); }
export function modal(html, onClose) {
  closeModal(); const el = document.createElement('div'); el.className = 'netm';
  el.innerHTML = `<div class="netbox">${html}</div>`; document.body.appendChild(el); cleanup = onClose || null; return el.querySelector('.netbox');
}
const copy = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };

// ペアリング: つながったら onConn(conn, role) 。やめたら onCancel()
export function pairUI({ title, onConn, onCancel }) {
  let scanStop = null; let pending = null; let done = false;
  const stopAll = () => { if (scanStop) { scanStop(); scanStop = null; } if (pending && pending.cancel && !done) pending.cancel(); };
  const cancel = () => { stopAll(); closeModal(); if (onCancel) onCancel(); };
  const bindCancel = (box) => box.querySelectorAll('[data-n=cancel]').forEach((b) => b.addEventListener('click', cancel));
  const connected = (conn, role) => { done = true; stopAll(); if (onConn) onConn(conn, role); };

  function top() {
    stopAll(); const box = modal(`<h3>${esc(title)}</h3><p class="muted">おなじ Wi-Fi に つないだ 2だいで あそべるよ。</p>
      <button class="btn gold" data-n="host">📣 さそう(ホスト)</button><button class="btn" data-n="guest">🙋 さそいを うける(ゲスト)</button><button class="btn gray" data-n="cancel">やめる</button>`, stopAll);
    bindCancel(box); box.querySelector('[data-n=host]').addEventListener('click', host); box.querySelector('[data-n=guest]').addEventListener('click', guest);
  }
  async function host() {
    const box = modal(`<h3>📣 さそう</h3><p class="muted">じゅんびちゅう…</p>`, stopAll); let h;
    try { h = await hostOffer(); } catch (e) { box.innerHTML = `<p>つうしんの じゅんびが できなかったよ(${esc(e.message)})</p><button class="btn gray" data-n="back">もどる</button>`; box.querySelector('[data-n=back]').addEventListener('click', top); return; }
    pending = h; const svg = await qrSvg(h.code, 230).catch(() => '');
    box.innerHTML = `<h3>📣 さそう</h3><p><b>1.</b> あいての スマホに この QRを よみとって もらおう</p><div class="qrbox">${svg}</div>
      <div class="row"><button class="btn small gray" data-n="copy">📋 コードを コピー</button></div>
      <p><b>2.</b> あいてに でた「へんじ」の QRを よみとる</p><video class="scanv" hidden muted></video>
      <div class="row"><button class="btn gold" data-n="scan">📷 カメラで よみとる</button></div>
      <details><summary class="muted">コードで つなぐ(QRが よめない とき)</summary><textarea class="codein" rows="3" placeholder="あいての へんじコードを ここに はる"></textarea><button class="btn small" data-n="go">つなぐ</button></details>
      <div class="netst muted"></div><button class="btn gray" data-n="cancel">やめる</button>`;
    bindCancel(box); const st = box.querySelector('.netst');
    box.querySelector('[data-n=copy]').addEventListener('click', async () => { st.textContent = (await copy(h.code)) ? 'コピーしたよ' : 'コピーできなかったよ'; });
    const go = async (code) => { st.textContent = 'つないでいるよ…'; try { const conn = await h.finish(code); connected(conn, 'host'); } catch (e) { st.textContent = `つながらなかったよ: ${e.message}`; } };
    box.querySelector('[data-n=go]').addEventListener('click', () => go(box.querySelector('.codein').value));
    box.querySelector('[data-n=scan]').addEventListener('click', () => { const v = box.querySelector('.scanv'); v.hidden = false; scanStop = scanQr(v, (t, err) => { v.hidden = true; if (t) go(t); else st.textContent = `カメラが つかえなかったよ(${err ? esc(err.message) : ''})`; }); });
  }
  async function guest() {
    const box = modal(`<h3>🙋 さそいを うける</h3><p><b>1.</b> ホストの スマホの QRを よみとろう</p><video class="scanv" hidden muted></video>
      <div class="row"><button class="btn gold" data-n="scan">📷 カメラで よみとる</button></div>
      <details><summary class="muted">コードで つなぐ</summary><textarea class="codein" rows="3" placeholder="ホストの コードを ここに はる"></textarea><button class="btn small" data-n="go">これで つなぐ</button></details>
      <div class="netst muted"></div><button class="btn gray" data-n="cancel">やめる</button>`, stopAll);
    bindCancel(box); const st = box.querySelector('.netst');
    const go = async (code) => {
      st.textContent = 'じゅんびちゅう…'; let g;
      try { g = await guestJoin(code); } catch (e) { st.textContent = `よめなかったよ: ${e.message}`; return; }
      pending = g; const svg = await qrSvg(g.code, 230).catch(() => '');
      box.innerHTML = `<h3>🙋 さそいを うける</h3><p><b>2.</b> この「へんじ」の QRを ホストに よみとって もらおう</p><div class="qrbox">${svg}</div>
        <div class="row"><button class="btn small gray" data-n="copy">📋 コードを コピー</button></div><div class="netst muted">ホストが よみとるのを まっているよ…</div><button class="btn gray" data-n="cancel">やめる</button>`;
      bindCancel(box); box.querySelector('[data-n=copy]').addEventListener('click', async () => { box.querySelector('.netst').textContent = (await copy(g.code)) ? 'コピーしたよ' : 'コピーできなかったよ'; });
      try { const conn = await g.ready; connected(conn, 'guest'); } catch (e) { const s2 = box.querySelector('.netst'); if (s2) s2.textContent = `つながらなかったよ: ${e.message}`; }
    };
    box.querySelector('[data-n=go]').addEventListener('click', () => go(box.querySelector('.codein').value));
    box.querySelector('[data-n=scan]').addEventListener('click', () => { const v = box.querySelector('.scanv'); v.hidden = false; scanStop = scanQr(v, (t, err) => { v.hidden = true; if (t) go(t); else st.textContent = `カメラが つかえなかったよ(${err ? esc(err.message) : ''})`; }); });
  }
  top();
  return { cancel };
}
