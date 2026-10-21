// 地球防衛隊の せかい: そら・うみ(なみ)・しま(ちけい・もり)・きち・くも・とおくの やま。ルールには かんけいしない。
import { BASE_Z, ISLAND } from './airsim.js';

const smooth = (a) => { const t = Math.max(0, Math.min(1, a)); return t * t * (3 - 2 * t); };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi; const u = xf * xf * (3 - 2 * xf); const v = yf * yf * (3 - 2 * yf); return (hash2(xi, yi) * (1 - u) + hash2(xi + 1, yi) * u) * (1 - v) + (hash2(xi, yi + 1) * (1 - u) + hash2(xi + 1, yi + 1) * u) * v; };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;

// しまの たかさ(まんなかの きちの まわりは たいら。そとへ いくほど おかに なって、うみに おちる)
export function heightAt(x, z) {
  const r = Math.hypot(x, z - BASE_Z);
  const land = 1 - smooth((r - (ISLAND - 70)) / 120); // 1=りく 0=うみ
  const hills = smooth((r - 300) / 200) * Math.max(0, fbm(x * 0.0055, z * 0.0055) - 0.28) * 14;
  return land * (0.35 + hills) + (1 - land) * -2.6;
}

const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

const SKY_VS = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FS = `varying vec3 vP; uniform vec3 sunDir; void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(vec3(0.80,0.90,0.98), vec3(0.18,0.44,0.86), pow(h, 0.5)); col = mix(col, vec3(0.86,0.92,0.97), smoothstep(0.12, 0.0, d.y) * 0.7);
  float sd = max(dot(d, sunDir), 0.0); col += vec3(1.0,0.92,0.72) * (pow(sd, 700.0) * 4.0 + pow(sd, 16.0) * 0.30); gl_FragColor = vec4(col, 1.0); }`;
const skyMat = (THREE, sunDir) => new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sunDir: { value: sunDir } } });

const SEA_VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const SEA_FS = `varying vec3 vW; uniform float time; uniform vec3 sunDir; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform vec2 isl; uniform float islR;
void wave(inout vec2 d, vec2 p, vec2 k, float amp, float sp){ float ph = dot(k, p) + time * sp; d += k * amp * cos(ph); }
void main(){
  vec2 p = vW.xz; vec2 d = vec2(0.0);
  wave(d, p, vec2(0.021, 0.013), 0.55, 1.1); wave(d, p, vec2(-0.017, 0.026), 0.45, 1.4); wave(d, p, vec2(0.06, -0.04), 0.22, 2.1); wave(d, p, vec2(-0.09, -0.07), 0.14, 2.8);
  vec3 n = normalize(vec3(-d.x, 1.0, -d.y)); vec3 v = normalize(cameraPosition - vW); float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 r = reflect(-v, n); vec3 sky = mix(vec3(0.82,0.91,0.98), vec3(0.30,0.55,0.92), clamp(r.y, 0.0, 1.0));
  float rr = length(p - isl); float shallow = smoothstep(islR + 520.0, islR + 30.0, rr);
  vec3 deep = vec3(0.03, 0.18, 0.38); vec3 shal = vec3(0.10, 0.58, 0.66); vec3 base = mix(deep, shal, shallow);
  base *= 0.65 + 0.35 * clamp(n.y, 0.0, 1.0);
  float ang = atan(p.y - isl.y, p.x - isl.x); float foam = (1.0 - smoothstep(0.0, 34.0, abs(rr - (islR + 26.0 + sin(time * 0.7 + ang * 9.0) * 9.0)))) * 0.75;
  float crest = smoothstep(0.55, 1.1, length(d)) * 0.25;
  vec3 col = mix(base, sky, fres * 0.8); col += pow(max(dot(reflect(-sunDir, n), v), 0.0), 120.0) * vec3(1.0, 0.95, 0.8) * 1.6; col = mix(col, vec3(1.0), clamp(foam + crest, 0.0, 0.9));
  float dist = length(cameraPosition - vW); col = mix(col, fogColor, smoothstep(fogNear, fogFar, dist)); gl_FragColor = vec4(col, 1.0); }`;

