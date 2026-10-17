/* 电脑版首页的卡片与列表（普通脚本，不依赖 3D）
   3D 地图加载失败或很慢时，基地卡片、列表和"进入 3D 园区"按钮依然可用。
   3D 模块通过 HQ.on() 监听选择变化，通过 HQ.select() 回传光柱点击。 */
(function () {
  var B = window.BASES;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (b) { return b.lat.toFixed(3) + "°N " + b.lon.toFixed(3) + "°E"; };
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  $("list").innerHTML = B.map(function (b, i) {
    return '<li class="base" style="--cc:' + b.color + '">' +
      '<span class="no">' + String(i + 1).padStart(2, "0") + '</span>' +
      '<img src="hub/' + b.id + '.jpg" alt="' + b.name + '实景" loading="lazy">' +
      '<div class="txt"><h3>' + b.name + '</h3>' +
      '<div class="addr">' + b.addr + '</div>' +
      '<div class="coord">' + b.city + ' · ' + fmt(b) + '</div>' +
      '<div class="chips">' + b.chips.map(function (c) { return "<span>" + c + "</span>"; }).join("") + '</div></div>' +
      '<div class="acts"><a class="go" href="' + b.dir + '">进入 3D 园区 ' + arrow + '</a>' +
      '<button class="ghost" type="button" data-show="' + i + '">在地图上查看</button></div></li>';
  }).join("");

  var listeners = [];
  var HQ = window.HQ = {
    cur: 1,
    on: function (fn) { listeners.push(fn); },
    select: function (i, fly) {
      HQ.cur = (i + B.length) % B.length;
      var b = B[HQ.cur];
      $("card").style.setProperty("--cc", b.color);
      $("cImg").src = "hub/" + b.id + ".jpg"; $("cImg").alt = b.name + "实景";
      $("cCity").textContent = b.city; $("cCoord").textContent = fmt(b);
      $("cName").textContent = b.name; $("cDesc").textContent = b.desc;
      $("cGo").href = b.dir; $("cCount").textContent = (HQ.cur + 1) + " / " + B.length;
      listeners.forEach(function (fn) { fn("select", HQ.cur, !!fly); });
    },
    whole: function () { listeners.forEach(function (fn) { fn("whole"); }); }
  };

  $("whole").addEventListener("click", HQ.whole);
  $("prev").addEventListener("click", function () { HQ.select(HQ.cur - 1, true); });
  $("next").addEventListener("click", function () { HQ.select(HQ.cur + 1, true); });
  document.querySelectorAll("[data-show]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      HQ.select(+btn.dataset.show, true);
      $("top").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });
  HQ.select(HQ.cur, false);

  /* 3D 状态提示：先显示静态岛图，3D 就绪后淡入；20 秒仍未就绪则提示可直接点卡片 */
  var stage = document.querySelector(".stage");
  window.HQmapReady = function () { stage.classList.add("ready"); };
  window.HQmapFailed = function () { stage.classList.add("failed"); };
  setTimeout(function () { if (!stage.classList.contains("ready")) stage.classList.add("slow"); }, 20000);
})();
