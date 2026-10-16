/* 惠企孵化基地总览 · 海南岛 3D 地图
   - 地形：按真实海岸线生成的高度场（五指山、鹦哥岭等山脉隆起，近岸浅滩透出海水）
   - 海口四个基地相距仅数公里，放在岛北上空的"海口放大镜"圆盘里显示
   - 三亚基地直接立在岛南的地形上 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import GEO from "./hainan-geo.js";

const B = window.BASES;
const $ = (id) => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (b) => `${b.lat.toFixed(3)}°N ${b.lon.toFixed(3)}°E`;
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* ---------- 基地列表 ---------- */
$("list").innerHTML = B.map((b, i) => `
  <li class="base" style="--cc:${b.color}">
    <span class="no">${String(i + 1).padStart(2, "0")}</span>
    <img src="hub/${b.id}.jpg" alt="${b.name}实景" loading="lazy">
    <div class="txt">
      <h3>${b.name}</h3>
      <div class="addr">${b.addr}</div>
      <div class="coord">${b.city} · ${fmt(b)}</div>
      <div class="chips">${b.chips.map((c) => `<span>${c}</span>`).join("")}</div>
    </div>
    <div class="acts">
      <a class="go" href="${b.dir}">进入 3D 园区 ${arrow}</a>
      <button class="ghost" type="button" data-show="${i}">在地图上查看</button>
    </div>
  </li>`).join("");

/* ---------- 投影：经纬度 → 场景坐标（1 单位 ≈ 0.1°） ---------- */
const K = 10, LON0 = 109.85, LAT0 = 19.15, KX = K * Math.cos((19.2 * Math.PI) / 180);
const px = (lon) => (lon - LON0) * KX, pz = (lat) => -(lat - LAT0) * K;

/* 海口放大镜：以海口主城为中心，放大 7 倍，悬在岛北海面上空 */
const HK = { lon: 110.338, lat: 20.056 }, ZOOM = 7, R_LENS = 0.62, R_INSET = R_LENS * ZOOM;
const LENS = new THREE.Vector2(px(HK.lon), pz(HK.lat));
const INSET = new THREE.Vector3(LENS.x + 0.6, 3.1, LENS.y - 6.6);
const inHaikou = (b) => b.lat > 19.8;
const insetXZ = (lon, lat) => new THREE.Vector2(INSET.x + (px(lon) - LENS.x) * ZOOM, INSET.z + (pz(lat) - LENS.y) * ZOOM);

/* ---------- 海岸线距离场 ---------- */
const coast = GEO.coast.map(([lo, la]) => [px(lo), pz(la)]);
const islets = GEO.islets.map((r) => r.map(([lo, la]) => [px(lo), pz(la)]));
function inside(x, z, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function segDist(x, z, ring) {
  let m = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
    let t = l ? ((x - ax) * dx + (z - az) * dz) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * dx - x, ez = az + t * dz - z, d = ex * ex + ez * ez;
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}
/* 有符号距离：岛内为正 */
function sdist(x, z) {
  let d = segDist(x, z, coast), s = inside(x, z, coast) ? 1 : -1;
  for (const r of islets) { const di = segDist(x, z, r); if (di < d) { d = di; s = inside(x, z, r) ? 1 : -1; } }
  return s * d;
}

/* ---------- 地形高度 ---------- */
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => 0.5 * vnoise(x, z) + 0.28 * vnoise(x * 2.1 + 5, z * 2.1) + 0.16 * vnoise(x * 4.3, z * 4.3 + 9) + 0.06 * vnoise(x * 8.7 + 3, z * 8.7);
const PEAKS = [ // 经度, 纬度, 高度, 范围
  [109.67, 18.90, 2.1, 1.25], [109.43, 19.06, 1.9, 1.35], [109.13, 19.08, 1.35, 1.15],
  [108.95, 18.73, 1.25, 0.95], [109.88, 18.72, 1.2, 1.05], [109.75, 19.18, 1.35, 1.15],
  [109.55, 18.95, 0.8, 2.8], [109.98, 18.95, 0.55, 1.4]
].map(([lo, la, a, s]) => [px(lo), pz(la), a, 2 * s * s]);
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
function landH(x, z, d) {
  const ramp = smooth(0, 1.3, d), n = fbm(x * 0.55, z * 0.55);
  let m = 0;
  for (const [cx, cz, a, s2] of PEAKS) m += a * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / s2);
  return 0.05 + 0.22 * ramp + ramp * (m * (0.7 + 0.6 * n) + 0.14 * n);
}
function heightAt(x, z) {
  const d = sdist(x, z);
  return d > 0 ? landH(x, z, d) : -0.04 - Math.min(-d * 0.55, 1.6) - 0.08 * fbm(x, z) * smooth(0, 0.6, -d);
}

