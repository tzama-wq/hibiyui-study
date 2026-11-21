// シティの 外部3Dモデル(Quaternius の CC0 モデル。ひと・くるま)。GLBを よみこんで つかう。よめなければ ぜんぶ じぶんで つくった モデルに もどる。
//   const A = await loadCityAssets(THREE);  A.person(key, opts) / A.car(model, color)
//   モデル: Quaternius (CC0 1.0) via Poly Pizza — Man / Woman Casual / Woman in Dress / Casual Character / SWAT / Taxi / Car / SUV / Sports Car / Police Car / Truck / Pickup
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import * as SkeletonUtils from './vendor/utils/SkeletonUtils.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
const BASE = './models/city/';
const FILES = ['man', 'swat', 'womancasual', 'womandress', 'casual', 'taxi', 'sedan', 'suv', 'sports', 'police', 'pickup', 'truck', 'bk_a', 'bk_b', 'bk_c', 'bk_d', 'kn_large1', 'kn_large2', 'kn_large3', 'kn_large4', 'kn_large5', 'kn_small', 'kn_sky1', 'kn_sky2', 'nt_pine', 'nt_tree2', 'nt_tree3', 'nt_tree4', 'nt_bush1', 'nt_bushf', 'nt_hedge', 'lm_torii', 'lm_bkshop1', 'lm_bkshop2', 'lm_station'];
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
    // ないクリップは にた どうさで おぎなう(おとこのこ・おんなのこは はしる/ねらう どうさが すくない)
    const alias = (to, from) => { if (!actions[to] && actions[from]) actions[to] = actions[from]; };
    ['Run_Shoot', 'Run_Left', 'Run_Right', 'Run_Back'].forEach((n) => alias(n, 'Run')); alias('Punch_Right', 'Punch'); alias('Punch_Left', 'Punch'); alias('Sword_Slash', 'SwordSlash');
     ['Idle_Gun', 'Idle_Gun_Pointing', 'Idle_Gun_Shoot', 'Idle_Neutral', 'Interact', 'Wave'].forEach((n) => alias(n, 'Idle'));
    let cur = null; const play = (name, fade = 0.18, once = false) => { const a = actions[name] || actions.Idle; if (!a || a === cur) return; if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity); a.reset().fadeIn(fade).play(); if (cur) cur.fadeOut(fade); cur = a; };
    let handBone = null; root.traverse((n) => { if (!handBone && n.isBone && /^(wrist|fist|palm|hand).?r(ight)?$|wrist\.?r$|hand\.?r$|fist\.?r$/i.test(n.name)) handBone = n; });
    const hand = new THREE.Group(); if (handBone) { wrap.updateMatrixWorld(true); const ws = new THREE.Vector3(); handBone.getWorldScale(ws); hand.scale.setScalar(1 / (ws.x || 1)); handBone.add(hand); } else wrap.add(hand);
    if (handBone) { const pose = actions.Idle_Gun_Pointing || actions.Run_Shoot || actions.Idle; if (pose) { pose.reset().play(); mixer.update(0); wrap.updateMatrixWorld(true); const qb = new THREE.Quaternion(); handBone.getWorldQuaternion(qb); hand.quaternion.copy(qb).invert(); pose.stop(); } }
    const t0 = Math.random() * 3; mixer.update(t0);
    const findBone = (re) => { let b = null; root.traverse((n) => { if (!b && n.isBone && re.test(n.name)) b = n; }); return b; };
    const rig = { noGun: !g.animations.some((c) => /Idle_Gun_Pointing/.test(c.name)), armR: findBone(/^upperarm\.?r$/i), foreR: findBone(/^lowerarm\.?r$/i), armL: findBone(/^upperarm\.?l$/i), foreL: findBone(/^lowerarm\.?l$/i), torso: findBone(/^torso$/i) };
    wrap.userData = { glb: true, mixer, actions, play, hand, handBone, key, sc, rig, get cur() { return cur; } };
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
  const kits = {};
  function kit(key) { // たてものの パーツ(ジオメトリ・マテリアル・いち)と おおきさ
    if (kits[key]) return kits[key]; const g = models[key]; if (!g) return null; g.scene.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(g.scene); const parts = []; g.scene.traverse((o) => { if (o.isMesh) parts.push({ geo: o.geometry, mat: o.material, m4: o.matrixWorld.clone() }); });
    return (kits[key] = { parts, size: bx.getSize(new THREE.Vector3()), center: bx.getCenter(new THREE.Vector3()), minY: bx.min.y });
  }
  // ランドマーク用の たてもの/かざり: w×d×h(m)に あわせて おおきさを そろえ、ゆかに ぴったり おく(メッシュが おおい ものは まとめて かるく する)
  function prop(key, o = {}) {
    const g = models[key]; if (!g) return null; const root = g.scene.clone(true); root.updateMatrixWorld(true); let n = 0; root.traverse((x) => { if (x.isMesh) n++; });
    let obj = root;
    if (n > 20) { try { const by = new Map(); root.traverse((x) => { if (!x.isMesh) return; let geo = x.geometry.clone(); geo.applyMatrix4(x.matrixWorld); for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); if (geo.index) geo = geo.toNonIndexed(); const m = Array.isArray(x.material) ? x.material[0] : x.material; if (!by.has(m)) by.set(m, []); by.get(m).push(geo); }); const grp = new THREE.Group(); for (const [m, list] of by) { const mg = mergeGeometries(list, false); if (mg) grp.add(new THREE.Mesh(mg, m)); } if (grp.children.length) obj = grp; } catch { obj = root; } }
    obj.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; } });
    const bx = new THREE.Box3().setFromObject(obj); const size = bx.getSize(new THREE.Vector3()); const c = bx.getCenter(new THREE.Vector3()); const su = o.s || 1;
    const sx = o.w ? o.w / size.x : su; const sz = o.d ? o.d / size.z : su; const sy = o.h ? o.h / size.y : Math.min(sx, sz);
    const inner = new THREE.Group(); inner.add(obj); inner.scale.set(sx, sy, sz); inner.position.set(-c.x * sx, -bx.min.y * sy, -c.z * sz); const wrap = new THREE.Group(); wrap.add(inner); wrap.rotation.y = o.yaw || 0; return wrap;
  }
  return { ok: true, models, person, car, kit, prop, retint: tint, has: (k) => !!models[k] };
}
