/* 手机版的基地卡片轨道（普通脚本，不依赖 3D）
   3D 地图加载失败或很慢时，卡片、圆点和"进入 3D 园区"按钮依然可用。
   3D 模块通过 HQ.on() 监听选择变化，通过 HQ.select() 回传光柱点击。 */
(function () {
  var B = window.BASES;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var pad2 = function (n) { return String(n).padStart(2, "0"); };

  var rail = $("rail"), dots = $("dots"), whole = $("whole");
  rail.innerHTML = B.map(function (b, i) {
    return '<article class="bc" style="--cc:' + b.color + '" data-i="' + i + '">' +
      '<img src="hub/' + b.id + '.jpg" alt="' + b.name + '实景" loading="' + (i < 2 ? "eager" : "lazy") + '">' +
      '<div class="bt"><div class="tagl"><b>' + b.city + '</b><span class="mono">' + pad2(i + 1) + ' / ' + pad2(B.length) + '</span></div>' +
      '<h2>' + b.name + '</h2><p class="addr">' + b.addr + '</p>' +
      '<a class="go" href="' + b.dir + '">进入 3D 园区 ' + arrow + '</a></div></article>';
  }).join("");
  dots.innerHTML = B.map(function (b, i) {
    return '<button type="button" style="--cc:' + b.color + '" aria-label="' + b.name + '" data-dot="' + i + '"></button>';
  }).join("");
  var cards = Array.prototype.slice.call(rail.children);
  var dotBtns = Array.prototype.slice.call(dots.children);

  var listeners = [], railLock = 0;
  var HQ = window.HQ = {
    cur: 0,
    overview: true,
    on: function (fn) { listeners.push(fn); },
    /* fly：镜头是否飞过去；scrollRail：是否把卡片滚到中间（由滑动触发时不需要） */
    select: function (i, fly, scrollRail) {
      HQ.cur = (i + B.length) % B.length;
      if (fly) { HQ.overview = false; whole.setAttribute("aria-pressed", "false"); }
      cards.forEach(function (c, k) { c.classList.toggle("on", k === HQ.cur); });
      dotBtns.forEach(function (d, k) { d.setAttribute("aria-current", String(k === HQ.cur)); });
      if (scrollRail !== false) {
        railLock = Date.now() + 700;
        var c = cards[HQ.cur];
        rail.scrollTo({ left: c.offsetLeft - (rail.clientWidth - c.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
      }
      listeners.forEach(function (fn) { fn("select", HQ.cur, !!fly); });
    },
    whole: function () {
      HQ.overview = true; whole.setAttribute("aria-pressed", "true");
      listeners.forEach(function (fn) { fn("whole"); });
    }
  };

  dotBtns.forEach(function (d) { d.addEventListener("click", function () { HQ.select(+d.dataset.dot, true, true); }); });
  whole.addEventListener("click", HQ.whole);

  /* 滑动卡片停下后，选中居中的那张，镜头飞过去 */
  var settle;
  rail.addEventListener("scroll", function () {
    clearTimeout(settle);
    settle = setTimeout(function () {
      if (Date.now() < railLock) return;
      var mid = rail.scrollLeft + rail.clientWidth / 2, best = 0, bd = Infinity;
      cards.forEach(function (c, k) { var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = k; } });
      if (best !== HQ.cur || HQ.overview) HQ.select(best, true, false);
    }, 140);
  }, { passive: true });

  HQ.select(0, false, false);

  /* 3D 状态提示：先显示静态岛图，3D 就绪后淡入；20 秒仍未就绪则提示可直接点卡片 */
  var app = document.querySelector(".app");
  window.HQmapReady = function () { app.classList.add("ready"); };
  window.HQmapFailed = function () { app.classList.add("failed"); };
  setTimeout(function () { if (!app.classList.contains("ready")) app.classList.add("slow"); }, 20000);
})();
