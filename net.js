// ローカル通信(WebRTC・サーバーなし)。おなじ Wi-Fi の 2だい を「コード」(QR か コピー)で つなぐ。
//   ホスト: const h = await hostOffer();  h.code を みせる → あいてが かえした コードを  const conn = await h.finish(answerCode)
//   ゲスト: const g = await guestJoin(offerCode);  g.code(へんじ)を みせる → const conn = await g.ready
//   conn: { send(obj), fast(obj), on(fn), onClose(fn), close(), isOpen() }   メッセージは JSONの オブジェクト
const RTC = { iceServers: [] }; // STUNなし = おなじ ネットワークの なかだけ

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (t) => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function pipe(u8, S) { const r = new Response(new Blob([u8]).stream().pipeThrough(S)); return new Uint8Array(await r.arrayBuffer()); }
export async function packCode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return `r.${b64(raw)}`;
  return `z.${b64(await pipe(raw, new CompressionStream('deflate-raw')))}`;
}
export async function unpackCode(code) {
  const c = String(code || '').trim().replace(/\s+/g, ''); const [k, body] = [c.slice(0, 1), c.slice(2)];
  if (c[1] !== '.' || !body) throw new Error('コードが ただしく ないよ');
  const u = unb64(body);
  const raw = k === 'z' ? await pipe(u, new DecompressionStream('deflate-raw')) : u;
  return JSON.parse(new TextDecoder().decode(raw));
}

function waitIce(pc, ms = 4000) {
  return new Promise((res) => {
    if (pc.iceGatheringState === 'complete') { res(); return; }
    const t = setTimeout(done, ms); function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', ch); res(); }
    function ch() { if (pc.iceGatheringState === 'complete') done(); }
    pc.addEventListener('icegatheringstatechange', ch);
  });
}

function wrap(pc, chans) {
  const ls = []; const cl = []; let closed = false;
  const fire = () => { if (closed) return; closed = true; cl.forEach((f) => { try { f(); } catch { /* ok */ } }); };
  const feed = (ch) => { ch.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } ls.forEach((f) => f(m)); }; };
  chans.forEach(feed);
  pc.addEventListener('connectionstatechange', () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) fire(); });
  chans.forEach((ch) => { ch.onclose = fire; });
  const [rel, fastCh] = chans;
  return {
    pc, send: (o) => { if (rel.readyState === 'open') rel.send(JSON.stringify(o)); },
    fast: (o) => { const c = fastCh && fastCh.readyState === 'open' ? fastCh : rel; if (c.readyState === 'open') c.send(JSON.stringify(o)); },
    on: (f) => { ls.push(f); }, onClose: (f) => { cl.push(f); }, isOpen: () => !closed && rel.readyState === 'open',
    close: () => { closed = true; try { pc.close(); } catch { /* ok */ } },
  };
}
const opened = (ch, ms = 20000) => new Promise((res, rej) => { if (ch.readyState === 'open') { res(); return; } const t = setTimeout(() => rej(new Error('つながらなかったよ(おなじ Wi-Fi か たしかめてね)')), ms); ch.addEventListener('open', () => { clearTimeout(t); res(); }); });

export async function hostOffer() {
  const pc = new RTCPeerConnection(RTC);
  const rel = pc.createDataChannel('r'); const fast = pc.createDataChannel('f', { ordered: false, maxRetransmits: 0 });
  await pc.setLocalDescription(await pc.createOffer()); await waitIce(pc);
  const code = await packCode({ t: 'o', s: pc.localDescription.sdp });
  return {
    code,
    async finish(answerCode) {
      const a = await unpackCode(answerCode); if (a.t !== 'a') throw new Error('これは へんじの コードじゃ ないよ');
      await pc.setRemoteDescription({ type: 'answer', sdp: a.s }); await Promise.all([opened(rel), opened(fast)]); return wrap(pc, [rel, fast]);
    },
    cancel() { try { pc.close(); } catch { /* ok */ } },
  };
}
export async function guestJoin(offerCode) {
  const o = await unpackCode(offerCode); if (o.t !== 'o') throw new Error('これは さそいの コードじゃ ないよ');
  const pc = new RTCPeerConnection(RTC); const chans = {};
  const got = new Promise((res) => { pc.ondatachannel = (e) => { chans[e.channel.label] = e.channel; if (chans.r && chans.f) res(); }; });
  await pc.setRemoteDescription({ type: 'offer', sdp: o.s }); await pc.setLocalDescription(await pc.createAnswer()); await waitIce(pc);
  const code = await packCode({ t: 'a', s: pc.localDescription.sdp });
  return { code, ready: (async () => { await got; await Promise.all([opened(chans.r), opened(chans.f)]); return wrap(pc, [chans.r, chans.f]); })(), cancel() { try { pc.close(); } catch { /* ok */ } } };
}

// ---- QR(コードの よみとり・ひょうじ) ------------------------------------------------------
const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); });
export async function qrSvg(text, px = 280) {
  if (typeof qrcode === 'undefined') await loadScript('vendor/qrcode.js');
  const q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make(); const n = q.getModuleCount(); const m = 4; const size = n + m * 2; let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + m},${y + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
// カメラで QRを よむ。video に ながして、よめたら テキストを かえす。stop() で とめる
export function scanQr(video, onText) {
  let stop = false; let stream = null;
  const done = () => { stop = true; if (stream) stream.getTracks().forEach((t) => t.stop()); };
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
      if (typeof jsQR === 'undefined') await loadScript('vendor/jsQR.js');
      const cv = document.createElement('canvas'); const g = cv.getContext('2d', { willReadFrequently: true });
      const tick = () => { if (stop) return; if (video.readyState >= 2 && video.videoWidth) { const w = Math.min(720, video.videoWidth); const h = Math.round((video.videoHeight / video.videoWidth) * w); cv.width = w; cv.height = h; g.drawImage(video, 0, 0, w, h); const r = jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); if (r && r.data) { done(); onText(r.data); return; } } setTimeout(tick, 120); };
      tick();
    } catch (e) { done(); onText(null, e); }
  })();
  return done;
}
