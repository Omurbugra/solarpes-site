import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FEATURES, GROUPS, INDICATORS, HOME_VIEW, DETAIL_MODELS } from './data.js';
import { t, feat, groupName, indicatorLabel, effValue, detailLabel, setLang, onLang, applyStatic } from './i18n.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), glBox = $('gl'), pinsBox = $('pins'), tip = $('tip');
const panel = $('panel'), dock = $('dock');
const isMobile = () => stage.clientWidth < 760;
// Proje sayfasında önlem listesi lacivert kartın içinde durur; boş alan kartın sağ kenarından ölçülür.
const card = $('exCard') ?? dock;
const leftW = () => card.offsetLeft + card.offsetWidth;
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
glBox.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 1200);
// Derinlik hassasiyeti yakın düzleme bağlıdır (çözünürlük ≈ d² / (near · 2²⁴)). Sabit 0.5 m'de 170 m'den
// bakınca ~3 mm aralıklı yüzeyler titriyordu; yakın düzlemi hedefe olan mesafeyle büyütmek bunu ~0.1 mm'ye indirir.
function fitDepthRange(cam, dist) {
  const near = THREE.MathUtils.clamp(dist * 0.12, 0.02, 25);
  const far = Math.max(near * 50, dist * 4 + 300);
  if (Math.abs(cam.near - near) / near > 0.02 || cam.far !== far) {
    cam.near = near; cam.far = far; cam.updateProjectionMatrix();
  }
}
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.minDistance = 8;
controls.maxDistance = 330;
controls.maxPolarAngle = 1.42;
controls.autoRotateSpeed = 0.5;
// Sahne uzun bir sayfanın içinde: tekerlek sayfayı kaydırır, Ctrl/⌘ + tekerlek yakınlaştırır.
// Dokunmatikte dikey kaydırma sayfaya kalır, yatay sürükleme modeli döndürür.
controls.enableZoom = false;
glBox.addEventListener('wheel', (e) => { controls.enableZoom = e.ctrlKey || e.metaKey; }, { capture: true });
renderer.domElement.style.touchAction = 'pan-y';

scene.add(new THREE.HemisphereLight(0xf4f7ff, 0xb9a98c, 1.35));
const sun = new THREE.DirectionalLight(0xfff3e2, 2.6);
sun.position.set(-62, 120, 95);
sun.target.position.set(-7, 0, 16);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(isMobile() ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -78, right: 78, top: 78, bottom: -78, near: 20, far: 320 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);

/* ---------- highlight shader ---------- */
// Her grup (hotspot) kendi uniform'larını taşır; aynı grubun tüm malzemeleri paylaşır.
const hiCol = new THREE.Color(css('--tint') || '#E8A317');
const dimCol = new THREE.Color();
function readDim() { dimCol.set(css('--sky2') || '#E9EDE6'); }
readDim();
const state = {};      // key -> { hi:{value}, dim:{value}, hiT, dimT, meshes:[], box }
function groupState(key) {
  return state[key] ??= { hi: { value: 0 }, dim: { value: 0 }, hiT: 0, dimT: 0, meshes: [], box: new THREE.Box3() };
}

/* ---------- zemin kesiti ---------- */
// Zemin yalıtımı seçilince binanın güneybatı köşesi bir kutuyla kesilir; döşeme katmanları (ground grubu,
// kırpılmaz) kenarından görünür. Kutunun alt kotu yukarıdan aşağı iner. Kesilen katıların arka yüzleri düz
// dolguyla boyanır ve ~1 cm geriye itilir: böylece aynı düzlemdeki komşu yüzeylerle z-fighting (titreme)
// olmaz. Bu kod yalnızca SP_CUT tanımı açıkken derlenir; normal çizimde maliyeti yoktur.
const CUT_BOX = { min: new THREE.Vector3(-39.5, -0.64, 25.5), max: new THREE.Vector3(-21, 40, 41.5), start: 16 };
const cutUniforms = {
  uBoxMin: { value: CUT_BOX.min.clone() }, uBoxMax: { value: CUT_BOX.max.clone() },
  uCapCol: { value: new THREE.Color('#4b504d') },
};
const CUT_VERT_HEAD = '#ifdef SP_CUT\nvarying vec3 vCutPos;\n#endif';
const CUT_VERT = '#ifdef SP_CUT\nvCutPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif';
const CUT_FRAG_HEAD = `#ifdef SP_CUT
  varying vec3 vCutPos; uniform vec3 uBoxMin; uniform vec3 uBoxMax; uniform vec3 uCapCol;
#endif`;
const CUT_DISCARD = `#ifdef SP_CUT
  if (all(greaterThan(vCutPos, uBoxMin)) && all(lessThan(vCutPos, uBoxMax))) discard;
#endif`;
const CUT_CAP = `#ifdef SP_CUT
  if (!gl_FrontFacing) {
    vec3 q = max(uBoxMin - vCutPos, vCutPos - uBoxMax);
    if (length(max(q, 0.0)) < 0.9) gl_FragColor.rgb = uCapCol;
    vec3 vp = -vViewPosition * (1.0 + 0.01 / length(vViewPosition));
    vec4 cp = cutProj * vec4(vp, 1.0);
    gl_FragDepth = (cp.z / cp.w) * 0.5 + 0.5;
  } else {
    gl_FragDepth = gl_FragCoord.z;
  }
#endif`;
function patchVertex(sh) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n${CUT_VERT_HEAD}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${CUT_VERT}`);
}
// Gölge haritası da aynı kutuyla kırpılsın (kesilen köşe gölge düşürmesin). Grup başına bir tane.
const depthMats = {};
function depthFor(k) {
  if (depthMats[k]) return depthMats[k];
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, cutUniforms);
    patchVertex(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${CUT_FRAG_HEAD}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT_DISCARD}`);
  };
  return (depthMats[k] = d);
}
const section = (() => {
  let on = false, y = CUT_BOX.start, from = y, to = y, t0 = 0;
  // ground dışındaki tüm malzemelerde kesit kodunu aç/kapat (program önbelleklenir, yalnız ilk sefer derlenir)
  function setDefines(v) {
    on = v;
    const mats = new Set();
    for (const k in state) if (k !== 'ground') for (const m of state[k].meshes) mats.add(m.material);
    for (const k in depthMats) mats.add(depthMats[k]);
    for (const m of mats) { m.defines = v ? { SP_CUT: '' } : {}; m.needsUpdate = true; }
  }
  return {
    open(k) {
      const target = k === 'ground' ? CUT_BOX.min.y : CUT_BOX.start;
      if (target === to) return;
      if (k === 'ground' && !on) setDefines(true);
      from = y; to = target; t0 = performance.now();
      invalidate();
    },
    // true dönerse animasyon sürüyor
    step(now) {
      if (y === to) return false;
      const t = Math.min(1, (now - t0) / 1100);
      y = THREE.MathUtils.lerp(from, to, ease(t));
      if (t >= 1) { y = to; if (to === CUT_BOX.start) setDefines(false); }
      cutUniforms.uBoxMin.value.y = y;
      renderer.shadowMap.needsUpdate = true;
      return true;
    },
  };
})();

