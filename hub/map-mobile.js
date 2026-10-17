/* 惠企孵化基地总览 · 手机竖屏版 3D 地图（视角、选择与动画）
   场景本身在 scene.js（与电脑版共用）；卡片轨道在 ui-mobile.js，这里只通过 window.HQ 联动。
   手机省电：像素比上限 1.5，辉光半分辨率，静止时约 30 帧，拖动和飞行时满帧。 */
import { buildScene } from "./scene.js";

const B = window.BASES, HQ = window.HQ;
const $ = (id) => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let S;
try {
  S = buildScene({
    canvas: $("map"), labels: $("labels"),
    maxPixelRatio: 1.5, exposure: 1.22, segX: 230, segZ: 196, bloom: [0.8, 0.5, 0.92],
    onPick: (i) => HQ.select(i, true)
  });
} catch (e) {
  console.error(e); window.HQmapFailed && window.HQmapFailed();
  throw e;
}
const { THREE, renderer, camera, controls, composer, bloom, canvas, INSET, inHaikou, beacons, pins, tags, disc } = S;
controls.maxDistance = 140;

/* ---------- 视角：只在标题和卡片之间的空档里取景 ---------- */
let padTop = 0, padBot = 0;
const islandC = new THREE.Vector3(0.4, 0, -4.4);
function viewFor(i) {
  /* 按屏幕宽度算距离：竖屏横向视角很窄，要让整岛 / 圆盘刚好装进屏宽 */
  const w = canvas.clientWidth, h = Math.max(canvas.clientHeight, 1), freeH = Math.max(h - padTop - padBot, 1);
  const hf = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (w / h));
  const vf = (camera.fov * Math.PI) / 180 * (freeH / h);
  const dist = (wNeed, hNeed) => Math.max(wNeed / 2 / Math.tan(hf / 2), hNeed / 2 / Math.tan(vf / 2));
  let t, d;
  if (i == null) { t = islandC.clone(); d = dist(27.5, 27); }
  else if (inHaikou(B[i])) { t = new THREE.Vector3(INSET.x, INSET.y * 0.75, INSET.z + 0.2); d = dist(10.5, 8); }
  else { const g = beacons[i].g.position; t = new THREE.Vector3(g.x, 0.6, g.z - 1.0); d = dist(12, 9); }
  return { t, c: t.clone().add(new THREE.Vector3(-d * 0.06, d * 0.88, d * 0.47)) };
}
let tw = null;
function flyTo(i) {
  const { t, c } = viewFor(i);
  if (reduce) { controls.target.copy(t); camera.position.copy(c); return; }
  tw = { t0: performance.now(), d: 1200, fromC: camera.position.clone(), fromT: controls.target.clone(), toC: c, toT: t };
}
function highlight(cur) {
  pins.forEach((p, k) => p.setAttribute("aria-pressed", String(k === cur)));
  beacons.forEach((bc, k) => { const on = k === cur; bc.beam.material.opacity = on ? 1 : 0.5; bc.glow.material.opacity = on ? 0.24 : 0.07; bc.g.scale.setScalar(on ? 1.15 : 1); });
}
HQ.on((type, i, fly) => {
  if (type === "whole") return flyTo(null);
  highlight(i); if (fly) flyTo(i);
});

/* 点光柱 */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const hits = beacons.map((b) => b.g.children[b.g.children.length - 1]);
let down = null;
canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(hits)[0];
  if (h) HQ.select(h.object.userData.i, true);
});
let idle = 0;
controls.addEventListener("start", () => { tw = null; idle = -1; });
controls.addEventListener("end", () => { idle = 0; });

/* 尺寸：把投影中心移到标题与卡片之间 */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  padTop = $("bar").getBoundingClientRect().bottom;
  padBot = h - $("sheet").getBoundingClientRect().top;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(Math.round(w * 0.5), Math.round(h * 0.5));
  camera.aspect = w / h;
  const s = Math.round((padBot - padTop) / 2);
  if (s > 0) camera.setViewOffset(w, h + 2 * s, 0, 2 * s, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize();
{ const v = HQ.overview ? viewFor(null) : viewFor(HQ.cur); controls.target.copy(v.t); camera.position.copy(v.c); }
highlight(HQ.cur);
addEventListener("orientationchange", () => setTimeout(() => { resize(); flyTo(HQ.overview ? null : HQ.cur); }, 300));

/* ---------- 循环 ---------- */
const v = new THREE.Vector3();
function place(el, p, dy = 0) {
  v.copy(p).project(camera);
  const sx = (v.x * 0.5 + 0.5) * canvas.clientWidth, sy = (-v.y * 0.5 + 0.5) * canvas.clientHeight + dy;
  const vis = v.z < 1 && sx > -40 && sx < canvas.clientWidth + 40 && sy > padTop - 10 && sy < canvas.clientHeight - padBot + 10;
  el.style.visibility = vis ? "visible" : "hidden";
  el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%)`;
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let last = performance.now(), lastDraw = 0, first = true;
renderer.setAnimationLoop((now) => {
  const busy = tw || idle < 0;
  if (!busy && !first && now - lastDraw < 30) return; // 静止时约 30 帧
  lastDraw = now;
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (tw) {
    const k = ease(Math.min((now - tw.t0) / tw.d, 1));
    camera.position.lerpVectors(tw.fromC, tw.toC, k); controls.target.lerpVectors(tw.fromT, tw.toT, k);
    if (k >= 1) tw = null;
  } else if (!reduce && idle >= 0 && (idle += dt) > 6) {
    const t = controls.target, off = camera.position.clone().sub(t);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.035); camera.position.copy(t).add(off);
  }
  controls.update();
  if (!reduce) {
    const s = now / 1000;
    disc.position.y = INSET.y + Math.sin(s * 0.8) * 0.06;
    beacons.forEach((bc, k) => {
      if (inHaikou(B[k])) bc.g.position.y = disc.position.y + 0.002;
      const p = 1 + ((s + k * 0.41) % 1.8) * 1.3;
      bc.pulse.scale.set(p, p, p); bc.pulse.material.opacity = 0.7 * (1 - (p - 1) / 2.34);
    });
  }
  pins.forEach((p, k) => p.classList.toggle("compact", k !== HQ.cur));
  composer.render();
  beacons.forEach((bc, k) => { v.copy(bc.g.position).add(bc.top); place(pins[k], v, -14); });
  tags.forEach((t) => place(t.el, t.p.y === INSET.y ? t.p.clone().setY(disc.position.y) : t.p));
  if (first) { first = false; window.HQmapReady && window.HQmapReady(); }
});