/* ---------- 渲染器与场景 ---------- */
const canvas = $("map");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const SKY = 0x061521;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.FogExp2(SKY, 0.0135);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 9; controls.maxDistance = 75;
controls.maxPolarAngle = Math.PI * 0.43; controls.enablePan = false;

scene.add(new THREE.HemisphereLight(0xbfdcf0, 0x0a2030, 0.75));
const sun = new THREE.DirectionalLight(0xffe6c2, 2.1); sun.position.set(-16, 14, 9); scene.add(sun);
const rim = new THREE.DirectionalLight(0x6fc3ff, 0.5); rim.position.set(14, 6, -12); scene.add(rim);

/* 地形网格 */
const GW = 31, GD = 26.5, SX = 300, SZ = 256, GZ0 = -0.3;
const tg = new THREE.PlaneGeometry(GW, GD, SX, SZ); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, GZ0);
const pos = tg.attributes.position, col = new Float32Array(pos.count * 3);
const C = (h) => new THREE.Color(h);
const deep = C(0x0a2a43), shelf = C(0x2fa7a6), sand = C(0xe6d4a2), low = C(0x86b56b), mid = C(0x4a8a4e), forest = C(0x2c6644), high = C(0x5f7d5f), top = C(0x7d9672);
const tmp = new THREE.Color();
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i), d = sdist(x, z);
  let h, c;
  if (d > 0) {
    h = landH(x, z, d);
    const n = fbm(x * 1.7 + 11, z * 1.7) - 0.5;
    const hh = h + n * 0.18;
    if (hh < 0.13) c = tmp.copy(sand).lerp(low, smooth(0.06, 0.13, hh));
    else if (hh < 0.55) c = tmp.copy(low).lerp(mid, smooth(0.13, 0.55, hh));
    else if (hh < 1.25) c = tmp.copy(mid).lerp(forest, smooth(0.55, 1.1, hh));
    else c = tmp.copy(forest).lerp(high, smooth(1.25, 1.9, hh)).lerp(top, smooth(2.0, 2.6, hh));
  } else {
    h = -0.04 - Math.min(-d * 0.55, 1.6) - 0.08 * fbm(x, z) * smooth(0, 0.6, -d);
    c = tmp.copy(shelf).lerp(deep, smooth(0, 2.4, -d));
  }
  pos.setY(i, h);
  col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
}
tg.setAttribute("color", new THREE.BufferAttribute(col, 3));
tg.computeVertexNormals();
scene.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })));

/* 远海海床与海面 */
const bed = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: deep, roughness: 1 }));
bed.rotation.x = -Math.PI / 2; bed.position.y = -1.66; scene.add(bed);
const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0c3a57, roughness: 0.42, metalness: 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
water.rotation.x = -Math.PI / 2; scene.add(water);

/* 海岸浪花线 */
const lineOn = (pts, y) => pts.map(([x, z]) => new THREE.Vector3(x, y, z));
const foam = new THREE.LineBasicMaterial({ color: 0xf4ead0, transparent: true, opacity: 0.55 });
const cl = lineOn(coast, 0.03); cl.push(cl[0].clone());
scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cl), foam));

/* 市县界：贴着地形 */
const borderMat = new THREE.LineBasicMaterial({ color: 0xf6f0dc, transparent: true, opacity: 0.2 });
for (const line of GEO.borders) {
  const pts = [];
  for (let k = 0; k < line.length; k++) {
    const [x0, z0] = [px(line[k][0]), pz(line[k][1])];
    pts.push(new THREE.Vector3(x0, heightAt(x0, z0) + 0.04, z0));
    if (k < line.length - 1) {
      const [x1, z1] = [px(line[k + 1][0]), pz(line[k + 1][1])], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.12);
      for (let s = 1; s < n; s++) { const x = x0 + ((x1 - x0) * s) / n, z = z0 + ((z1 - z0) * s) / n; pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.04, z)); }
    }
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat));
}

