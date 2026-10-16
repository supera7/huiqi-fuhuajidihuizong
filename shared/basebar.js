/* 五大孵化基地 · 共享导航条
   在每个基地子站右下角放一个"返回总览 / 切换基地"的悬浮条。
   进入沉浸式 3D 模式（各子站 z-index ≥ 60 的全屏层）时自动被覆盖，不干扰浏览。 */
(function () {
  var me = document.currentScript;
  var root = new URL("../", me ? me.src : location.href).href;
  var BASES = [
    { dir: "haishang-zhigu-3d", name: "海南海商智谷", city: "海口 · 新埠岛", c: "#c3f879" },
    { dir: "lianchuangzhixing-3d", name: "联创之星孵化基地", city: "海口 · 海甸岛", c: "#f5c21b" },
    { dir: "huiqi-3d", name: "惠企共产小院", city: "海口 · 亚龙别墅", c: "#2fb5c4" },
    { dir: "huiqichuangyeshequ", name: "惠企创业社区", city: "海口 · 美兰区", c: "#c99a5b" },
    { dir: "hntou-kjy-3d", name: "热海大国家大学科技园", city: "三亚 · 吉阳区", c: "#f07a3a" }
  ];
  var path = location.pathname;
  var cur = -1;
  BASES.forEach(function (b, i) { if (path.indexOf("/" + b.dir + "/") !== -1 || path.slice(-b.dir.length) === b.dir) cur = i; });

  var css = [
    ".hq-bar{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:55;",
    "display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(10,16,22,.82);",
    "backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.14);",
    "box-shadow:0 10px 30px rgba(0,0,0,.35);font:500 13px/1 'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif;color:#eef2f5}",
    ".hq-bar a,.hq-bar button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:999px;color:inherit;white-space:nowrap}",
    ".hq-bar a:hover,.hq-bar button:hover,.hq-bar button[aria-expanded=true]{background:rgba(255,255,255,.1)}",
    ".hq-bar :focus-visible{outline:2px solid #fff;outline-offset:1px}",
    ".hq-bar svg{width:15px;height:15px;flex:none}",
    ".hq-dot{width:8px;height:8px;border-radius:50%;flex:none}",
    ".hq-sep{width:1px;height:18px;background:rgba(255,255,255,.16)}",
    ".hq-menu{position:absolute;right:0;bottom:calc(100% + 8px);min-width:250px;padding:6px;border-radius:14px;background:rgba(10,16,22,.96);",
    "border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px rgba(0,0,0,.45)}",
    ".hq-menu[hidden]{display:none}",
    ".hq-menu a{display:flex;width:100%;box-sizing:border-box;border-radius:9px;padding:10px 12px;gap:10px}",
    ".hq-menu a b{font-weight:500;display:block}.hq-menu a small{display:block;margin-top:4px;font-size:11px;opacity:.6}",
    ".hq-menu a[aria-current=page]{background:rgba(255,255,255,.08)}",
    "@media (max-width:520px){.hq-bar .hq-lbl{display:none}}"
  ].join("");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var bar = document.createElement("nav");
  bar.className = "hq-bar"; bar.setAttribute("aria-label", "孵化基地导航");
  var hubPage = "index.html";
  try { var hp = sessionStorage.getItem("hq-hub"); if (hp === "m.html" || hp === "index.html") hubPage = hp; } catch (e) {}
  var home = '<a href="' + root + hubPage + '" title="返回五大孵化基地总览">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>' +
    '<span class="hq-lbl">基地总览</span></a>';
  var items = BASES.map(function (b, i) {
    return '<a href="' + root + b.dir + '/index.html"' + (i === cur ? ' aria-current="page"' : "") + '>' +
      '<span class="hq-dot" style="background:' + b.c + ';margin-top:4px;align-self:flex-start"></span>' +
      '<span><b>' + b.name + '</b><small>' + b.city + '</small></span></a>';
  }).join("");
  var c = cur >= 0 ? BASES[cur].c : "#fff";
  bar.innerHTML = home + '<span class="hq-sep"></span>' +
    '<button type="button" aria-haspopup="true" aria-expanded="false"><span class="hq-dot" style="background:' + c + '"></span>' +
    '<span class="hq-lbl">切换基地</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15l6-6 6 6"/></svg></button>' +
    '<div class="hq-menu" hidden>' + items + '</div>';

  function mount() {
    document.body.appendChild(bar);
    var btn = bar.querySelector("button"), menu = bar.querySelector(".hq-menu");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menu.hidden; menu.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) { if (!bar.contains(e.target)) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