function padTexture(THREE) {
  const [c, g] = cvs(1024, 1024); g.fillStyle = '#3e4552'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3); }
  g.strokeStyle = '#f3f3f3'; g.lineWidth = 10; g.beginPath(); g.arc(512, 512, 470, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#ffd23f'; g.lineWidth = 8; g.setLineDash([36, 26]); g.beginPath(); g.arc(512, 512, 330, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#f3f3f3'; g.lineWidth = 14; g.beginPath(); g.arc(512, 512, 120, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f3f3f3'; g.font = 'bold 150px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 512, 520);
  g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; g.save(); g.translate(512 + Math.cos(a) * 250, 512 + Math.sin(a) * 250); g.rotate(a); g.fillRect(-45, -9, 90, 18); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function cloudTexture(THREE) {
  const [c, g] = cvs(128, 128); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildWorld(THREE, scene, renderer, opts = {}) {
  const shadows = !!opts.shadows; const R = mulberry(7);
  const sunDir = new THREE.Vector3(-0.45, 0.62, -0.35).normalize();
  const horizon = new THREE.Color('#cfe4f5'); scene.background = horizon; scene.fog = new THREE.Fog(horizon, 1200, 7000);
  // かんきょうマップ(きんぞくに そらが うつる)
  try { const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat(THREE, sunDir))); scene.environment = pm.fromScene(es, 0.03, 0.1, 200).texture; scene.environmentIntensity = 0.9; pm.dispose(); } catch { /* ok */ }
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x4a7a55, 0.55));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.3); sun.position.copy(sunDir).multiplyScalar(600); scene.add(sun, sun.target);
  if (shadows) { sun.castShadow = true; const m = opts.mobile ? 1024 : 2048; sun.shadow.mapSize.set(m, m); const sc = sun.shadow.camera; sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300; sc.near = 50; sc.far = 1400; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6; }
  // そら
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 24, 16), skyMat(THREE, sunDir)); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  // うみ
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), new THREE.ShaderMaterial({ vertexShader: SEA_VS, fragmentShader: SEA_FS, uniforms: { time: { value: 0 }, sunDir: { value: sunDir }, fogColor: { value: horizon }, fogNear: { value: 1200 }, fogFar: { value: 7000 }, isl: { value: new THREE.Vector2(0, BASE_Z) }, islR: { value: ISLAND } } }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -1.5; sea.frustumCulled = false; scene.add(sea);
  // しま(ちけい)
  const SZ = (ISLAND + 160) * 2; const seg = opts.mobile ? 80 : 120; const tg = new THREE.PlaneGeometry(SZ, SZ, seg, seg); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position; const col = new Float32Array(pos.count * 3); const c1 = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i) + BASE_Z; const h = heightAt(x, z); pos.setY(i, h); const r = Math.hypot(x, z - BASE_Z); const n = vnoise(x * 0.02, z * 0.02);
    if (h < 0.1) c1.set('#cdbb86'); else if (r > ISLAND - 90 && h < 1.4) c1.set('#e1d09a'); else if (h > 10.5) c1.set('#8d8a82'); else if (h > 7) c1.set('#6f8a58').lerp(new THREE.Color('#8d8a82'), smooth((h - 7) / 3.5)); else c1.set(n > 0.5 ? '#5c9a46' : '#4c8a3c').lerp(new THREE.Color('#3f7a38'), smooth((h - 1.5) / 6));
    if (r < 285) c1.set('#6a8f4c').lerp(new THREE.Color('#5f8a46'), n);
    col[i * 3] = c1.r; col[i * 3 + 1] = c1.g; col[i * 3 + 2] = c1.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.translate(0, 0, BASE_Z); tg.computeVertexNormals();
  const island = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })); island.receiveShadow = true; island.castShadow = shadows; scene.add(island);
  // もり・いわ(インスタンス)
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadows; m.receiveShadow = false; scene.add(m); return m; };
  const NT = opts.mobile ? 160 : 260; const cone = mk(new THREE.ConeGeometry(5.5, 15, 7), new THREE.MeshStandardMaterial({ color: '#2f6a3a', roughness: 0.9 }), NT); const cone2 = mk(new THREE.ConeGeometry(4, 11, 7), new THREE.MeshStandardMaterial({ color: '#3d7d44', roughness: 0.9 }), NT);
  const trunk = mk(new THREE.CylinderGeometry(0.7, 0.9, 5, 5), new THREE.MeshStandardMaterial({ color: '#5a3f2a', roughness: 1 }), NT); const dm = new THREE.Object3D(); let cnt = 0;
  for (let i = 0; i < NT * 4 && cnt < NT; i++) {
    const a = R() * Math.PI * 2; const r = 310 + R() * (ISLAND - 390); const x = Math.cos(a) * r; const z = BASE_Z + Math.sin(a) * r; const h = heightAt(x, z); if (h < 0.8) continue;
    const s = 0.7 + R() * 0.9; dm.position.set(x, h + 2.5 * s, z); dm.scale.set(s, s, s); dm.rotation.y = R() * 6; dm.updateMatrix(); trunk.setMatrixAt(cnt, dm.matrix);
    dm.position.y = h + 10.5 * s; dm.updateMatrix(); cone.setMatrixAt(cnt, dm.matrix); dm.position.y = h + 16 * s; dm.updateMatrix(); cone2.setMatrixAt(cnt, dm.matrix); cnt++;
  }
  for (const m of [cone, cone2, trunk]) m.count = cnt;
  const rock = mk(new THREE.DodecahedronGeometry(6, 0), new THREE.MeshStandardMaterial({ color: '#8a8780', roughness: 1, flatShading: true }), 60); let rc = 0;
  for (let i = 0; i < 300 && rc < 60; i++) { const a = R() * 6.283; const r = 320 + R() * (ISLAND - 380); const x = Math.cos(a) * r; const z = BASE_Z + Math.sin(a) * r; const h = heightAt(x, z); if (h < 0.5) continue; const s = 0.5 + R() * 1.6; dm.position.set(x, h + 1, z); dm.scale.set(s, s * 0.7, s); dm.rotation.set(R(), R() * 6, R()); dm.updateMatrix(); rock.setMatrixAt(rc++, dm.matrix); }
  rock.count = rc;
  // きち(ひこうじょう)
  const base = new THREE.Group(); base.position.set(0, 0, BASE_Z); scene.add(base);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(272, 64), new THREE.MeshStandardMaterial({ map: padTexture(THREE), roughness: 0.92 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.45; pad.receiveShadow = true; base.add(pad);
  const grey = new THREE.MeshStandardMaterial({ color: '#aeb7c6', roughness: 0.6, metalness: 0.25 }); const blue = new THREE.MeshStandardMaterial({ color: '#5a7aa8', roughness: 0.55, metalness: 0.3 }); const white = new THREE.MeshStandardMaterial({ color: '#f1f4fa', roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#232834', roughness: 0.8 }); const red = new THREE.MeshStandardMaterial({ color: '#d8403a', roughness: 0.6 });
  const put = (o, x, z, ry = 0) => { o.position.x = x; o.position.z = z; o.rotation.y = ry; o.traverse((m) => { if (m.isMesh) { m.castShadow = shadows; m.receiveShadow = shadows; } }); base.add(o); return o; };
  const hangar = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(44, 11, 26), blue); b.position.y = 5.5; const roof = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 44, 18), grey); roof.rotation.set(0, 0, Math.PI / 2); roof.position.y = 11; const door = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 0.6), dark); door.position.set(0, 4.8, 13.2); g.add(b, roof, door); return g; };
  const tank = () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 13, 14), white); c.position.y = 6.5; const s = new THREE.Mesh(new THREE.CylinderGeometry(8.05, 8.05, 2.4, 14), red); s.position.y = 8; const t = new THREE.Mesh(new THREE.SphereGeometry(8, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), white); t.position.y = 13; g.add(c, s, t); return g; };
  const hut = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 14), grey); b.position.y = 3; const r = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 16), red); r.position.y = 6.4; g.add(b, r); return g; };
  const N = 16; for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + 0.2; const rad = 222 + (i % 2) * 14; const kind = i % 4; const o = kind === 0 ? hangar() : kind === 2 ? tank() : hut(); put(o, Math.cos(a) * rad, Math.sin(a) * rad, -a + Math.PI / 2); }
  // かんせいとう・レーダー
  const tower = new THREE.Group(); const tw = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 36, 10), white); tw.position.y = 18; const cab = new THREE.Mesh(new THREE.CylinderGeometry(7, 5, 6, 10), new THREE.MeshStandardMaterial({ color: '#7fc8ff', roughness: 0.1, metalness: 0.6, emissive: '#16324a' })); cab.position.y = 39; const cap = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 1.2, 10), dark); cap.position.y = 42.4; tower.add(tw, cab, cap); put(tower, 150, -190);
  const radar = new THREE.Group(); const rp = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 14, 8), grey); rp.position.y = 7; const dishPivot = new THREE.Group(); dishPivot.position.y = 15; const dish = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 10, 0, Math.PI * 2, 0, 0.85), white); dish.rotation.x = Math.PI / 2 - 0.3; dish.material = new THREE.MeshStandardMaterial({ color: '#f1f4fa', roughness: 0.4, side: THREE.DoubleSide }); dishPivot.add(dish); radar.add(rp, dishPivot); put(radar, -170, -160);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 34, 6), white); flagPole.position.y = 17; const flag = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); flag.position.set(7.5, 29, 0); const hi = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), new THREE.MeshBasicMaterial({ color: '#e0302a', side: THREE.DoubleSide })); hi.position.set(7.5, 29, 0.05); const fg = new THREE.Group(); fg.add(flagPole, flag, hi); put(fg, -120, 210);
  // ライト(ひこうじょうの ふち)
  const lampM = new THREE.MeshBasicMaterial({ color: '#fff3b0' }); for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 4), lampM); l.position.set(Math.cos(a) * 262, 1.4, Math.sin(a) * 262); base.add(l); }
  // とおくの やま・しま
  const mtm = new THREE.MeshStandardMaterial({ color: '#3f5f78', roughness: 1, flatShading: true });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + R() * 0.3; const r = 4600 + R() * 1400; const hgt = 500 + R() * 600; const m = new THREE.Mesh(new THREE.ConeGeometry(500 + R() * 500, hgt, 7), mtm); m.position.set(Math.cos(a) * r, hgt / 2 - 30, BASE_Z + Math.sin(a) * r); m.rotation.y = R() * 6; scene.add(m); }
  const isl2 = new THREE.MeshStandardMaterial({ color: '#4f8f46', roughness: 1, flatShading: true }); const sand2 = new THREE.MeshStandardMaterial({ color: '#d9c88f', roughness: 1 });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4; const r = 3500 + R() * 600; const rad = 120 + R() * 120; const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.ConeGeometry(rad, 60 + R() * 60, 9), isl2); m.position.y = 20; const s = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.5, rad * 1.7, 6, 14), sand2); s.position.y = -1; g.add(m, s); g.position.set(Math.cos(a) * r, 0, BASE_Z + Math.sin(a) * r); scene.add(g); }
  // くも
  const cT = cloudTexture(THREE); const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < (opts.mobile ? 26 : 40); i++) {
    const cg = new THREE.Group(); const a = R() * 6.283; const r = 600 + R() * 3600; cg.position.set(Math.cos(a) * r, 430 + R() * 520, BASE_Z + Math.sin(a) * r);
    for (let j = 0; j < 6; j++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cT, transparent: true, opacity: 0.7 + R() * 0.25, depthWrite: false, color: j < 2 ? '#e8eef8' : '#ffffff' })); const s = 260 + R() * 280; sp.scale.set(s * 1.6, s * 0.8, 1); sp.position.set((j - 2.5) * 120 * R() + R() * 80, (R() - 0.5) * 40, (R() - 0.5) * 160); cg.add(sp); }
    clouds.add(cg);
  }
  const water = sea.material.uniforms.time;
  return {
    sun, sea, sky, base, heightAt, radarDish: dishPivot,
    follow(x, y, z) { sky.position.set(x, 0, z); sea.position.x = x; sea.position.z = z; if (shadows) { sun.position.set(x + sunDir.x * 600, sunDir.y * 600, z + sunDir.z * 600); sun.target.position.set(x, 0, z); } },
    update(t) { water.value = t; dishPivot.rotation.y = t * 1.2; flag.rotation.y = Math.sin(t * 2.2) * 0.12; },
  };
}

// そうび プレビューなどで つかう かんきょうマップ
export function envTexture(THREE, renderer) {
  const sunDir = new THREE.Vector3(-0.45, 0.62, -0.35).normalize(); const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat(THREE, sunDir))); const t = pm.fromScene(es, 0.03, 0.1, 200).texture; pm.dispose(); return t;
}
