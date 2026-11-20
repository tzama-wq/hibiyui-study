// ちけい(こうていさ): 国土地理院の DEM から つくった グリッド(terrain-data.js)を、ぜんぶの ものの たかさに はんえいする。
//  ・JS: terrainH(x,z) … カメラなどの たかさ
//  ・シェーダ: すべての マテリアルの ちょうてんを「その ばしょの ちけいの たかさ」ぶん もちあげる(ちいさい ぶったいは たてに ずれるだけ)
//  ・じめんは ほうせんを ちけいの こうばいから つくり、ひかげで おかが みえる
import { TERRAIN } from './terrain-data.js';
import { AIRFIELD, HOME, PLAZA, MALL_TRESA, MALL_APITA, SOCCER_ZONE, RIVER, riverDist, roadsOf } from './citymap.js';

export const EXAG = 0.9; // おかの たかさの ばいりつ
const DEFORM_CAP = 15; // おかの さいだかの めやす(m): ゲームが あそびにくく ならない ように おさえる
const N = TERRAIN.n; const R = TERRAIN.range; const STEP = (2 * R) / (N - 1);
const grid = new Float32Array(N * N);
{
  const bin = atob(TERRAIN.data); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const dv = new DataView(u8.buffer);
  const base = 1.0; // かわの たかさ(ASL m)
  // デフォルメ: ひらたい ていちは ほぼ たいらに・おかだけ ゆるやかに もりあげ(さいだか CAP)・なみうつ ちいさな おうとつは ぼかして けす
  const blur = (arr, passes) => { let cur = arr; for (let p = 0; p < passes; p++) { const nx = new Float32Array(cur); for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) nx[j * N + i] = (cur[j * N + i] * 4 + cur[(j - 1) * N + i] * 2 + cur[(j + 1) * N + i] * 2 + cur[j * N + i - 1] * 2 + cur[j * N + i + 1] * 2 + cur[(j - 1) * N + i - 1] + cur[(j - 1) * N + i + 1] + cur[(j + 1) * N + i - 1] + cur[(j + 1) * N + i + 1]) / 16; cur = nx; } return cur; };
  const raw = new Float32Array(N * N); for (let i = 0; i < N * N; i++) raw[i] = Math.max(0, dv.getInt16(i * 2, true) / 10 - base);
  const sm = blur(raw, 4); const PLAIN = 3.4; const CAP = DEFORM_CAP;
  for (let i = 0; i < N * N; i++) { const r = sm[i]; const plain = Math.min(r, PLAIN) / PLAIN * 1.2; const t = Math.max(0, r - PLAIN); grid[i] = plain + CAP * (1 - Math.exp((-t * EXAG) / CAP)); }
  grid.set(blur(grid, 2));
  const at = (x, z) => grid[Math.max(0, Math.min(N - 1, Math.round((z + R) / STEP))) * N + Math.max(0, Math.min(N - 1, Math.round((x + R) / STEP)))];
  // かわは ひくく
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * STEP; const z = -R + j * STEP; const d = riverDist(x, z); if (d < RIVER.hw) grid[j * N + i] = 0; else if (d < RIVER.hw + 44) { const w = (d - RIVER.hw) / 44; grid[j * N + i] = Math.min(grid[j * N + i], w * w * (3 - 2 * w) * 1.3); } }
  // はしの まわりは たいらに(はしを わたるとき じめんに うまらない・ゆるやかな ざか)
  { const segD = (px, pz, a, b) => { const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2)); return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t); };
    for (const r of roadsOf()) { if (!r.br) continue; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * STEP; const z = -R + j * STEP; let d = 1e9; for (let k = 1; k < r.pts.length; k++) d = Math.min(d, segD(x, z, r.pts[k - 1], r.pts[k])); const m = r.hw + 34; if (d < m) { const w = d < r.hw + 14 ? 1 : 1 - (d - r.hw - 14) / 20; const q = w * w * (3 - 2 * w); grid[j * N + i] = grid[j * N + i] * (1 - q) + 0.9 * q; } } } }
  // ひろば・じたく・くうこう・モール・サッカーじょうは たいらに ならす
  for (const r of [PLAZA, HOME, AIRFIELD, MALL_TRESA, MALL_APITA, SOCCER_ZONE]) {
    if (!r) continue; const m = 14; let sum = 0; let n = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * STEP; const z = -R + j * STEP; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { sum += grid[j * N + i]; n++; } }
    const mean = n ? sum / n : at((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + i * STEP; const z = -R + j * STEP; const dx = Math.max(r.x0 - x, 0, x - r.x1); const dz = Math.max(r.z0 - z, 0, z - r.z1); const d = Math.hypot(dx, dz); if (d < m) { const w = 1 - d / m; const s = w * w * (3 - 2 * w); grid[j * N + i] = grid[j * N + i] * (1 - s) + mean * s; } }
  }
  grid.set(blur(grid, 2));
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