function patch(mat, gs) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHi = gs.hi; sh.uniforms.uDim = gs.dim;
    sh.uniforms.uHiCol = { value: hiCol }; sh.uniforms.uDimCol = { value: dimCol };
    Object.assign(sh.uniforms, cutUniforms, { cutProj: { value: camera.projectionMatrix } });
    patchVertex(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uHi; uniform float uDim; uniform vec3 uHiCol; uniform vec3 uDimCol;\n${CUT_FRAG_HEAD}\n#ifdef SP_CUT\nuniform mat4 cutProj;\n#endif`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT_DISCARD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uHiCol, uHi * 0.5);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
        totalEmissiveRadiance += uHiCol * uHi * (0.12 + 1.3 * fr);`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(lum), uDimCol, 0.5), uDim);
        ${CUT_CAP}`);
  };
  mat.customProgramCacheKey = () => 'sp-hl';
}

const texLoader = new THREE.TextureLoader();
const texCache = {};
function loadTex(def) {
  const key = def.map + def.rep + def.off;
  if (texCache[key]) return texCache[key];
  const t = texLoader.load('assets/tex/' + def.map, invalidate);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // glTF UV düzeni
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (def.rep) t.repeat.set(def.rep[0], def.rep[1]);
  if (def.off) t.offset.set(def.off[0], def.off[1]);
  return (texCache[key] = t);
}
// Zemine/yüzeye yapışık ince katmanlar (çizgiler, işaretler, bayraktaki ay-yıldız): z-fighting'i önlemek için öne çek.
const OVERLAY = /line_|_Marking|Access_Blue|Safety_Amber|tactile|Y2_white|EV_V12_WhiteSymbol|EV_V12_Green/i;
// Büyük taban yüzeyler (cephe sıvası, avlu kaplamaları, zemin, kiremit) bir adım geriye itilir: aynı düzlemde
// duran cephe detayları ve döşemeler onlarla yer değiştirip titremez, her zaman önde kalır.
const BASE = /^(FAC_Mineral_Render|Yard_Concrete|Y2_pav_|Y2_asphalt|Y2_turf|Y2_court_|Y2_dio_soil|Y2_soil|Concrete$|Floors$|Y2_plaster|Y2_context|Roof_Tile)/;

function makeMaterial(def, name) {
  const c = def?.c ?? [0.7, 0.7, 0.7];
  const color = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  if (def?.map) color.set(0xffffff);
  const isGlass = /glass/i.test(name);
  const isPV = /^PV_cells/i.test(name);
  const o = def?.o ?? 1;
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: isGlass ? 0.08 : isPV ? 0.28 : THREE.MathUtils.clamp(def?.r ?? 0.9, 0.35, 1),
    metalness: isGlass ? 0.2 : isPV ? 0.35 : def?.m ?? 0,
    side: THREE.DoubleSide,
  });
  if (def?.map) m.map = loadTex(def);
  if (isGlass) { m.transparent = true; m.opacity = 0.82; m.envMapIntensity = 2.2; m.color.multiplyScalar(0.6); }
  else if (o < 0.99) { m.transparent = true; m.opacity = o; }
  if (isPV) m.envMapIntensity = 1.8;
  if (OVERLAY.test(name)) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }
  else if (BASE.test(name)) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; }
  return m;
}

/* ---------- loading ---------- */
const FEAT = Object.fromEntries(FEATURES.map((f, i) => [f.key, { ...f, i }]));
const hotMeshes = [];
const root = new THREE.Group();
scene.add(root);

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);

const matsP = fetch('assets/materials.json').then((r) => r.json());
const glbP = new Promise((res, rej) => loader.load('assets/school.glb', res, (e) => {
  const p = e.total ? e.loaded / e.total : Math.min(0.95, e.loaded / 6.4e6);
  $('ldPct').textContent = p >= 1 ? t('preparing') : Math.round(p * 100) + '%';
  $('ldBar').style.width = p * 100 + '%';
}, rej));

