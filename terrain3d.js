// ちけい(こうていさ): 国土地理院の DEM から つくった グリッド(terrain-data.js)を、ぜんぶの ものの たかさに はんえいする。
//  ・JS: terrainH(x,z) … カメラなどの たかさ
//  ・シェーダ: すべての マテリアルの ちょうてんを「その ばしょの ちけいの たかさ」ぶん もちあげる(ちいさい ぶったいは たてに ずれるだけ)
//  ・じめんは ほうせんを ちけいの こうばいから つくり、ひかげで おかが みえる
import { TERRAIN } from './terrain-data.js';
import { AIRFIELD, HOME, PLAZA, MALL_TRESA, MALL_APITA, SOCCER_ZONE, RIVER, riverDist, isWater } from './citymap.js';

export const EXAG = 1.8; // たかさの ばいりつ(すこし おおげさに)
const N = TERRAIN.n; const R = TERRAIN.range; const STEP = (2 * R) / (N - 1);
const grid = new Float32Array(N * N);
{
  const bin = atob(TERRAIN.data); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const dv = new DataView(u8.buffer);
  const base = 1.0; // かわの たかさ(ASL m)
  for (let i = 0; i < N * N; i++) grid[i] = Math.max(0, dv.getInt16(i * 2, true) / 10 - base) * EXAG;
  const at = (x, z) => grid[Math.max(0, Math.min(N - 1, Math.round((z + R) / STEP))) * N + Math.max(0, Math.min(N - 1, Math.round((x + R) / STEP)))];
  // かわは ひくく
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * STEP; const z = -R + j * STEP; const d = riverDist(x, z); if (d < RIVER.hw) grid[j * N + i] = 0; else if (d < RIVER.hw + 22) { const w = (d - RIVER.hw) / 22; grid[j * N + i] = Math.min(grid[j * N + i], 0.6 + w * 4); } }
  // ひろば・じたく・くうこう・モール・サッカーじょうは たいらに ならす
  for (const r of [PLAZA, HOME, AIRFIELD, MALL_TRESA, MALL_APITA, SOCCER_ZONE]) {
    if (!r) continue; const m = 14; let sum = 0; let n = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * STEP; const z = -R + j * STEP; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { sum += grid[j * N + i]; n++; } }
    const mean = n ? sum / n : at((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * STEP; const z = -R + j * STEP; const dx = Math.max(r.x0 - x, 0, x - r.x1); const dz = Math.max(r.z0 - z, 0, z - r.z1); const d = Math.hypot(dx, dz); if (d < m) { const w = 1 - d / m; const s = w * w * (3 - 2 * w); grid[j * N + i] = grid[j * N + i] * (1 - s) + mean * s; } }
  }
}
export const terrainH = (x, z) => {
  const fx = Math.max(0, Math.min(N - 1.001, (x + R) / STEP)); const fz = Math.max(0, Math.min(N - 1.001, (z + R) / STEP)); const i = Math.floor(fx); const j = Math.floor(fz); const u = fx - i; const v = fz - j;
  const a = grid[j * N + i]; const b = grid[j * N + i + 1]; const c = grid[(j + 1) * N + i]; const d = grid[(j + 1) * N + i + 1];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
};
export const TERRAIN_MAX = (() => { let m = 0; for (const v of grid) if (v > m) m = v; return m; })();

const GLSL_FN = `
uniform sampler2D uTerr; uniform vec3 uTerrP;
float terrTap(float i, float j){ return texture2D(uTerr, (vec2(i, j) + 0.5) / uTerrP.y).r; }
float terrH(vec2 p){
  vec2 f = clamp((p + uTerrP.x) / uTerrP.z, vec2(0.0), vec2(uTerrP.y - 1.001));
  vec2 i0 = floor(f); vec2 t = f - i0;
  float a = terrTap(i0.x, i0.y); float b = terrTap(i0.x + 1.0, i0.y); float c = terrTap(i0.x, i0.y + 1.0); float d = terrTap(i0.x + 1.0, i0.y + 1.0);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
`;
export function installTerrain(THREE) {
  const data = new Float32Array(grid); const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.FloatType); tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const U = { uTerr: { value: tex }, uTerrP: { value: new THREE.Vector3(R, N, STEP) } };
  const LIFT = `
    vec4 tw_ = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      tw_ = instanceMatrix * tw_;
    #endif
    tw_ = modelMatrix * tw_;
    mvPosition.xyz += (viewMatrix * vec4(0.0, terrH(tw_.xz), 0.0, 0.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  `;
  const patch = (shader) => {
    const vs = shader.vertexShader;
    if (vs.includes('#include <project_vertex>')) { shader.vertexShader = GLSL_FN + vs.replace('#include <project_vertex>', '#include <project_vertex>\n' + LIFT); }
    else if (vs.includes('vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );')) { shader.vertexShader = GLSL_FN + vs.replace('vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );', 'vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ); { vec4 sw_ = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0); mvPosition.xyz += (viewMatrix * vec4(0.0, terrH(sw_.xz), 0.0, 0.0)).xyz; }'); }
    else return;
    shader.uniforms.uTerr = U.uTerr; shader.uniforms.uTerrP = U.uTerrP;
  };
  THREE.Material.prototype.onBeforeCompile = patch;
  // じめん: ほうせんを ちけいから つくる(おかの ひかげ)
  const groundNormal = (material) => {
    material.onBeforeCompile = (shader) => {
      patch(shader); if (!shader.uniforms.uTerr) return;
      shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        { vec4 gw_ = modelMatrix * vec4(position, 1.0); float e_ = uTerrP.z; float hx_ = terrH(gw_.xz + vec2(e_, 0.0)) - terrH(gw_.xz - vec2(e_, 0.0)); float hz_ = terrH(gw_.xz + vec2(0.0, e_)) - terrH(gw_.xz - vec2(0.0, e_)); vec3 nw_ = normalize(vec3(-hx_ / (2.0 * e_), 1.0, -hz_ / (2.0 * e_))); transformedNormal = normalize((viewMatrix * vec4(nw_, 0.0)).xyz); }`);
    };
    material.customProgramCacheKey = () => 'terrain-ground';
  };
  return { groundNormal, uniforms: U };
}
