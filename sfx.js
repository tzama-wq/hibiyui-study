// しあいの こうかおん・BGM(WebAudio で つくる ドットふうの おと。ファイルは つかわない)
// isQuiet() が true の ときは ぜんぶ ならさない(「おと・ふるえを けす」の せってい)
export function createSfx(isQuiet = () => false) {
  let ctx = null; let bgmTimer = null; let step = 0;
  const A = () => {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; }
  };
  const tone = (f, d, o = {}) => {
    const a = A(); if (!a) return;
    const t = a.currentTime + (o.at || 0); const osc = a.createOscillator(); const g = a.createGain();
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.v || 0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(a.destination); osc.start(t); osc.stop(t + d + 0.03);
  };
  const noise = (d, v = 0.08, o = {}) => {
    const a = A(); if (!a) return;
    const t = a.currentTime + (o.at || 0); const n = Math.max(1, Math.floor(a.sampleRate * d));
    const buf = a.createBuffer(1, n, a.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.value = o.freq || 800;
    const g = a.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
  };
  const SOUNDS = {
    kick: () => { noise(0.06, 0.12); tone(150, 0.09, { to: 60, type: 'triangle', v: 0.09 }); },
    pass: () => tone(540, 0.04, { v: 0.022 }),
    tackle: () => { noise(0.14, 0.14, { type: 'lowpass', freq: 900 }); tone(95, 0.14, { to: 45, type: 'sawtooth', v: 0.07 }); },
    save: () => { tone(330, 0.06, { v: 0.05 }); tone(494, 0.1, { at: 0.06, v: 0.05 }); noise(0.05, 0.08); },
    miss: () => tone(240, 0.22, { to: 110, type: 'triangle', v: 0.06 }),
    goal: () => {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { at: i * 0.09, v: 0.055 }));
      tone(1046, 0.4, { at: 0.4, v: 0.05 }); noise(0.9, 0.09, { type: 'lowpass', freq: 1800 }); // かんせい
    },
    whistle: () => { tone(2750, 0.22, { v: 0.035 }); tone(2650, 0.28, { at: 0.2, v: 0.035 }); },
  };
  const MEL = [523, 0, 659, 0, 784, 659, 523, 0, 587, 0, 698, 0, 880, 698, 587, 0]; // ゆるい ドット ふう メロディ
  const BASS = [131, 131, 165, 165, 196, 196, 165, 165];
  return {
    play(name) { if (isQuiet()) return; try { (SOUNDS[name] || (() => {}))(); } catch { /* おとが でなくても うごく */ } },
    bgmStart() {
      if (bgmTimer) return; step = 0;
      bgmTimer = setInterval(() => {
        if (isQuiet()) return;
        try {
          const m = MEL[step % MEL.length]; if (m) tone(m, 0.13, { v: 0.011 });
          if (step % 2 === 0) tone(BASS[(step / 2) % BASS.length], 0.26, { type: 'triangle', v: 0.02 });
          step++;
        } catch { /* ignore */ }
      }, 190);
    },
    bgmStop() { clearInterval(bgmTimer); bgmTimer = null; },
  };
}