Promise.all([matsP, glbP]).then(([rawMats, gltf]) => {
  // GLTFLoader node isimlerini temizler (boşluk -> _), malzeme anahtarlarını da aynı şekilde eşle.
  const mats = {};
  for (const n in rawMats) mats[THREE.PropertyBinding.sanitizeNodeName(n)] = rawMats[n];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const [key, matName] = (o.name || '').split('__');
    const k = FEAT[key] ? key : 'ctx';
    const gs = groupState(k);
    // Rhino'nun glTF çıktısındaki accessor min/max değerleri hatalı (Z→Y dönüşümünde ters).
    // Sınırları gerçek geometriden yeniden hesapla; yoksa frustum culling ve raycast parçaları kaçırır.
    o.geometry.computeBoundingBox();
    o.geometry.computeBoundingSphere();
    o.material = makeMaterial(mats[matName], matName || '');
    patch(o.material, gs);
    if (k !== 'ground') o.customDepthMaterial = depthFor(k);
    o.castShadow = !o.material.transparent;
    o.receiveShadow = true;
    o.userData.key = k;
    o.matrixAutoUpdate = false;
    gs.meshes.push(o);
    if (k !== 'ctx') hotMeshes.push(o);
  });
  root.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  for (const k in state) for (const m of state[k].meshes) state[k].box.expandByObject(m);
  renderer.shadowMap.needsUpdate = true;
  buildPins();
  // Giriş: kamera yüksekten ve yandan başlar, sahne ekrana girince okula doğru süzülür.
  setView({ target: HOME_VIEW.target, dir: [-0.62, 1.05, 0.28], dist: HOME_VIEW.dist * 2.2 }, false);
  introPending = true;
  renderer.compile(scene, camera);
  invalidate();
  $('loader').classList.add('done');
  playIntro();
}).catch((err) => {
  console.error(err);
  $('ldPct').textContent = t('failed');
});

