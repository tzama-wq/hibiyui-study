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
    // 地球防衛隊
    gun: () => { noise(0.05, 0.07, { freq: 1800 }); tone(220, 0.04, { to: 120, type: 'square', v: 0.025 }); },
    missile: () => { noise(0.35, 0.1, { type: 'bandpass', freq: 1200 }); tone(300, 0.3, { to: 900, type: 'sawtooth', v: 0.04 }); },
    boom: () => { noise(0.3, 0.14, { type: 'lowpass', freq: 700 }); tone(110, 0.25, { to: 40, type: 'sawtooth', v: 0.08 }); },
    bigboom: () => { noise(0.9, 0.18, { type: 'lowpass', freq: 500 }); tone(90, 0.8, { to: 30, type: 'sawtooth', v: 0.1 }); },
    hit: () => { tone(160, 0.12, { to: 70, type: 'square', v: 0.06 }); noise(0.1, 0.1, { freq: 600 }); },
    basehit: () => { tone(120, 0.25, { to: 50, type: 'sawtooth', v: 0.07 }); },
    warn: () => { tone(880, 0.12, { v: 0.04 }); tone(660, 0.12, { at: 0.14, v: 0.04 }); },
    evade: () => tone(700, 0.12, { to: 1200, v: 0.03 }),
    spark: () => tone(1500, 0.05, { v: 0.02 }),
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { at: i * 0.12, v: 0.05 })); },
    lose: () => { [392, 330, 262].forEach((f, i) => tone(f, 0.25, { at: i * 0.18, type: 'triangle', v: 0.05 })); },
    // ぶきごとの はっぽうおん(おもい・かるい・ながい よいん)
    shot_pistol: () => { noise(0.07, 0.2, { freq: 1500 }); tone(190, 0.1, { to: 60, type: 'square', v: 0.09 }); noise(0.2, 0.06, { type: 'lowpass', freq: 900, at: 0.03 }); },
    shot_smg: () => { noise(0.04, 0.15, { freq: 2300 }); tone(250, 0.05, { to: 120, type: 'square', v: 0.06 }); },
    shot_sg: () => { noise(0.28, 0.26, { type: 'lowpass', freq: 1500 }); tone(95, 0.24, { to: 38, type: 'sawtooth', v: 0.14 }); noise(0.1, 0.18, { freq: 3200 }); noise(0.3, 0.07, { type: 'lowpass', freq: 600, at: 0.08 }); },
    shot_rifle: () => { noise(0.09, 0.2, { freq: 1800 }); tone(150, 0.13, { to: 55, type: 'sawtooth', v: 0.1 }); noise(0.24, 0.07, { type: 'lowpass', freq: 800, at: 0.04 }); },
    shot_sniper: () => { noise(0.15, 0.27, { freq: 1200 }); tone(110, 0.32, { to: 34, type: 'sawtooth', v: 0.16 }); noise(0.7, 0.08, { type: 'lowpass', freq: 500, at: 0.05 }); },
    reload: () => { tone(300, 0.04, { type: 'square', v: 0.04 }); tone(520, 0.05, { at: 0.22, type: 'square', v: 0.04 }); noise(0.05, 0.07, { at: 0.45, freq: 3000 }); },
    dry: () => tone(1200, 0.03, { type: 'square', v: 0.035 }),
    hitmark: () => { tone(1700, 0.04, { type: 'triangle', v: 0.05 }); tone(2300, 0.05, { at: 0.04, type: 'triangle', v: 0.035 }); },
    jump: () => tone(380, 0.09, { to: 640, type: 'triangle', v: 0.03 }),
    // シティ
    click: () => tone(880, 0.04, { type: 'triangle', v: 0.03 }),
    cash: () => { tone(1320, 0.06, { v: 0.035 }); tone(1760, 0.12, { at: 0.06, v: 0.035 }); },
    door: () => { tone(200, 0.07, { to: 120, type: 'triangle', v: 0.05 }); noise(0.06, 0.05, { freq: 500, type: 'lowpass' }); },
    siren: () => { tone(700, 0.28, { to: 960, type: 'sawtooth', v: 0.03 }); tone(960, 0.28, { at: 0.28, to: 700, type: 'sawtooth', v: 0.03 }); },
    spray: () => noise(0.4, 0.05, { freq: 2600, type: 'highpass' }),
    sparkle: () => { [1318, 1568, 2093].forEach((f, i) => tone(f, 0.1, { at: i * 0.05, v: 0.03 })); },
  };
  // ---- シティの BGM(WebAudioで ライブで つくる。ファイルなし・けんりの しんぱい なし) ----
  const THEMES = {
    city: { bpm: 108, root: 261.63, wave: 'triangle', prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 0], arp: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, 3, 2, -1], kick: [0, 8], snare: [], hat: [2, 6, 10, 14], lead: [0, null, 4, null, 7, null, 4, null, 9, null, 7, null, 4, null, 2, null, 5, null, 9, null, 12, null, 9, null, 7, null, 4, null, 2, null, 0, null] },
    wanted: { bpm: 146, root: 220, wave: 'sawtooth', prog: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]], bass: [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 2, 1], arp: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 0, 1, 2, 1], kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], lead: null },
    home: { bpm: 74, root: 261.63, wave: 'sine', prog: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], bass: [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0], arp: [0, -1, -1, 1, -1, -1, 2, -1, -1, 3, -1, -1, 2, -1, 1, -1], kick: [], snare: [], hat: [], lead: null },
    defense: { bpm: 128, root: 233.08, wave: 'square', prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], bass: [1, 0, 1, 1, 0, 1, 0, 2, 1, 0, 1, 1, 0, 2, 2, 0], arp: [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 2, -1, 1, -1, 3, 2], kick: [0, 4, 8, 10, 12], snare: [4, 12], hat: [2, 6, 10, 14], lead: [0, null, null, 7, null, 5, null, 3, 0, null, null, 7, null, 10, null, 12] },
  };
  let theme = null; let fileEl = null; let fileTimer = null;
  // フリー素材(CC0)の BGM ファイル(audio/LICENSE.txt)。ないテーマは じさくの シンセで なる
  const FILES = { city: './audio/04_glass_maze.ogg', home: './audio/05_moss_garden.ogg' };
  const stopFile = () => { clearInterval(fileTimer); fileTimer = null; if (fileEl) { try { fileEl.pause(); } catch { /* ignore */ } fileEl = null; } };
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
    bgmStop() { clearInterval(bgmTimer); bgmTimer = null; theme = null; stopFile(); },
    // シティの BGM: 'city' | 'wanted' | 'home' | 'defense' | null(とめる)
    bgmTheme(name) {
      if (theme === name) return; theme = name; clearInterval(bgmTimer); bgmTimer = null; stopFile(); const T = THEMES[name]; if (!T) return;
      if (FILES[name]) { try { const el = new Audio(FILES[name]); el.loop = true; el.volume = 0.4; fileEl = el; fileTimer = setInterval(() => { if (isQuiet()) el.pause(); else if (el.paused) el.play().catch(() => {}); }, 700); el.play().catch(() => {}); return; } catch { fileEl = null; } } let st = 0; const ms = 60000 / T.bpm / 4; const dur = ms / 1000;
      bgmTimer = setInterval(() => {
        if (isQuiet()) return;
        try {
          const bar = Math.floor(st / 16) % T.prog.length; const s = st % 16; const ch = T.prog[bar]; const f = (semi) => T.root * 2 ** (semi / 12);
          const b = T.bass[s]; if (b) tone(f((b === 2 ? ch[2] : ch[0]) - 12), dur * 1.9, { type: 'triangle', v: 0.03 });
          const a = T.arp[s]; if (a >= 0) tone(f(ch[a % 3] + (a >= 3 ? 12 : 0)), dur * 1.5, { type: T.wave, v: 0.011 });
          if (T.kick.includes(s)) tone(130, 0.08, { to: 48, type: 'triangle', v: 0.05 }); if (T.snare.includes(s)) noise(0.08, 0.05, { freq: 1500 }); if (T.hat.includes(s)) noise(0.025, 0.018, { freq: 6500 });
          if (T.lead) { const m = T.lead[st % T.lead.length]; if (m != null) tone(f(m + 12 + ch[0]), dur * 2.2, { type: 'square', v: 0.0085 }); }
          st++;
        } catch { /* ignore */ }
      }, ms);
    },
  };
}
