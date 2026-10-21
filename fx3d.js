// 地球防衛隊の エフェクト(ばくはつ・けむり・ひばな)。ポイントスプライトを 1かいの かきこみで まとめて かく。
const VS = `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(size * scale / max(1.0, -mv.z), 0.0, 400.0); gl_Position = projectionMatrix * mv; }`;
const FS = `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.15, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`;

export function makeParticles(THREE, max, additive) {
  const pos = new Float32Array(max * 3); const col = new Float32Array(max * 3); const size = new Float32Array(max); const alpha = new Float32Array(max);
  const P = Array.from({ length: max }, () => ({ on: false, age: 0, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, c0: [1, 1, 1], c1: [1, 1, 1], drag: 0, g: 0, a0: 1 }));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { scale: { value: 400 } } });
  const mesh = new THREE.Points(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = additive ? 11 : 10;
  let cursor = 0; const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  return {
    mesh, mat,
    spawn(o) {
      const p = P[cursor]; cursor = (cursor + 1) % max; p.on = true; p.age = 0; p.life = o.life; p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.s0 = o.s0; p.s1 = o.s1 == null ? o.s0 : o.s1; p.c0 = hex(o.c0); p.c1 = hex(o.c1 || o.c0); p.drag = o.drag || 0; p.g = o.g || 0; p.a0 = o.a == null ? 1 : o.a;
    },
    update(dt, scale) {
      mat.uniforms.scale.value = scale;
      for (let i = 0; i < max; i++) {
        const p = P[i];
        if (!p.on) { alpha[i] = 0; size[i] = 0; continue; }
        p.age += dt; if (p.age >= p.life) { p.on = false; alpha[i] = 0; size[i] = 0; continue; }
        const k = p.age / p.life; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy = p.vy * dr - p.g * dt; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; size[i] = p.s0 + (p.s1 - p.s0) * k; alpha[i] = p.a0 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        col[i * 3] = p.c0[0] + (p.c1[0] - p.c0[0]) * k; col[i * 3 + 1] = p.c0[1] + (p.c1[1] - p.c0[1]) * k; col[i * 3 + 2] = p.c0[2] + (p.c1[2] - p.c0[2]) * k;
      }
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = geo.attributes.alpha.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// ---- つかいやすい かたち ----------------------------------------------------------------
export function makeFx(THREE, scene) {
  const fire = makeParticles(THREE, 700, true); const smoke = makeParticles(THREE, 900, false); scene.add(fire.mesh, smoke.mesh);
  const rnd = (a, b) => a + Math.random() * (b - a); const sph = (r) => { const u = Math.random() * 2 - 1; const t = Math.random() * 6.283; const s = Math.sqrt(1 - u * u); return [s * Math.cos(t) * r, u * r, s * Math.sin(t) * r]; };
  return {
    explode(x, y, z, r = 10, big = false) {
      const R = r * (big ? 1.6 : 1);
      fire.spawn({ x, y, z, life: 0.16, s0: R * 3.2, s1: R * 4.2, c0: '#fff6c0', c1: '#ffd060', a: 0.9 });
      for (let i = 0; i < (big ? 36 : 18); i++) { const v = sph(R * rnd(1.2, 3.2)); fire.spawn({ x, y, z, vx: v[0], vy: v[1], vz: v[2], drag: 2.2, life: rnd(0.45, 0.9), s0: R * rnd(1.0, 1.8), s1: R * rnd(2.0, 3.4), c0: '#ffe08a', c1: '#c8400a', a: 0.7 }); }
      for (let i = 0; i < (big ? 26 : 12); i++) { const v = sph(R * rnd(0.8, 2.2)); smoke.spawn({ x, y, z, vx: v[0], vy: v[1] + R * 0.8, vz: v[2], drag: 1.4, life: rnd(1.2, 2.2), s0: R * rnd(1, 1.6), s1: R * rnd(3, 5), c0: '#4a4a52', c1: '#8a8a94', a: 0.7, g: -R * 0.15 }); }
      for (let i = 0; i < (big ? 24 : 12); i++) { const v = sph(R * rnd(4, 9)); fire.spawn({ x, y, z, vx: v[0], vy: v[1], vz: v[2], drag: 0.6, g: R * 2, life: rnd(0.4, 0.9), s0: R * 0.5, s1: R * 0.15, c0: '#fff2a0', c1: '#ff7a20', a: 1 }); }
    },
    spark(x, y, z, r = 5) { for (let i = 0; i < 7; i++) { const v = sph(r * rnd(3, 7)); fire.spawn({ x, y, z, vx: v[0], vy: v[1], vz: v[2], drag: 3, life: rnd(0.15, 0.35), s0: r * 0.7, s1: r * 0.1, c0: '#fff7a8', c1: '#ff9a30', a: 1 }); } fire.spawn({ x, y, z, life: 0.1, s0: r * 3, s1: r * 4, c0: '#fff7c0', a: 0.8 }); },
    puff(x, y, z, s = 3, life = 0.9, dark = false) { smoke.spawn({ x: x + rnd(-0.5, 0.5), y: y + rnd(-0.5, 0.5), z: z + rnd(-0.5, 0.5), vy: 1.5, life, s0: s, s1: s * 3.2, c0: dark ? '#3a3a40' : '#f2f4f8', c1: dark ? '#6a6a72' : '#c7ccd6', a: dark ? 0.7 : 0.55, drag: 1 }); },
    flame(x, y, z, s = 3) { fire.spawn({ x, y, z, life: 0.22, s0: s, s1: s * 0.3, c0: '#ffe9a0', c1: '#ff5a10', a: 0.9 }); },
    splash(x, z, s = 5) { for (let i = 0; i < 10; i++) smoke.spawn({ x, y: 0.5, z, vx: rnd(-1, 1) * s * 2, vy: rnd(2, 5) * s, vz: rnd(-1, 1) * s * 2, g: s * 9, drag: 0.5, life: rnd(0.5, 0.9), s0: s * 0.6, s1: s * 1.4, c0: '#ffffff', c1: '#cfe9ff', a: 0.8 }); },
    update(dt, scale) { fire.update(dt, scale); smoke.update(dt, scale); },
    dispose() { fire.dispose(); smoke.dispose(); },
  };
}