/* ---------- camera views ---------- */
const v3 = (a) => new THREE.Vector3(...a);
function viewFor(view) {
  const target = v3(view.target);
  // Dizin ve panelden kalan boş alanın en-boy oranına göre uzaklığı büyüt.
  const w = glBox.clientWidth || 1, h = glBox.clientHeight || 1;
  const free = isMobile() ? (view === HOME_VIEW ? h : h * 0.4) : w - leftW() - 28 - (view === HOME_VIEW ? 0 : panel.offsetWidth + 14);
  const aspect = isMobile() ? w / free : free / h;
  const k = THREE.MathUtils.clamp(1.5 / aspect, 1, 2.4);
  const pos = target.clone().add(v3(view.dir).normalize().multiplyScalar(view.dist * k));
  return { target, pos };
}
let fly = null;
function setView(view, animate = true) {
  const { target, pos } = viewFor(view);
  if (!animate) { camera.position.copy(pos); controls.target.copy(target); controls.update(); return; }
  const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const s1 = new THREE.Spherical().setFromVector3(pos.clone().sub(target));
  let dt = s1.theta - s0.theta;
  dt = Math.atan2(Math.sin(dt), Math.cos(dt));
  const dur = 1.1 + Math.min(0.6, Math.abs(dt) * 0.25);
  fly = { t0: performance.now(), dur: dur * 1000, a: controls.target.clone(), b: target, s0, s1, dt };
  controls.enabled = false;
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const _s = new THREE.Spherical();
function stepFly(now) {
  const t = Math.min(1, (now - fly.t0) / fly.dur), e = ease(t);
  controls.target.lerpVectors(fly.a, fly.b, e);
  _s.radius = Math.exp(THREE.MathUtils.lerp(Math.log(fly.s0.radius), Math.log(fly.s1.radius), e));
  _s.theta = fly.s0.theta + fly.dt * e;
  _s.phi = THREE.MathUtils.lerp(fly.s0.phi, fly.s1.phi, e);
  camera.position.setFromSpherical(_s).add(controls.target);
  camera.lookAt(controls.target);
  if (t >= 1) { fly = null; controls.enabled = true; controls.update(); }
}

// Panel açıkken sahneyi boş alana kaydır (setViewOffset).
const shift = { x: 0, y: 0, tx: 0, ty: 0 };
// Sol dizin ve sağ panel arasındaki boş alanın ortasına hizala.
function updateShiftTarget() {
  if (isMobile()) { shift.tx = 0; shift.ty = active ? panel.offsetHeight * 0.5 : 0; return; }
  const left = leftW() + 14, right = active ? panel.offsetWidth + 14 : 0;
  shift.tx = (right - left) * 0.5; shift.ty = 0;
}
function applyShift() {
  const w = glBox.clientWidth, h = glBox.clientHeight;
  camera.setViewOffset(w, h, shift.x, shift.y, w, h);
}

/* ---------- pins & dock ---------- */
const pinEls = {};
let pinHover = null;
function buildPins() {
  for (const f of FEATURES) {
    const b = document.createElement('button');
    b.className = 'pin'; b.type = 'button';
    b.innerHTML = `<svg class="ico"><use href="#i-${f.icon}"/></svg><b>${FEAT[f.key].i + 1}</b>`;
    b.setAttribute('aria-label', feat(f).title);
    b.addEventListener('click', () => focus(f.key));
    b.addEventListener('pointerenter', () => { pinHover = f.key; setHover(f.key); });
    b.addEventListener('pointerleave', () => { pinHover = null; setHover(null); });
    pinsBox.appendChild(b);
    pinEls[f.key] = { el: b, p: anchorPin(f) };
  }
}
// data.js'teki pin noktası yaklaşık; sistemin gerçek yüzeyine oturt ve yüzey normali boyunca 0.5 m dışarı al.
// Böylece görünürlük ışını pini kendi yüzeyinin "arkasında" saymaz.
const _bc = new THREE.Vector3();
function anchorPin(f) {
  const p = v3(f.pin);
  if (f.key === 'ground') return p;          // döşeme bina içinde; pin subasman hizasında kalsın
  const meshes = state[f.key]?.meshes ?? [];
  state.wall.box.getCenter(_bc);
  const out = p.clone().sub(_bc).setY(0).normalize().add(new THREE.Vector3(0, 0.8, 0)).normalize();
  const r = new THREE.Raycaster(p.clone().addScaledVector(out, 12), out.clone().negate(), 0, 24);
  const hit = r.intersectObjects(meshes, false).sort((a, b) => a.point.distanceTo(p) - b.point.distanceTo(p))[0];
  if (!hit || hit.point.distanceTo(p) > 4) return p;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  if (n.dot(out) < 0) n.negate();
  return hit.point.clone().addScaledVector(n, 0.5);
}
const _p = new THREE.Vector3(), _d = new THREE.Vector3();
const occRay = new THREE.Raycaster();
let occluders = null, occAt = 0, occPending = false;
// Bina kabuğunun arkasında kalan pinleri gizle. Işın testi pahalı olmasın diye en fazla ~8 kez/sn.
function updateOcclusion(now) {
  if (now - occAt < 120 || !hotMeshes.length) return;
  occAt = now;
  occluders ??= ['wall', 'roof', 'window', 'ground'].flatMap((k) => state[k]?.meshes ?? []);
  for (const k in pinEls) {
    const pin = pinEls[k];
    _d.copy(pin.p).sub(camera.position);
    const dist = _d.length();
    occRay.set(camera.position, _d.normalize());
    occRay.far = dist - 0.3;
    pin.occ = occRay.intersectObjects(occluders, false).length > 0;
  }
}
function placePins(now) {
  const w = glBox.clientWidth, h = glBox.clientHeight;
  updateOcclusion(now);
  for (const k in pinEls) {
    const { el, p, occ } = pinEls[k];
    _p.copy(p).project(camera);
    const behind = _p.z > 1;
    // İmlecin altındaki pin asla gizlenmez; yoksa üzerine gelince kaybolup tıklanamıyordu.
    el.classList.toggle('hide', behind || (occ && k !== pinHover));
    // `translate` özelliği (transform değil): CSS'te ölçek/geçişlerle birleşince konum kaymasın.
    el.style.translate = `${(_p.x * 0.5 + 0.5) * w}px ${(-_p.y * 0.5 + 0.5) * h}px`;
  }
}

let hover = null, active = null;
let introPending = false;

// Sol dizin: dil değişince yeniden kurulur (seçim ve işaret anahtarı korunur)
const chipEls = {};
let pinsOn = true;
try { pinsOn = localStorage.getItem('sp-pins') !== '0'; } catch {}
function setPins(on) {
  pinsOn = on;
  stage.classList.toggle('nopins', !on);
  $('pinSw')?.setAttribute('aria-checked', String(on));
  try { localStorage.setItem('sp-pins', on ? '1' : '0'); } catch {}
}
function buildDock() {
  dock.innerHTML = `<div class="dock-h"><span>${t('systems')}</span>
    <button type="button" class="sw" id="pinSw" role="switch" aria-checked="${pinsOn}" title="${t('pinsTitle')}"><i></i>${t('pins')}</button></div>`;
  dock.setAttribute('aria-label', t('systems'));
  $('pinSw').addEventListener('click', () => setPins(!pinsOn));
  for (const g of GROUPS) {
    const wrap = document.createElement('div');
    wrap.className = 'dgrp';
    wrap.innerHTML = `<span>${groupName(g)}</span><div></div>`;
    for (const f0 of FEATURES.filter((x) => x.group === g.id)) {
      const f = feat(f0);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.title = f.title;
      b.innerHTML = `<i>${FEATURES.indexOf(f0) + 1}</i><svg class="ico"><use href="#i-${f.icon}"/></svg><span>${f.title}</span>`;
      b.classList.toggle('on', f.key === active);
      b.addEventListener('click', () => focus(f.key));
      b.addEventListener('pointerenter', () => setHover(f.key));
      b.addEventListener('pointerleave', () => setHover(null));
      wrap.lastChild.appendChild(b);
      chipEls[f.key] = b;
    }
    dock.appendChild(wrap);
  }
}
setPins(pinsOn);
buildDock();

/* ---------- hover / pick ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let pointerDirty = false, pointerIn = false, downAt = null;
const cvs = renderer.domElement;

cvs.addEventListener('pointermove', (e) => {
  const r = cvs.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  tip.style.left = e.clientX - stage.getBoundingClientRect().left + 'px';
  tip.style.top = e.clientY - stage.getBoundingClientRect().top + 'px';
  pointerIn = true; pointerDirty = e.pointerType === 'mouse';
});
cvs.addEventListener('pointerleave', () => { pointerIn = false; setHover(null); });
cvs.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
cvs.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const r = cvs.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  // Imleç altında parlayan bir sistem varsa ona güven; ışın ince parçayı ıskalasa bile seçilir.
  const k = pick() || hover;
  if (k) focus(k);
});

// Önce tam imleç noktasından, ıskalarsa çevresindeki 8 noktadan (≈7 px) ışın at.
// İnce parçalar (kanatlar, paneller, subasman) böylece kolay yakalanır.
const RING = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
const _n = new THREE.Vector2();
function pick() {
  ray.setFromCamera(ndc, camera);
  let hit = ray.intersectObjects(hotMeshes, false)[0];
  if (!hit) {
    const px = 7 * 2 / cvs.clientWidth, py = 7 * 2 / cvs.clientHeight;
    for (const [cx, cy] of RING) {
      _n.set(ndc.x + cx * px, ndc.y + cy * py);
      ray.setFromCamera(_n, camera);
      const h = ray.intersectObjects(hotMeshes, false)[0];
      if (h && (!hit || h.distance < hit.distance)) hit = h;
    }
  }
  return hit ? hit.object.userData.key : null;
}
function setHover(k) {
  if (k === hover) return;
  hover = k;
  stage.classList.toggle('hovering', !!k);
  for (const key in chipEls) chipEls[key].classList.toggle('hl', key === k);
  if (k && pointerIn) {
    const f = feat(FEAT[k]);
    tip.innerHTML = `${f.title}${active === k ? '' : `<small>${t('inspect')}</small>`}`;
    tip.classList.add('on');
  } else tip.classList.remove('on');
  updateTargets();
}

function updateTargets() {
  for (const k in state) {
    const gs = state[k];
    const isAct = k === active, isHov = k === hover;
    // Seçili sistem kendi renginde kalır (çevresi soluklaşır); renk vurgusu yalnızca imleç üzerindeyken
    gs.hiT = isHov && !isAct ? 0.75 : 0;
    gs.dimT = active && !isAct && !isHov ? (k === 'ctx' ? 0.85 : 0.75) : 0;
  }
  invalidate();
}

/* ---------- panel ---------- */
const effIco = { energy: 'energy', emis: 'emis', cost: 'cost', iod: 'iod' };
// Enerji Kimlik Belgesi okları: boy = etkinin büyüklüğü, renk = yönü (yeşil iyi, gri nötr, turuncu/kırmızı kötü)
const EKB = {
  'çok azalır': ['100%', 'var(--ekb-a)'], 'çok iyi': ['100%', 'var(--ekb-a)'],
  'azalır': ['78%', 'var(--ekb-b)'], 'iyi': ['78%', 'var(--ekb-b)'],
  'az azalır': ['58%', 'var(--ekb-c)'], 'düşük': ['46%', 'var(--ekb-c)'],
  'orta': ['64%', 'var(--ekb-n)'], 'nötr': ['46%', 'var(--ekb-n)'], 'etkisiz': ['46%', 'var(--ekb-n)'],
  'yüksek': ['86%', 'var(--ekb-e)'], 'kötüleşir': ['86%', 'var(--ekb-g)'],
};
function fillPanel(f0, animate = true) {
  const f = feat(f0);
  $('pIdx').textContent = `${f.i + 1} / ${FEATURES.length}`;
  $('pTag').textContent = f.tag;
  $('pIco').setAttribute('href', `#i-${f.icon}`);
  $('pTitle').textContent = f.title;
  $('pBody').innerHTML = f.body.map((p) => `<p class="rbody">${p}</p>`).join('')
    + `<div class="rhow"><b>${t('how')}.</b> ${f.how}</div>`
    + (f.warn ? `<div class="rwarn"><b>⚠</b> ${f.warn}</div>` : '');
  $('pEff').innerHTML = f.eff.map(([k, v, c]) => {
    const [len, col] = EKB[v] ?? ['56%', c === 'bad' ? 'var(--ekb-g)' : c === 'good' ? 'var(--ekb-b)' : 'var(--ekb-n)'];
    return `<li class="ef ${c}"><svg class="ico" style="color:${INDICATORS[k].color}"><use href="#i-${effIco[k]}"/></svg>${indicatorLabel(k, INDICATORS[k].label)}<b style="--len:${len};--c:${col}">${effValue(v)}</b></li>`;
  }).join('');
  if (!animate) return;
  const sc = $('pScroll');
  sc.scrollTop = 0;
}

function focus(k) {
  const f = FEAT[k];
  if (!f) return;
  active = k;
  controls.autoRotate = false; $('rotBtn').setAttribute('aria-pressed', 'false');
  stage.classList.add('focus');
  panel.setAttribute('aria-hidden', 'false');
  for (const key in chipEls) chipEls[key].classList.toggle('on', key === k);
  fillPanel(f);
  tip.classList.remove('on');
  updateTargets();
  updateShiftTarget();
  setView(f.view);
  section.open(k);
  mini.show(k);
}
function home() {
  active = null;
  section.open(null);
  stage.classList.remove('focus');
  panel.setAttribute('aria-hidden', 'true');
  for (const key in chipEls) chipEls[key].classList.remove('on');
  updateTargets();
  updateShiftTarget();
  setView(HOME_VIEW);
  mini.hide();
}
const step = (d) => { const i = active ? FEAT[active].i : -1; focus(FEATURES[(i + d + FEATURES.length) % FEATURES.length].key); };
$('pClose').addEventListener('click', home);
$('pPrev').addEventListener('click', () => step(-1));
$('pNext').addEventListener('click', () => step(1));
$('homeBtn').addEventListener('click', home);
$('rotBtn').addEventListener('click', (e) => {
  if (active) home();
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
  invalidate();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mini.isBig()) { mini.setBig(false); return; }
  if (e.key === 'Escape' && active) home();
  if (active && onScreen && e.key === 'ArrowRight') step(1);
  if (active && onScreen && e.key === 'ArrowLeft') step(-1);
});
controls.addEventListener('start', () => { if (controls.autoRotate) { controls.autoRotate = false; $('rotBtn').setAttribute('aria-pressed', 'false'); } });
controls.addEventListener('change', invalidate);

