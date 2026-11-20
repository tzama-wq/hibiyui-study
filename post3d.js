// 3Dの しあげ(ポストプロセス): ブルーム(ひかりの にじみ)・トーンマッピング・いろの ちょうせい・ビネット・フィルムの ざらざら。
//   const post = createPost(THREE, renderer, { grade: {...} });  post.setSize(w, h);  post.render(scene, camera, time);  post.dispose();
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT_FS = `
uniform sampler2D tDiffuse; uniform float threshold; uniform float knee; varying vec2 vUv;
void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float br = max(c.r, max(c.g, c.b)); float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4); float w = max(soft, br - threshold) / max(br, 1e-4); gl_FragColor = vec4(c * w, 1.0); }`;
const BLUR_FS = `
uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main(){ vec4 s = texture2D(tDiffuse, vUv) * 0.2270270270; s += texture2D(tDiffuse, vUv + dir * 1.3846153846) * 0.3162162162; s += texture2D(tDiffuse, vUv - dir * 1.3846153846) * 0.3162162162; s += texture2D(tDiffuse, vUv + dir * 3.2307692308) * 0.0702702703; s += texture2D(tDiffuse, vUv - dir * 3.2307692308) * 0.0702702703; gl_FragColor = s; }`;
const COMP_FS = `
uniform sampler2D tScene; uniform sampler2D tB0; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3;
uniform float exposure; uniform float bloom; uniform float time; uniform float vig; uniform float grain; uniform float sat; uniform float contrast; uniform vec3 shadowTint; uniform vec3 highTint; uniform float ca; uniform vec2 px;
varying vec2 vUv;
vec3 aces(vec3 x){ const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv; vec2 d = uv - 0.5; float r2 = dot(d, d);
  vec2 off = d * ca * r2;
  vec3 col = vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);
  // ちょっと シャープに
  vec3 blur = (texture2D(tScene, uv + vec2(px.x, 0.0)).rgb + texture2D(tScene, uv - vec2(px.x, 0.0)).rgb + texture2D(tScene, uv + vec2(0.0, px.y)).rgb + texture2D(tScene, uv - vec2(0.0, px.y)).rgb) * 0.25;
  col += (col - blur) * 0.35;
  vec3 bl = texture2D(tB0, uv).rgb * 0.5 + texture2D(tB1, uv).rgb * 0.6 + texture2D(tB2, uv).rgb * 0.7 + texture2D(tB3, uv).rgb * 0.8;
  col += bl * bloom;
  col *= exposure;
  col = aces(col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col * shadowTint, col * highTint, smoothstep(0.1, 0.8, l));
  col = mix(vec3(l), col, sat);
  col = (col - 0.5) * contrast + 0.5;
  col *= 1.0 - vig * smoothstep(0.18, 0.62, r2 * 1.6);
  col += (hash(uv * 900.0 + time) - 0.5) * grain;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  gl_FragColor = linearToOutputTexel(gl_FragColor);
}`;

export function createPost(THREE, renderer, o = {}) {
  const g = { exposure: 1.1, bloom: 0.38, threshold: 1.0, knee: 0.5, vig: 0.55, grain: 0.035, sat: 1.08, contrast: 1.07, ca: 0.0016, shadowTint: [0.97, 1.0, 1.04], highTint: [1.08, 1.0, 0.9], ...(o.grade || {}) };
  const gl2 = renderer.capabilities.isWebGL2;
  const ok = gl2;
  const type = THREE.HalfFloatType;
  const mkRT = (w, h, samples = 0) => new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: samples > 0, samples });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); const sc = new THREE.Scene(); sc.add(quad);
  const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  const mBright = mat(BRIGHT_FS, { tDiffuse: { value: null }, threshold: { value: g.threshold }, knee: { value: g.knee } });
  const mBlur = mat(BLUR_FS, { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } });
  const mComp = mat(COMP_FS, { tScene: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, exposure: { value: g.exposure }, bloom: { value: g.bloom }, time: { value: 0 }, vig: { value: g.vig }, grain: { value: g.grain }, sat: { value: g.sat }, contrast: { value: g.contrast }, shadowTint: { value: new THREE.Vector3(...g.shadowTint) }, highTint: { value: new THREE.Vector3(...g.highTint) }, ca: { value: g.ca }, px: { value: new THREE.Vector2(1 / 1024, 1 / 576) } });
  let rtScene = null; let levels = []; let W = 0; let H = 0; const N = 4;
  const run = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam); };
  function setSize(w, h) {
    W = Math.max(2, Math.floor(w)); H = Math.max(2, Math.floor(h)); if (rtScene) rtScene.dispose(); for (const l of levels) { l.a.dispose(); l.b.dispose(); }
    rtScene = mkRT(W, H, gl2 ? 4 : 0); levels = []; let lw = W >> 1; let lh = H >> 1; for (let i = 0; i < N; i++) { levels.push({ a: mkRT(lw, lh), b: mkRT(lw, lh), w: lw, h: lh }); lw >>= 1; lh >>= 1; }
    mComp.uniforms.px.value.set(1 / W, 1 / H);
  }
  function render(scene, camera, time = 0) {
    const prevTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
    mBright.uniforms.tDiffuse.value = rtScene.texture; run(mBright, levels[0].a);
    for (let i = 0; i < N; i++) {
      const L = levels[i]; if (i > 0) { mBlur.uniforms.tDiffuse.value = levels[i - 1].a.texture; mBlur.uniforms.dir.value.set(0, 0); run(mBlur, L.a); }
      mBlur.uniforms.tDiffuse.value = L.a.texture; mBlur.uniforms.dir.value.set(1 / L.w, 0); run(mBlur, L.b);
      mBlur.uniforms.tDiffuse.value = L.b.texture; mBlur.uniforms.dir.value.set(0, 1 / L.h); run(mBlur, L.a);
      mBlur.uniforms.tDiffuse.value = L.a.texture; mBlur.uniforms.dir.value.set(1 / L.w * 2, 0); run(mBlur, L.b);
      mBlur.uniforms.tDiffuse.value = L.b.texture; mBlur.uniforms.dir.value.set(0, 1 / L.h * 2); run(mBlur, L.a);
    }
    const u = mComp.uniforms; u.tScene.value = rtScene.texture; u.tB0.value = levels[0].a.texture; u.tB1.value = levels[1].a.texture; u.tB2.value = levels[2].a.texture; u.tB3.value = levels[3].a.texture; u.time.value = time % 100;
    renderer.toneMapping = THREE.NoToneMapping; run(mComp, null); renderer.toneMapping = prevTM;
  }
  function dispose() { if (rtScene) rtScene.dispose(); for (const l of levels) { l.a.dispose(); l.b.dispose(); } mBright.dispose(); mBlur.dispose(); mComp.dispose(); quad.geometry.dispose(); }
  return { setSize, render, dispose, grade: g, uniforms: mComp.uniforms, ok };
}
