/* 惠企孵化基地总览 · 电脑版 3D 地图（视角、选择与动画）
   场景本身在 scene.js；卡片与列表在 ui-desktop.js，这里只通过 window.HQ 联动。 */
import { buildScene } from "./scene.js";

const B = window.BASES, HQ = window.HQ;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let S;
try {
  S = buildScene({
    canvas: document.getElementById("map"), labels: document.getElementById("labels"),
    maxPixelRatio: 1.75, exposure: 1.05, segX: 300, segZ: 256, bloom: [0.85, 0.55, 0.92],
    onPick: (i) => HQ.select(i, true)
  });
} catch (e) {
  console.error(e); window.HQmapFailed && window.HQmapFailed();
  throw e;
}
const { THREE, renderer, camera, controls, composer, bloom, canvas, INSET, inHaikou, beacons, pins, tags, disc } = S;

/* ---------- 视角与选择 ---------- */
const islandC = new THREE.Vector3(0.3, 0, -5.2);
function viewFor(i) {
  const narrow = innerWidth < 640, wide = innerWidth >= 1000;
  let t, d;
  if (i == null) { t = islandC.clone(); d = narrow ? 66 : 49; if (wide) t.x -= 6.5; }
  else if (inHaikou(B[i])) { t = new THREE.Vector3(INSET.x, INSET.y * 0.7, INSET.z + 0.6); d = narrow ? 28 : 25; if (wide) t.x -= 4.5; }
  else { const g = beacons[i].g.position; t = new THREE.Vector3(g.x, 0.6, g.z - 2.2); d = narrow ? 28 : 24; if (wide) t.x -= 4.5; }
  return { t, c: t.clone().add(new THREE.Vector3(-d * 0.16, d * 0.74, d * 0.66)) };
}
let tw = null;
function flyTo(i) {
  const { t, c } = viewFor(i);
  if (reduce) { controls.target.copy(t); camera.position.copy(c); return; }
  tw = { t0: performance.now(), d: 1300, fromC: camera.position.clone(), fromT: controls.target.clone(), toC: c, toT: t };
}
function highlight(cur) {
  pins.forEach((p, k) => p.setAttribute("aria-pressed", String(k === cur)));
  beacons.forEach((bc, k) => { const on = k === cur; bc.beam.material.opacity = on ? 1 : 0.55; bc.glow.material.opacity = on ? 0.22 : 0.08; bc.g.scale.setScalar(on ? 1.12 : 1); });
}
HQ.on((type, i, fly) => {
  if (type === "whole") return flyTo(null);
  highlight(i); if (fly) flyTo(i);
});

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const hits = beacons.map((b) => b.g.children[b.g.children.length - 1]);
let down = null;
canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(hits)[0];
  if (h) HQ.select(h.object.userData.i, true);
});
let idle = 0;
controls.addEventListener("start", () => { tw = null; idle = -1; });
controls.addEventListener("end", () => { idle = 0; });

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize();
{ const v = viewFor(null); controls.target.copy(v.t); camera.position.copy(v.c); }
highlight(HQ.cur);

/* ---------- 循环 ---------- */
const v = new THREE.Vector3();
function place(el, p, dy = 0) {
  v.copy(p).project(camera);
  const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
  el.style.visibility = vis ? "visible" : "hidden";
  el.style.transform = `translate(${(v.x * 0.5 + 0.5) * canvas.clientWidth}px, ${(-v.y * 0.5 + 0.5) * canvas.clientHeight + dy}px) translate(-50%,-50%)`;
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let last = performance.now(), first = true;
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (tw) {
    const k = ease(Math.min((now - tw.t0) / tw.d, 1));
    camera.position.lerpVectors(tw.fromC, tw.toC, k); controls.target.lerpVectors(tw.fromT, tw.toT, k);
    if (k >= 1) tw = null;
  } else if (!reduce && idle >= 0 && (idle += dt) > 5) {
    const t = controls.target, off = camera.position.clone().sub(t);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.04); camera.position.copy(t).add(off);
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
  const far = camera.position.distanceTo(INSET) > 30;
  pins.forEach((p, k) => p.classList.toggle("compact", far && inHaikou(B[k]) && k !== HQ.cur));
  composer.render();
  beacons.forEach((bc, k) => { v.copy(bc.g.position).add(bc.top); place(pins[k], v, -16); });
  tags.forEach((t) => place(t.el, t.p.y === INSET.y ? t.p.clone().setY(disc.position.y) : t.p));
  if (first) { first = false; window.HQmapReady && window.HQmapReady(); }
});