/* ---------- mini detail viewer ---------- */
// Teknik detaylar `assets/details/<key>.glb` + `details.json` (malzemeler, numaralı etiketler) olarak
// Rhino'daki DETAILS katmanlarından üretilir (rhino/export_site.py). Anahtarı DETAIL_MODELS'te olmayan
// sistemler için ana modelden ilgili parça ayıklanıp ön izleme olarak gösterilir.
const mini = (() => {
  let r, sc, cam, ctl, cur = null, running = false, host = null, labelsEl, info = null, labels = [];
  const cache = {};
  const bigView = $('bigView');
  function init() {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    labelsEl = document.createElement('div');
    labelsEl.className = 'mlabels';
    labelsEl.addEventListener('pointerover', (e) => hl(e.target.closest('.mk')?.dataset.n ?? null));
    labelsEl.addEventListener('pointerleave', () => hl(null));
    sc = new THREE.Scene();
    sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    sc.environmentIntensity = 0.6;
    sc.add(new THREE.HemisphereLight(0xf4f7ff, 0xb9a98c, 1.3));
    cam = new THREE.PerspectiveCamera(28, 1, 0.01, 2000);
    ctl = new OrbitControls(cam, r.domElement);
    ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 0.6; ctl.enablePan = false;
    ctl.addEventListener('start', () => { ctl.autoRotate = false; });
    attach($('miniGl'));
    const ro = new ResizeObserver(size);
    ro.observe($('miniGl')); ro.observe(bigView);
  }
  // Tuval ve etiket katmanı panel içindeki küçük kutu ile sahne üstü büyük görünüm arasında taşınır.
  function attach(el) {
    host = el;
    el.append(r.domElement, labelsEl);
    size();
  }
  function size() {
    if (!r || !host || !host.clientWidth) return;
    r.setSize(host.clientWidth, host.clientHeight, false);
    cam.aspect = host.clientWidth / host.clientHeight; cam.updateProjectionMatrix();
  }

  // --- ana modelden ön izleme (detay modeli olmayan sistemler için) ---
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9aa7a2, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
  function copyMesh(m, mat) {
    const c = new THREE.Mesh(m.geometry, mat);
    c.matrix.copy(m.matrixWorld); c.matrixAutoUpdate = false;
    return c;
  }
  function extract(k) {
    const g = new THREE.Group();
    for (const m of state[k].meshes) {
      const src = m.material;
      const mat = new THREE.MeshStandardMaterial({ color: src.color, map: src.map, roughness: src.roughness, metalness: src.metalness, transparent: src.transparent, opacity: src.opacity, side: THREE.DoubleSide, envMapIntensity: src.envMapIntensity,
        polygonOffset: src.polygonOffset, polygonOffsetFactor: src.polygonOffsetFactor, polygonOffsetUnits: src.polygonOffsetUnits });
      const c = copyMesh(m, mat);
      c.castShadow = !src.transparent; c.receiveShadow = true;
      g.add(c);
    }
    g.userData.box = state[k].box.clone();
    g.userData.focus = state[k].box.clampPoint(v3(FEAT[k].pin), new THREE.Vector3());
    g.userData.maxRad = ['wall', 'roof', 'window'].includes(k) ? 10 : 6.5;
    if (!['wall', 'roof', 'window'].includes(k)) {
      for (const gk of ['wall', 'roof']) for (const m of state[gk].meshes) g.add(copyMesh(m, ghostMat));
    }
    return g;
  }

  // --- teknik detay modeli ---
  function detailMaterial(def) {
    const c = def?.c ?? [0.7, 0.7, 0.7];
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace),
      roughness: def?.r ?? 0.8, metalness: def?.m ?? 0, side: THREE.DoubleSide,
    });
    if ((def?.o ?? 1) < 0.99) { m.transparent = true; m.opacity = def.o; m.depthWrite = def.o > 0.5; }
    if (def?.e) { m.emissive.copy(m.color); m.emissiveIntensity = 0.9; }
    return m;
  }
  // Kademeli kesitlerde katmanlar aynı kenardan başlar (ör. file, alt kat sıva ve son kat sıvanın yan yüzleri
  // aynı düzlemde). Malzemeler Rhino'ya içten dışa sırayla eklendiği için GLB'deki sıraları da öyledir:
  // sonraki malzemeye biraz daha derinlik önceliği verilir, çakışan yüzeylerde hep dıştaki kazanır, titreme olmaz.
  function prepareDetail(scene) {
    let i = 0;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = (o.name || '').split('__')[1] || '';
      const def = info.materials[name] ?? info.materials[Object.keys(info.materials).find((n) => THREE.PropertyBinding.sanitizeNodeName(n) === name)];
      o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
      o.material = detailMaterial(def);
      o.material.polygonOffset = true;
      o.material.polygonOffsetFactor = -0.5 * i;
      o.material.polygonOffsetUnits = -2 * i;
      i++;
      o.castShadow = !o.material.transparent; o.receiveShadow = true;
    });
    return scene;
  }

  function frame(obj, k, real) {
    const box = obj.userData.box ?? new THREE.Box3().setFromObject(obj);
    const c = obj.userData.focus ?? box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    // Odak noktasını orijine taşı; kamera, ışık ve gölge zemini her sistem için aynı kurulur.
    obj.position.sub(c);
    const wrap = new THREE.Group(); wrap.add(obj);
    const rad = Math.max(Math.min(s.length() * 0.5, obj.userData.maxRad ?? Infinity), 0.3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(rad * 8, rad * 8), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = box.min.y - c.y - 0.005; floor.receiveShadow = true;
    const sunL = new THREE.DirectionalLight(0xfff3e2, 2.4);
    sunL.position.set(-rad * 0.8, rad * 2, rad * 1.2);
    sunL.castShadow = true;
    sunL.shadow.mapSize.setScalar(2048);
    Object.assign(sunL.shadow.camera, { left: -rad * 1.2, right: rad * 1.2, top: rad * 1.2, bottom: -rad * 1.2, near: 0.01, far: rad * 6 });
    sunL.shadow.normalBias = 0.01;
    wrap.add(floor, sunL);
    wrap.userData.rad = rad;
    wrap.userData.dir = v3((real && FEAT[k]?.detail?.dir) || FEAT[k]?.view.dir || [1, 0.6, 1]).normalize();
    wrap.userData.labels = real ? (info.details[k]?.labels ?? []).map((l) => ({ ...l, v: v3(l.p).sub(c) })) : [];
    wrap.userData.key = k; wrap.userData.real = real;
    return wrap;
  }
  async function loadInfo() {
    info ??= await fetch('assets/details/details.json').then((x) => x.json()).catch(() => ({ materials: {}, details: {} }));
  }
  function load(k) {
    return cache[k] ??= (async () => {
      if (!DETAIL_MODELS.includes(k)) return { obj: frame(extract(k), k, false), real: false };
      await loadInfo();
      try {
        const g = await loader.loadAsync(`assets/details/${k}.glb`);
        return { obj: frame(prepareDetail(g.scene), k, true), real: true };
      } catch {
        return { obj: frame(extract(k), k, false), real: false };
      }
    })();
  }

  // --- çağrı etiketleri: noktada küçük işaret, numara kenarda sütun halinde, arada kırık kılavuz çizgi ---
  const SVGNS = 'http://www.w3.org/2000/svg';
  let svg, shown = null;
  function buildLabels(list0, key) {
    const list = list0.map((l) => ({ ...l, t: detailLabel(key, l.n, l.t) }));
    labelsEl.innerHTML = '';
    svg = document.createElementNS(SVGNS, 'svg');
    svg.classList.add('mlines');
    labelsEl.appendChild(svg);
    labels = list.map((l) => {
      const line = document.createElementNS(SVGNS, 'polyline');
      const dotEl = document.createElementNS(SVGNS, 'circle');
      dotEl.setAttribute('r', '2.6');
      const g = document.createElementNS(SVGNS, 'g');
      g.dataset.n = l.n;
      g.append(line, dotEl);
      svg.appendChild(g);
      const el = document.createElement('span');
      el.className = 'mk'; el.dataset.n = l.n;
      el.innerHTML = `<i>${l.n}</i><em>${l.t}</em>`;
      labelsEl.appendChild(el);
      return { el, g, line, dot: dotEl, v: l.v, n: String(l.n) };
    });
    const lg = $('pLegend');
    lg.innerHTML = list.map((l) => `<li data-n="${l.n}"><i>${l.n}</i>${l.t}</li>`).join('');
    lg.hidden = !list.length;
  }
  function hl(n) {
    for (const l of labels) { const on = l.n === n; l.el.classList.toggle('on', on); l.g.classList.toggle('on', on); }
    for (const el of $('pLegend').children) el.classList.toggle('on', el.dataset.n === n);
  }
  $('pLegend').addEventListener('pointerover', (e) => hl(e.target.closest('li')?.dataset.n ?? null));
  $('pLegend').addEventListener('pointerleave', () => hl(null));
  const _q = new THREE.Vector3();
  // Her kenardaki numaraları yükseklik sırasına göre dizip aralarında en az `gap` bırakır.
  function spread(items, gap, top, bottom) {
    items.sort((a, b) => a.ay - b.ay);
    let y = top - gap;
    for (const it of items) { it.y = Math.max(it.ay, y + gap); y = it.y; }
    let lim = bottom + gap;
    for (let i = items.length - 1; i >= 0; i--) { items[i].y = Math.min(items[i].y, lim - gap); lim = items[i].y; }
  }
  function placeLabels() {
    const w = host.clientWidth, h = host.clientHeight;
    const big = host === bigView;
    const pad = big ? 22 : 14, gap = big ? 34 : 22;
    _q.set(0, 0, 0).project(cam);
    const cx = (_q.x * 0.5 + 0.5) * w;
    const left = [], right = [];
    for (const l of labels) {
      _q.copy(l.v).project(cam);
      l.vis = _q.z < 1;
      l.ax = (_q.x * 0.5 + 0.5) * w; l.ay = (-_q.y * 0.5 + 0.5) * h;
      if (l.vis) (l.ax < cx ? left : right).push(l);
    }
    // Bir kenar fazla doluysa en yakın taşanları diğer kenara aktar.
    const cap = Math.max(1, Math.floor((h - pad * 2) / gap) + 1);
    while (left.length > cap) right.push(left.splice(left.reduce((m, l, i, a) => (l.ax > a[m].ax ? i : m), 0), 1)[0]);
    while (right.length > cap) left.push(right.splice(right.reduce((m, l, i, a) => (l.ax < a[m].ax ? i : m), 0), 1)[0]);
    spread(left, gap, pad + 10, h - pad - 10);
    spread(right, gap, big ? 64 : pad + 10, h - pad - 10);   // sağ üstte kapatma düğmesi var
    for (const l of labels) {
      l.el.style.display = l.g.style.display = l.vis ? '' : 'none';
      if (!l.vis) continue;
      const onLeft = left.includes(l);
      const bx = onLeft ? pad + 10 : w - pad - 10;
      l.el.classList.toggle('r', !onLeft);
      l.el.style.transform = `translate(${bx}px,${l.y}px)`;
      const ew = big ? l.el.offsetWidth - 10 + 4 : 14;           // büyük görünümde metin kutusunun ucundan başla
      const ex = onLeft ? bx + ew : bx - ew;
      const kx = onLeft ? Math.max(ex + 8, l.ax - 18) : Math.min(ex - 8, l.ax + 18);
      l.line.setAttribute('points', `${ex},${l.y} ${kx},${l.y} ${l.ax},${l.ay}`);
      l.dot.setAttribute('cx', l.ax); l.dot.setAttribute('cy', l.ay);
    }
  }

  async function show(k) {
    if (!r) init();
    size();
    cur = k;
    $('miniCap').textContent = t('miniLoading');
    $('pLegend').hidden = true;
    const { obj, real } = await load(k);
    if (cur !== k) return;
    sc.children.filter((c) => c.userData.rad).forEach((c) => sc.remove(c));
    sc.add(obj);
    shown = obj;
    buildLabels(obj.userData.labels, k);
    // Kamera, detay için tanımlı yönden bakar; mesafe sınır küresini kadraja sığdırır.
    const rad = obj.userData.rad;
    const fit = rad / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) / Math.min(1, cam.aspect) * (real ? 1.0 : 0.62);
    cam.near = rad / 200; cam.far = rad * 40; cam.updateProjectionMatrix();
    cam.position.copy(obj.userData.dir).multiplyScalar(fit);
    ctl.target.set(0, 0, 0); ctl.autoRotate = !real;
    ctl.minDistance = fit * 0.25; ctl.maxDistance = fit * 2.5; ctl.update();
    $('miniCap').textContent = t(real ? 'miniReal' : 'miniPreview');
    $('miniBig').hidden = !real;
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    if (!running) return;
    ctl.update(); fitDepthRange(cam, cam.position.distanceTo(ctl.target)); r.render(sc, cam); placeLabels();
    requestAnimationFrame(tick);
  }
  function setBig(on) {
    if (!r) return;
    stage.classList.toggle('mini-big', on);
    $('miniBig').setAttribute('aria-pressed', String(on));
    attach(on ? bigView : $('miniGl'));
  }
  $('miniBig').addEventListener('click', () => setBig(!stage.classList.contains('mini-big')));
  $('bigClose').addEventListener('click', () => setBig(false));
  function hide() { setBig(false); running = false; cur = null; shown = null; }
  // Dil değişince açık detayın etiketlerini ve alt yazısını yenile (kamera ve model yerinde kalır)
  function relabel() {
    if (!shown || shown.userData.key !== cur) return;
    buildLabels(shown.userData.labels, cur);
    $('miniCap').textContent = t(shown.userData.real ? 'miniReal' : 'miniPreview');
  }
  return { show, hide, setBig, relabel, isBig: () => stage.classList.contains('mini-big') };
})();