/* 经纬网（画在海面，陆地会盖住） */
const gridMat = new THREE.LineBasicMaterial({ color: 0x5f9cc0, transparent: true, opacity: 0.16 });
const gratLabels = [];
for (let lon = 108; lon <= 111.6; lon += 0.5) {
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px(lon), 0.01, pz(17.4)), new THREE.Vector3(px(lon), 0.01, pz(21.6))]), gridMat));
  if (Number.isInteger(lon)) gratLabels.push({ t: `${lon}°E`, p: new THREE.Vector3(px(lon), 0.02, pz(17.75)) });
}
for (let lat = 17.5; lat <= 21.6; lat += 0.5) {
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px(107.6), 0.01, pz(lat)), new THREE.Vector3(px(112.2), 0.01, pz(lat))]), gridMat));
  if (Number.isInteger(lat)) gratLabels.push({ t: `${lat}°N`, p: new THREE.Vector3(px(111.85), 0.02, pz(lat)) });
}

/* ---------- 海口放大镜 ---------- */
function drapedRing(cx, cz, r, lift) {
  const pts = [];
  for (let k = 0; k <= 96; k++) { const a = (k / 96) * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; pts.push(new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + lift, z)); }
  return pts;
}
const sandMat = (o) => new THREE.LineBasicMaterial({ color: 0xf1e3bd, transparent: true, opacity: o });
scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(drapedRing(LENS.x, LENS.y, R_LENS, 0.05)), sandMat(0.9)));
const lensFill = new THREE.Mesh(new THREE.CircleGeometry(R_LENS, 48), new THREE.MeshBasicMaterial({ color: 0xf1e3bd, transparent: true, opacity: 0.12, depthWrite: false }));
lensFill.rotation.x = -Math.PI / 2; lensFill.position.set(LENS.x, 0.36, LENS.y); scene.add(lensFill);

