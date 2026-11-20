// シティの 外部3Dモデル(Quaternius の CC0 モデル。ひと・くるま)。GLBを よみこんで つかう。よめなければ ぜんぶ じぶんで つくった モデルに もどる。
//   const A = await loadCityAssets(THREE);  A.person(key, opts) / A.car(model, color)
//   モデル: Quaternius (CC0 1.0) via Poly Pizza — Man / Woman Casual / Woman in Dress / Casual Character / SWAT / Taxi / Car / SUV / Sports Car / Police Car / Truck / Pickup
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import * as SkeletonUtils from './vendor/utils/SkeletonUtils.js';
const BASE = './models/city/';
const FILES = ['man', 'swat', 'womancasual', 'womandress', 'casual', 'taxi', 'sedan', 'suv', 'sports', 'police', 'pickup', 'truck'];
const CAR_FILE = { sedan: 'sedan', police: 'police', taxi: 'taxi', suv: 'suv', truck: 'truck', sports: 'sports', super: 'sports' };
const CAR_LEN = { sedan: 4.6, police: 4.8, taxi: 4.6, suv: 4.8, truck: 6.8, sports: 4.4, super: 4.5 };
const BODY_MAT = /^(white|blue|yellow|red|green|black_?body|body|paint|atlas)$/i;

export async function loadCityAssets(THREE) {
  const loader = new GLTFLoader(); const models = {};
  await Promise.all(FILES.map((f) => new Promise((res) => { loader.load(`${BASE}${f}.glb`, (g) => { models[f] = g; res(); }, undefined, () => res()); })));
  if (!models.man && !models.sedan) return null;
  const box = new THREE.Box3(); const v = new THREE.Vector3();
  const prep = (root) => { root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.material) o.material = o.material.clone(); } }); return root; };
  const tint = (root, map) => { if (!map) return; root.traverse((o) => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { const c = map[m.name]; if (c && m.color) m.color.set(c); } }); };
  function person(key, o = {}) {
    const g = models[key]; if (!g) return null;
    const root = prep(SkeletonUtils.clone(g.scene)); tint(root, o.tint);
    root.updateMatrixWorld(true); box.setFromObject(root, true); const h = box.max.y - box.min.y || 1; const sc = (o.height || 1.8) / h; root.scale.setScalar(sc); root.position.y = -box.min.y * sc;
    const wrap = new THREE.Group(); wrap.add(root);
    const mixer = new THREE.AnimationMixer(root); const actions = {};
    for (const clip of g.animations) { const nm = clip.name.split('|').pop().replace(/^(Man|Female)_/, ''); actions[nm] = mixer.clipAction(clip); }
    let cur = null; const play = (name, fade = 0.18, once = false) => { const a = actions[name] || actions.Idle; if (!a || a === cur) return; if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity); a.reset().fadeIn(fade).play(); if (cur) cur.fadeOut(fade); cur = a; };
    let handBone = null; root.traverse((n) => { if (!handBone && n.isBone && /^(wrist|fist|palm|hand).?r(ight)?$|wrist\.?r$|hand\.?r$|fist\.?r$/i.test(n.name)) handBone = n; });
    const hand = new THREE.Group(); if (handBone) { wrap.updateMatrixWorld(true); const ws = new THREE.Vector3(); handBone.getWorldScale(ws); hand.scale.setScalar(1 / (ws.x || 1)); handBone.add(hand); } else wrap.add(hand);
    const t0 = Math.random() * 3; mixer.update(t0);
    wrap.userData = { glb: true, mixer, actions, play, hand, key, sc, get cur() { return cur; } };
    play(actions.Idle ? 'Idle' : Object.keys(actions)[0]);
    return wrap;
  }
  function car(model, color) {
    const file = CAR_FILE[model]; const g = models[file]; if (!g) return null;
    const root = prep(g.scene.clone(true)); box.setFromObject(root); v.set(0, 0, 0);
    // まえ(ヘッドライト)の ほうこうを しらべて +Z に あわせる
    let fx = 0; let fz = 0; let n = 0; root.traverse((o) => { if (o.isMesh && o.material && /headlight/i.test(o.material.name)) { const b = new THREE.Box3().setFromObject(o); b.getCenter(v); fx += v.x; fz += v.z; n++; } });
    const c0 = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()); let ang = 0;
    if (n) { const dx = fx / n - c0.x; const dz = fz / n - c0.z; ang = Math.abs(dz) >= Math.abs(dx) ? (dz >= 0 ? 0 : Math.PI) : (dx >= 0 ? Math.PI / 2 : -Math.PI / 2); } else if (size.x > size.z) ang = Math.PI / 2;
    const wrap = new THREE.Group(); const inner = new THREE.Group(); inner.add(root); inner.rotation.y = ang; wrap.add(inner);
    const b2 = new THREE.Box3().setFromObject(wrap); const len = Math.max(b2.max.z - b2.min.z, 0.001); const s = (CAR_LEN[model] || 4.6) / len; wrap.scale.setScalar(s); const b3 = new THREE.Box3().setFromObject(wrap); const cc = b3.getCenter(new THREE.Vector3()); inner.position.set(-cc.x / s, -b3.min.y / s, -cc.z / s);
    if (color) root.traverse((o) => { if (o.isMesh && o.material && BODY_MAT.test(o.material.name) && o.material.color) o.material.color.set(color); });
    const top = new THREE.Box3().setFromObject(wrap); wrap.userData = { glb: true, topY: top.max.y, halfW: (top.max.x - top.min.x) / 2 };
    return wrap;
  }
  return { ok: true, models, person, car, has: (k) => !!models[k] };
}
