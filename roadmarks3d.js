// どうろの ひょうしき・ペイント: ちゅうおうせん・ていしせん・「止まれ」・おうだんほどう・どうろひょうしき
// すべて InstancedMesh(かるい)。たかさは ちけい(terrain3d)の シェーダが じどうで あわせる。
export function buildRoadMarks(THREE, roads, opts = {}) {
  const hw = (r) => r.hw; const asph = (r) => r.hw - (r.cls >= 2 ? 1.7 : 0.9); // アスファルトの はんぶんの はば
  const g = new THREE.Group(); g.name = 'roadmarks';
  const white = []; const yellow = []; const textM = []; const poles = []; const signs = { stop: [], speed: [], walk: [] };
  const J = []; // こうさてん
  // ---- こうさてんを みつける(みちの はしが ほかの みちの ちょうてんに ちかい) ----
  const cell = 6; const hash = new Map(); const key = (x, z) => Math.floor(x / cell) * 100003 + Math.floor(z / cell);
  roads.forEach((r, ri) => r.pts.forEach((p, vi) => { const k = key(p[0], p[1]); if (!hash.has(k)) hash.set(k, []); hash.get(k).push([ri, vi]); }));
  const near = (x, z, rad) => { const out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = hash.get(key(x + i * cell, z + j * cell)); if (l) for (const [ri, vi] of l) { const p = roads[ri].pts[vi]; if (Math.hypot(p[0] - x, p[1] - z) <= rad) out.push([ri, vi]); } } return out; };
  const dirAlong = (r, vi, step) => { // その ちょうてんから step(+1/-1) の ほうへ 10m いったところの むき
    let acc = 0; let px = r.pts[vi][0]; let pz = r.pts[vi][1]; let i = vi; let len = 0;
    while (true) { const ni = i + step; if (ni < 0 || ni >= r.pts.length) break; const q = r.pts[ni]; const d = Math.hypot(q[0] - px, q[1] - pz); acc += d; len += d; px = q[0]; pz = q[1]; i = ni; if (acc >= 10) break; }
    const dx = px - r.pts[vi][0]; const dz = pz - r.pts[vi][1]; const L = Math.hypot(dx, dz); return L < 1 ? null : { x: dx / L, z: dz / L, len: acc + (step > 0 ? r.cum ? 0 : 0 : 0) };
  };
  const used = new Set();
  roads.forEach((r, ri) => {
    if (r.br) return;
    for (const vi of [0, r.pts.length - 1]) {
      if (used.has(ri * 100000 + vi)) continue; const c = r.pts[vi]; const nb = near(c[0], c[1], 3.5).filter(([rj]) => rj !== ri && !roads[rj].br); if (!nb.length) continue;
      const arms = []; const addArm = (rr, v, step) => { const d = dirAlong(rr, v, step); if (d) arms.push({ r: rr, d, cls: rr.cls, hw: rr.hw }); used.add(roads.indexOf(rr) * 100000 + v); };
      const addVert = (rr, v) => { if (v === 0) addArm(rr, v, 1); else if (v === rr.pts.length - 1) addArm(rr, v, -1); else { addArm(rr, v, 1); addArm(rr, v, -1); } };
      addVert(r, vi); const seen = new Set([ri]); for (const [rj, vj] of nb) { if (seen.has(rj)) continue; seen.add(rj); addVert(roads[rj], vj); }
      if (arms.length >= 3) J.push({ x: c[0], z: c[1], arms });
    }
  });
  const jgrid = new Map(); J.forEach((j) => { const k = key(j.x, j.z); if (!jgrid.has(k)) jgrid.set(k, []); jgrid.get(k).push(j); });
  const nearJ = (x, z, rad) => { for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) { const l = jgrid.get(key(x + i * cell, z + k * cell)); if (l) for (const j of l) if (Math.hypot(j.x - x, j.z - z) < rad) return true; } return false; };
  // ---- こうさてんの ペイント・ひょうしき ----
  for (const j of J) {
    const maxCls = Math.max(...j.arms.map((a) => a.cls)); const R = Math.max(...j.arms.map((a) => a.hw)) + 1.8;
    for (const a of j.arms) {
      const d = a.d; const lx = d.z; const lz = -d.x; const yaw = Math.atan2(d.x, d.z); const A = asph(a.r); const major = a.cls >= 2; const minor = a.cls < maxCls || a.cls <= 1;
      const at = (dist, lat) => [j.x + d.x * dist + lx * lat, j.z + d.z * dist + lz * lat];
      if (a.cls >= 1) { // おうだんほどう
        const n = Math.floor((2 * A - 0.6) / 1.0); for (let i = 0; i < n; i++) { const lat = -A + 0.5 + 0.5 + i * 1.0; const [x, z] = at(R - 1.0, lat); white.push([x, z, yaw, 0.5, 3.0]); }
      }
      const sl = at(R + 1.7, major ? A / 2 : 0); white.push([sl[0], sl[1], yaw, major ? A - 0.4 : 2 * A - 0.4, 0.45]);
      if (minor) { const tp = at(R + 5.6, major ? A / 2 : 0); textM.push([tp[0], tp[1], yaw]); const sp = at(R + 2.2, A + 0.9 + 0.7); poles.push([sp[0], sp[1]]); signs.stop.push([sp[0], sp[1], yaw]); }
      else if (a.cls >= 2) { const sp = at(R - 1.0, -(A + 0.9 + 0.7)); poles.push([sp[0], sp[1]]); signs.walk.push([sp[0], sp[1], yaw]); }
    }
  }
  // ---- ちゅうおうせん ----
  for (const r of roads) {
    if (r.cls < 2) continue; let carry = 0; const solid = r.cls >= 3;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]; const b = r.pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue; const dx = (b[0] - a[0]) / L; const dz = (b[1] - a[1]) / L; const yaw = Math.atan2(dx, dz); const step = solid ? 3.8 : 9; const seg = solid ? 4.0 : 3.0;
      for (let s = carry; s < L; s += step) { const x = a[0] + dx * (s + seg / 2); const z = a[1] + dz * (s + seg / 2); if (s + seg > L + 0.5) { carry = s + step - L; break; } if (!nearJ(x, z, r.hw + 4)) (solid ? yellow : white).push([x, z, yaw, solid ? 0.2 : 0.15, seg]); carry = 0; }
      carry = Math.max(0, carry - 0);
    }
  }
  // ---- 30キロの ひょうしき(ほそい みち) ----
  for (const r of roads) {
    if (r.cls > 1 || r.br) continue; let acc = 60 + (r.pts[0][0] * 7 % 40);
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]; const b = r.pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue; const dx = (b[0] - a[0]) / L; const dz = (b[1] - a[1]) / L; let s = 0;
      while (acc <= L - s) { s += acc; acc = 170; const x = a[0] + dx * s - dz * (r.hw + 1.6); const z = a[1] + dz * s + dx * (r.hw + 1.6); if (nearJ(x, z, 16)) continue; poles.push([x, z]); signs.speed.push([x, z, Math.atan2(dx, dz)]); }
      acc -= (L - s);
    }
  }
  // ---- メッシュ ----
  const dummy = new THREE.Object3D();
  const paint = (list, color, y) => {
    if (!list.length) return; const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.03, 1), new THREE.MeshLambertMaterial({ color, emissive: '#6a6a64', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), list.length);
    list.forEach(([x, z, yaw, w, l], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(w, 1, l); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; g.add(m);
  };
  paint(white, '#ecece6', 0.12); paint(yellow, '#f0bf22', 0.12);
  const tex = (draw, w = 256, h = 256) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  if (textM.length) { // 路面の「止まれ」
    const t = tex((x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#ecece6'; x.font = 'bold 150px CityLatin, CityJP, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.save(); x.translate(w / 2, h / 2); x.scale(0.78, 1.7); x.fillText('止', 0, -62); x.fillText('ま', 0, 0); x.fillText('れ', 0, 62); x.restore(); }, 256, 512);
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 4.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), textM.length);
    textM.forEach(([x, z, yaw], i) => { dummy.position.set(x, 0.15, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), yaw); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; g.add(m);
  }
  if (poles.length) { const geo = new THREE.CylinderGeometry(0.045, 0.05, 2.6, 6); geo.translate(0, 1.3, 0); const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#9aa0a8' }), poles.length); poles.forEach(([x, z], i) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; g.add(m); }
  const signTex = {
    stop: () => tex((x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(8, 22); x.lineTo(w - 8, 22); x.lineTo(w / 2, h - 12); x.closePath(); x.fill(); x.fillStyle = '#d4181f'; x.beginPath(); x.moveTo(34, 40); x.lineTo(w - 34, 40); x.lineTo(w / 2, h - 52); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 54px CityLatin, CityJP, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('止まれ', w / 2, 88); }),
    speed: () => tex((x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#d4181f'; x.beginPath(); x.arc(w / 2, h / 2, 120, 0, 6.283); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2, h / 2, 92, 0, 6.283); x.fill(); x.fillStyle = '#111'; x.font = 'bold 100px CityLatin, CityJP, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('30', w / 2, h / 2 + 6); }),
    walk: () => tex((x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#1b5fc4'; x.fillRect(20, 20, w - 40, h - 40); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(w / 2, 36); x.lineTo(w - 44, h - 44); x.lineTo(44, h - 44); x.closePath(); x.fill(); x.fillStyle = '#111'; x.font = '110px CityLatin, CityJP, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🚶', w / 2, h / 2 + 34); }),
  };
  for (const [name, list] of Object.entries(signs)) {
    if (!list.length) continue; const geo = new THREE.PlaneGeometry(0.85, 0.85); geo.translate(0, 2.25, 0); const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: signTex[name](), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), list.length);
    list.forEach(([x, z, yaw], i) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; g.add(m);
  }
  g.userData = { pos: J.map((j) => [Math.round(j.x), Math.round(j.z), j.arms.length]), junctions: J.length, white: white.length, yellow: yellow.length, stops: signs.stop.length, walks: signs.walk.length, speeds: signs.speed.length, texts: textM.length };
  return g;
}