/* 圆盘表面：用 canvas 画出放大后的海口海岸 */
function insetTexture() {
  const S = 1024, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d");
  const toPx = (lon, lat) => { const v = insetXZ(lon, lat); return [((v.x - INSET.x) / R_INSET * 0.5 + 0.5) * S, ((v.y - INSET.z) / R_INSET * 0.5 + 0.5) * S]; };
  const sea = g.createRadialGradient(S * 0.5, S * 0.5, 0, S * 0.5, S * 0.5, S * 0.55);
  sea.addColorStop(0, "#1d6f86"); sea.addColorStop(1, "#0d3a55");
  g.fillStyle = sea; g.fillRect(0, 0, S, S);
  /* 浅滩光晕 */
  g.save(); g.shadowColor = "rgba(90,210,205,.75)"; g.shadowBlur = 60;
  g.beginPath(); GEO.coast.forEach(([lo, la], k) => { const [x, y] = toPx(lo, la); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
  const land = g.createLinearGradient(0, 0, 0, S); land.addColorStop(0, "#a7c98a"); land.addColorStop(1, "#6f9f62");
  g.fillStyle = land; g.fill(); g.restore();
  g.lineWidth = 5; g.strokeStyle = "#f4e7c4"; g.stroke();
  /* 陆地上的细碎明暗，模拟城市肌理 */
  g.save(); g.clip();
  for (let k = 0; k < 2600; k++) {
    const x = hash(k, 1) * S, y = hash(k, 2) * S, r = 3 + hash(k, 3) * 9;
    g.fillStyle = hash(k, 4) > 0.5 ? "rgba(255,250,230,.07)" : "rgba(20,50,25,.08)";
    g.fillRect(x, y, r, r * (0.6 + hash(k, 5)));
  }
  g.restore();
  /* 经纬细网 */
  g.strokeStyle = "rgba(255,255,255,.13)"; g.lineWidth = 1.5; g.font = "500 22px 'IBM Plex Mono', monospace"; g.fillStyle = "rgba(240,232,210,.55)";
  for (let lat = 20.0; lat <= 20.12; lat += 0.02) { const [, y] = toPx(HK.lon, lat); g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); g.fillText(`${lat.toFixed(2)}°N`, S * 0.79, y - 8); }
  for (let lon = 110.26; lon <= 110.42; lon += 0.02) { const [x] = toPx(lon, HK.lat); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  g.font = "700 40px 'Noto Serif SC', 'Songti SC', serif"; g.fillStyle = "rgba(240,248,250,.5)"; g.textAlign = "center";
  const [sx, sy] = toPx(HK.lon - 0.01, 20.128); g.fillText("琼 州 海 峡", sx, sy);
  g.font = "600 30px 'Noto Sans SC', sans-serif"; g.fillStyle = "rgba(25,55,30,.6)";
  [["海 甸 岛", 110.322, 20.078], ["新 埠 岛", 110.392, 20.07], ["海 口 主 城", 110.315, 20.022]].forEach(([n, lo, la]) => { const [x, y] = toPx(lo, la); g.fillText(n, x, y); });
  /* 圆形遮罩 */
  g.globalCompositeOperation = "destination-in"; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const disc = new THREE.Group(); disc.position.copy(INSET); scene.add(disc);
const body = new THREE.Mesh(new THREE.CylinderGeometry(R_INSET, R_INSET * 0.97, 0.32, 96, 1, true),
  new THREE.MeshStandardMaterial({ color: 0xe9dcb8, roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide }));
body.position.y = -0.16; disc.add(body);
const under = new THREE.Mesh(new THREE.CircleGeometry(R_INSET * 0.97, 96), new THREE.MeshStandardMaterial({ color: 0x0b2232, roughness: 0.8 }));
under.rotation.x = Math.PI / 2; under.position.y = -0.32; disc.add(under);
let face;
function buildFace() {
  if (face) { disc.remove(face); face.material.map.dispose(); }
  face = new THREE.Mesh(new THREE.CircleGeometry(R_INSET, 96), new THREE.MeshStandardMaterial({ map: insetTexture(), roughness: 0.75 }));
  face.rotation.x = -Math.PI / 2; face.rotation.z = 0; face.position.y = 0.002; disc.add(face);
}
buildFace();
document.fonts && document.fonts.ready.then(buildFace);
/* 圆盘外沿光环 */
const halo = new THREE.Mesh(new THREE.RingGeometry(R_INSET * 1.0, R_INSET * 1.035, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf6e7bf).multiplyScalar(1.12), toneMapped: false, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
halo.rotation.x = -Math.PI / 2; halo.position.y = 0.01; disc.add(halo);
/* 圆盘在海面的投影 */
const shadow = new THREE.Mesh(new THREE.CircleGeometry(R_INSET * 1.05, 64), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.set(INSET.x - 0.8, 0.02, INSET.z + 0.6); scene.add(shadow);

/* 镜头光锥：从岛上的小圆连到圆盘 */
{
  const dir = new THREE.Vector2(INSET.x - LENS.x, INSET.z - LENS.y).normalize(), nrm = new THREE.Vector2(-dir.y, dir.x);
  const a1 = new THREE.Vector3(LENS.x + nrm.x * R_LENS, 0.36, LENS.y + nrm.y * R_LENS), a2 = new THREE.Vector3(LENS.x - nrm.x * R_LENS, 0.36, LENS.y - nrm.y * R_LENS);
  const b1 = new THREE.Vector3(INSET.x + nrm.x * R_INSET, INSET.y - 0.3, INSET.z + nrm.y * R_INSET), b2 = new THREE.Vector3(INSET.x - nrm.x * R_INSET, INSET.y - 0.3, INSET.z - nrm.y * R_INSET);
  const g = new THREE.BufferGeometry().setFromPoints([a1, b1, b2, a1, b2, a2]); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xf1e3bd, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([a1, b1, a2, b2]), sandMat(0.45)));
}

/* ---------- 基地光柱 ---------- */
const beacons = B.map((b, i) => {
  const c = new THREE.Color(b.color), g = new THREE.Group();
  let y;
  if (inHaikou(b)) { const v = insetXZ(b.lon, b.lat); g.position.set(v.x, INSET.y + 0.002, v.y); y = 0; }
  else { const x = px(b.lon), z = pz(b.lat); g.position.set(x, Math.max(heightAt(x, z), 0), z); }
  const H = inHaikou(b) ? 3.0 : 4.2;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false }));
  beam.position.y = H / 2; g.add(beam);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, H, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  glow.position.y = H / 2; g.add(glow);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.6), toneMapped: false }));
  cap.position.y = H; g.add(cap);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.12, 28), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.4 }));
  foot.position.y = 0.06; g.add(foot);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.04; g.add(pulse);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, H + 0.6, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = H / 2; hit.userData.i = i; g.add(hit);
  scene.add(g);
  return { g, beam, glow, pulse, cap, top: new THREE.Vector3(0, H + 0.25, 0) };
});