/* ---------- dil ---------- */
onLang(() => {
  buildDock();
  for (const k in pinEls) pinEls[k].el.setAttribute('aria-label', feat(FEAT[k]).title);
  if (active) fillPanel(FEAT[active], false);
  mini.relabel();
  tip.classList.remove('on');
});
applyStatic();

/* ---------- loop ---------- */
let dirty = true;
function invalidate() { dirty = true; }
function resize() {
  const w = glBox.clientWidth, h = glBox.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  updateShiftTarget();
  applyShift();
  invalidate();
}
new ResizeObserver(resize).observe(glBox);
resize();

let last = performance.now();
// Sahne ekran dışındayken çizim durur.
let onScreen = true;
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { last = performance.now(); invalidate(); playIntro(); } }, { threshold: 0.35 }).observe(stage);
function playIntro() {
  if (!introPending || !onScreen) return;
  introPending = false;
  setView(HOME_VIEW);
  fly.dur = 2600;
  stage.classList.add('arrived');
}
function loop(now) {
  requestAnimationFrame(loop);
  if (!onScreen) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let busy = false;
  if (section.step(now)) busy = true;
  if (fly) { stepFly(now); busy = true; }
  else if (controls.update()) busy = true;
  if (controls.autoRotate) busy = true;

  const a = 1 - Math.exp(-dt * 9);
  for (const k in state) {
    const gs = state[k];
    for (const u of [['hi', 'hiT'], ['dim', 'dimT']]) {
      const d = gs[u[1]] - gs[u[0]].value;
      if (Math.abs(d) > 0.002) { gs[u[0]].value += d * a; busy = true; } else gs[u[0]].value = gs[u[1]];
    }
  }
  const dx = shift.tx - shift.x, dy = shift.ty - shift.y;
  if (Math.abs(dx) + Math.abs(dy) > 0.3) { shift.x += dx * a * 0.8; shift.y += dy * a * 0.8; applyShift(); busy = true; }
  else if (shift.x !== shift.tx || shift.y !== shift.ty) { shift.x = shift.tx; shift.y = shift.ty; applyShift(); busy = true; }

  if (pointerDirty && !fly && hotMeshes.length) { pointerDirty = false; setHover(pick()); }

  if (busy || dirty) {
    dirty = false;
    fitDepthRange(camera, camera.position.distanceTo(controls.target));
    renderer.render(scene, camera);
    placePins(now);
    occPending = true;
  } else if (occPending && now - occAt >= 120 && hotMeshes.length) {
    // Kamera durduktan sonra pin görünürlüğünü son konuma göre bir kez daha güncelle.
    occPending = false;
    placePins(now);
  }
}
requestAnimationFrame(loop);
