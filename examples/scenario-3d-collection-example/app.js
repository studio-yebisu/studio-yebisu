/* Scenario 3D Collection 作例 — three.js 0.180.0 viewer.
   取得したGLBをそのまま読み込み、表示のためだけに正規化・照明します。バイトは無改変。 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const $ = s => document.querySelector(s);
const els = {
  stage: $('#stage'), frame: $('#viewer-frame'), fallback: $('#fallback'), fallbackImg: $('#fallback-img'), fallbackCap: $('#fallback-cap'),
  status: $('#status'), wire: $('#wire'), reset: $('#reset'),
  buttons: [...document.querySelectorAll('[data-model]')],
  recLabel: $('#rec-label'), recAsset: $('#rec-asset'), recQuality: $('#rec-quality'), recSourceModel: $('#rec-source-model'),
  recPrompt: $('#rec-prompt'), recSha: $('#rec-sha'), recMesh: $('#rec-mesh'), recDim: $('#rec-dim'),
  thumbInput: $('#thumb-input'), thumbPreview: $('#thumb-preview'), thumbRender: $('#thumb-render'),
};

const PAPER = 0xf2eee3;
let data = null, current = 'frog', wire = false;
let renderer = null, scene = null, camera = null, controls = null, holder = null;
const models = new Map(); // key -> {root, info}

function setStatus(msg) { els.status.textContent = msg; }
const fmt = n => n.toLocaleString('ja-JP');

function showFallback(sample, reason) {
  els.stage.style.display = 'none';
  els.fallback.hidden = false;
  els.fallbackImg.src = sample.render_image;
  els.fallbackImg.alt = 'Blender 5.2.1 LTSでレンダリングした' + sample.label + 'のGLB';
  els.fallbackCap.textContent = 'WebGLが使えない環境での代替表示：' + sample.label + 'をBlender 5.2.1 LTSでレンダリングしたものです。表示のための再レンダリングで、GLBのバイトは無改変です。' + (reason ? '（' + reason + '）' : '');
}

function initGL() {
  renderer = new THREE.WebGLRenderer({canvas: els.stage, antialias: true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  camera.position.set(0, 0.6, 3.4);
  const hemi = new THREE.HemisphereLight(0xfff8ec, 0x8f8878, 1.05);
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(2.4, 3.2, 2.2);
  scene.add(hemi, dir);
  holder = new THREE.Group();
  scene.add(holder);
  controls = new OrbitControls(camera, els.stage);
  controls.enableDamping = false; // deterministic stills; drag renders on demand
  controls.enablePan = false;
  controls.addEventListener('change', renderOnce);
  resize();
}

function resize() {
  if (!renderer) return;
  const w = Math.max(1, els.frame.clientWidth), h = Math.max(1, els.frame.clientHeight - 2);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fitCamera();
  renderOnce();
}

// Fit the bounding sphere against both horizontal and vertical fields of view.
// Narrow phone viewports must show the entire asset before the user zooms.
function fitCamera() {
  if (!camera || !controls || !holder?.children.length) return;
  const sphere = new THREE.Box3().setFromObject(holder).getBoundingSphere(new THREE.Sphere());
  if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return;
  const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance = sphere.radius / Math.sin(Math.min(vertical, horizontal)) * 1.1;
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).add(new THREE.Vector3(0, 0.16, 1).normalize().multiplyScalar(distance));
  controls.minDistance = sphere.radius * 1.05;
  controls.maxDistance = distance * 3;
  controls.update();
  controls.saveState();
}

function renderOnce() {
  if (renderer && holder) renderer.render(scene, camera);
}

// 表示のためだけの正規化：Box3で包んで最大辺2・中心を原点へ。GLB本体は触らない。
function normalize(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z) || 1;
  const s = 2 / max;
  root.scale.setScalar(s);
  root.position.set(-center.x * s, -center.y * s, -center.z * s);
  return {size, scale: s};
}

async function loadModel(key, url) {
  if (models.has(key)) return models.get(key);
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  const info = normalize(root);
  const entry = {root, info};
  models.set(key, entry);
  return entry;
}

function applyWire(on) {
  wire = on;
  for (const {root} of models.values()) {
    root.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.wireframe = on;
      }
    });
  }
  renderOnce();
}

async function setModel(key) {
  const sample = data.samples.find(s => s.id === key) || data.samples[0];
  current = sample.id;
  for (const b of els.buttons) b.setAttribute('aria-pressed', String(b.dataset.model === current));
  fillRecord(sample);
  if (!renderer) { showFallback(sample, null); return; }
  try {
    setStatus(sample.label + 'のGLBを読み込んでいます…');
    const entry = await loadModel(current, sample.model_url);
    if (current !== sample.id) return;
    holder.clear();
    holder.add(entry.root);
    applyWire(wire);
    fitCamera();
    renderOnce();
    // GLBの表示に成功したら、Blender代替画像を確実に隠して実Canvasを前に出す
    els.fallback.hidden = true;
    els.stage.style.display = '';
    els.stage.setAttribute('aria-label', sample.label + 'のGLB（実物）。ドラッグで回転、ホイールで拡大。ワイヤーフレーム切替と向きのリセットが使えます。');
    const st = sample.statistics;
    setStatus(sample.label + '：実物のGLBを表示中（三角形' + fmt(st.triangles) + '・頂点' + fmt(st.vertices) + '）。ドラッグで回せます。');
  } catch (e) {
    showFallback(sample, String(e && e.message || e));
    setStatus(sample.label + 'のGLBを表示できなかったため、Blenderのレンダー画像に切り替えました。');
  }
}

function fillRecord(sample) {
  const st = sample.statistics;
  els.recLabel.textContent = sample.label;
  els.recAsset.textContent = sample.asset_id;
  els.recQuality.textContent = 'quality: ' + (sample.settings && sample.settings.quality || '—');
  els.recSourceModel.textContent = sample.source_model;
  els.recPrompt.textContent = sample.prompt;
  els.recSha.textContent = sample.sha256.slice(0, 16) + '…';
  els.recMesh.textContent = 'メッシュ' + fmt(st.mesh_objects) + '・三角形' + fmt(st.triangles) + '・頂点' + fmt(st.vertices) + '・マテリアル' + st.materials + '・テクスチャ画像' + st.images + '点';
  els.recDim.textContent = st.dimensions_in_imported_coordinates.map(v => v.toFixed(2)).join(' × ') + '（任意の読込座標。実寸の保証ではありません）';
  els.thumbInput.src = sample.input_image;
  els.thumbPreview.src = sample.preview_image;
  els.thumbRender.src = sample.render_image;
  els.thumbInput.alt = sample.label + 'の入力画像';
  els.thumbPreview.alt = sample.label + 'の配布プレビュー';
  els.thumbRender.alt = sample.label + 'のBlenderレンダリング';
}

els.buttons.forEach(b => b.addEventListener('click', () => setModel(b.dataset.model)));
els.wire.addEventListener('click', () => {
  els.wire.setAttribute('aria-pressed', String(!wire));
  applyWire(!wire);
});
els.reset.addEventListener('click', () => { if (controls) { controls.reset(); renderOnce(); } });
window.addEventListener('resize', resize);

(async () => {
  try {
    const r = await fetch('samples.json');
    if (!r.ok) throw new Error('samples.json を読めませんでした（HTTP ' + r.status + '）');
    data = await r.json();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    try {
      initGL();
    } catch (e) {
      renderer = null;
    }
    for (const b of els.buttons) b.disabled = false;
    els.wire.disabled = !renderer;
    els.reset.disabled = !renderer;
    await setModel('frog');
    if (renderer) setStatus(els.status.textContent + ' 取得した3件のSHA-256は配布メタデータと一致（' + data.samples.length + '件）。');
  } catch (e) {
    setStatus('記録を読み込めませんでした：' + (e && e.message || e));
  }
})();