/* ---------- HTML 标签 ---------- */
const labels = $("labels");
const mk = (cls, text) => { const el = document.createElement("div"); el.className = cls; el.textContent = text; labels.appendChild(el); return el; };
const pins = B.map((b, i) => {
  const el = document.createElement("button");
  el.type = "button"; el.className = "pin"; el.style.setProperty("--c", b.color);
  el.innerHTML = `<span>${b.name}</span>`; el.setAttribute("aria-pressed", "false");
  el.addEventListener("click", () => select(i, true));
  labels.appendChild(el); return el;
});
const tags = [];
const tag = (cls, text, p) => tags.push({ el: mk(cls, text), p });
for (const [n, [lo, la]] of Object.entries(GEO.cities)) {
  if (n === "海口" || n === "三亚") continue;
  const x = px(lo), z = pz(la); tag("region", n, new THREE.Vector3(x, heightAt(x, z) + 0.2, z));
}
tag("city", "三亚", new THREE.Vector3(px(109.51), 0.3, pz(18.24) + 0.9));
tag("hk", "海口 4 个基地 · 放大 7 倍", new THREE.Vector3(INSET.x, INSET.y, INSET.z + R_INSET + 0.7));
tag("peak", "▲ 五指山 1867 m", new THREE.Vector3(px(109.67), landH(px(109.67), pz(18.9), 3) + 0.35, pz(18.9)));
tag("sea", "南 海", new THREE.Vector3(px(110.9), 0, pz(17.85)));
tag("sea", "北 部 湾", new THREE.Vector3(px(108.25), 0, pz(19.65)));
gratLabels.forEach((g) => tag("grat", g.t, g.p));

/* ---------- 后期：光柱辉光 ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

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
let cur = 1, tw = null;
function flyTo(i) {
  const { t, c } = viewFor(i);
  if (reduce) { controls.target.copy(t); camera.position.copy(c); return; }
  tw = { t0: performance.now(), d: 1300, fromC: camera.position.clone(), fromT: controls.target.clone(), toC: c, toT: t };
}
function select(i, fly) {
  cur = (i + B.length) % B.length;
  const b = B[cur];
  $("card").style.setProperty("--cc", b.color);
  $("cImg").src = `hub/${b.id}.jpg`; $("cImg").alt = `${b.name}实景`;
  $("cCity").textContent = b.city; $("cCoord").textContent = fmt(b);
  $("cName").textContent = b.name; $("cDesc").textContent = b.desc;
  $("cGo").href = b.dir; $("cCount").textContent = `${cur + 1} / ${B.length}`;
  pins.forEach((p, k) => p.setAttribute("aria-pressed", String(k === cur)));
  beacons.forEach((bc, k) => { const on = k === cur; bc.beam.material.opacity = on ? 1 : 0.55; bc.glow.material.opacity = on ? 0.22 : 0.08; bc.g.scale.setScalar(on ? 1.12 : 1); });
  if (fly) flyTo(cur);
}
$("whole").addEventListener("click", () => flyTo(null));
$("prev").addEventListener("click", () => select(cur - 1, true));
$("next").addEventListener("click", () => select(cur + 1, true));
document.querySelectorAll("[data-show]").forEach((btn) => btn.addEventListener("click", () => {
  select(+btn.dataset.show, true); $("top").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
}));

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
  if (h) select(h.object.userData.i, true);
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
select(cur, false);

/* ---------- 循环 ---------- */
const v = new THREE.Vector3();
function place(el, p, dy = 0) {
  v.copy(p).project(camera);
  const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
  el.style.visibility = vis ? "visible" : "hidden";
  el.style.transform = `translate(${(v.x * 0.5 + 0.5) * canvas.clientWidth}px, ${(-v.y * 0.5 + 0.5) * canvas.clientHeight + dy}px) translate(-50%,-50%)`;
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let last = performance.now();
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
  pins.forEach((p, k) => p.classList.toggle("compact", far && inHaikou(B[k]) && k !== cur));
  composer.render();
  beacons.forEach((bc, k) => { v.copy(bc.g.position).add(bc.top); place(pins[k], v, -16); });
  tags.forEach((t) => place(t.el, t.p.y === INSET.y ? t.p.clone().setY(disc.position.y) : t.p));
});
