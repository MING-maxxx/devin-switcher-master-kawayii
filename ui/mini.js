(() => {
  "use strict";
  const MINI = !!window.__MINI__ || /[?&]mini=1/.test(location.search);
  const zh = () => localStorage.getItem("dsw-lang") !== "en";
  const L = (a, b) => (zh() ? a : b);
  const inv = (cmd, args) => {
    const raw = window.__TAURI__.core.invoke;
    return (window.dswWrapInvoke ? window.dswWrapInvoke(raw) : raw)(cmd, args);
  };
  const ready = (f) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", f) : f());
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  if (!MINI) {
    ready(() => {
      const lb = document.getElementById("langBtn");
      if (!lb) return;
      const b = document.createElement("button");
      b.id = "miniBtn";
      b.className = "lang";
      const lab = () => { b.textContent = L("浮窗", "Float"); };
      lab();
      lb.after(b);
      b.onclick = () => inv("mini_enter").catch(() => {});
      lb.addEventListener("click", () => setTimeout(lab, 50));
    });
    return;
  }

  const M = window.dswMascot;
  let status = null, profiles = [], root, bub, img, info, btns, menu, bubTimer, dragging = false, down = null;
  const rst = (u) => {
    if (!u) return "";
    const s = u - Date.now() / 1000;
    if (s <= 0) return "";
    const m = Math.round(s / 60), h = Math.round(s / 3600), d = Math.round(s / 86400);
    const x = s < 3600 ? L(`${m}分钟`, `${m}m`) : s < 172800 ? L(`${h}小时`, `${h}h`) : L(`${d}天`, `${d}d`);
    return " · " + x + L("后重置", " left");
  };
  const row = (lab, pct, u) => {
    if (pct == null) return "";
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    const c = p >= 50 ? "ok" : p >= 20 ? "warn" : "low";
    return `<div class="m-q"><span class="qlab">${lab}</span><span class="qbar"><i class="${c}" style="width:${p}%"></i></span><span class="qval">${p}%${rst(u)}</span></div>`;
  };

  function render() {
    if (!info) return;
    const a = status && status.auth, d = status && status.desktop;
    const who = (e, n) => e || n || "";
    const cli = a && a.logged_in ? { tag: "CLI", name: who(a.email, a.name), u: status.usage } : null;
    const dsk = d && d.logged_in ? { tag: L("桌面端", "Desktop"), name: who(d.email, d.label || d.name), u: d.usage } : null;
    const same = cli && dsk && ((a.user_id && a.user_id === d.user_id) || (a.email && a.email === d.email));
    const main = cli || dsk;
    let h = "";
    if (!main) {
      h = `<div class="m-top"><b class="m-name">${L("未登录", "Not signed in")}</b></div>`;
    } else {
      const u = main.u || {};
      const plan = String(u.plan || "").trim();
      h = `<div class="m-top"><span class="m-tag">${same ? "CLI+" + dsk.tag : main.tag}</span><b class="m-name" title="${esc(main.name)}">${esc(main.name)}</b>${plan ? `<span class="plantag ${esc(plan.toLowerCase())}">${esc(plan)}</span>` : ""}</div>`;
      if (cli && dsk && !same) h += `<div class="m-sub">${dsk.tag}: ${esc(dsk.name)}</div>`;
      const weekly = u.weekly_left ?? (u.daily_left != null ? 0 : null);
      h += row(L("当天", "Daily"), u.daily_left, u.daily_reset_unix) + row(L("本周", "Weekly"), weekly, u.weekly_reset_unix);
    }
    info.innerHTML = h;
  }

  const sync = () => Promise.all([inv("get_status"), inv("list_profiles")]).catch(() => {});

  function toggleMenu() {
    if (menu) { menu.remove(); menu = null; return; }
    menu = document.createElement("div");
    menu.className = "m-menu";
    menu.innerHTML = profiles.length
      ? profiles.map((p) => { const m = p.meta || p, pl = (m.usage && m.usage.plan) || m.plan; return `<button data-n="${esc(p.name)}">${esc(m.email || p.name)}${pl ? " · " + esc(pl) : ""}</button>`; }).join("")
      : `<button disabled>${L("还没有保存的账号", "No saved accounts")}</button>`;
    menu.onclick = async (e) => {
      const b = e.target.closest("button[data-n]");
      if (!b) return;
      const n = b.dataset.n;
      menu.remove();
      menu = null;
      try { await inv("use_profile", { name: n, scope: "all" }); await sync(); } catch (_) {}
    };
    root.append(menu);
  }

  function build() {
    root = document.createElement("div");
    root.id = "mini";
    root.innerHTML = `<div class="m-bub"></div><img class="m-img" alt="" draggable="false"><div class="m-card"><div class="m-info"></div><div class="m-btns"></div></div>`;
    document.body.append(root);
    bub = root.querySelector(".m-bub");
    img = root.querySelector(".m-img");
    info = root.querySelector(".m-info");
    btns = root.querySelector(".m-btns");
    btns.innerHTML = `<button data-a="sw">${L("切换", "Switch")} ▾</button><button data-a="rf">${L("刷新", "Refresh")}</button><button data-a="ex">${L("展开", "Open")}</button><button data-a="hd" title="${L("收起到托盘", "Hide to tray")}">×</button>`;
    btns.onclick = (e) => {
      const b = e.target.closest("button");
      const a = b && b.dataset.a;
      if (a === "sw") toggleMenu();
      else if (a === "rf") inv("refresh_all").then(sync).catch(() => {});
      else if (a === "ex") inv("mini_leave").catch(() => {});
      else if (a === "hd") inv("mini_hide").catch(() => {});
    };

    M.onPaint = (k) => { const src = `mascot/${k}.png`; if (!img.src.endsWith(src)) img.src = src; };
    M.onSay = (text, ms) => { bub.textContent = text; bub.classList.add("show"); clearTimeout(bubTimer); bubTimer = setTimeout(() => bub.classList.remove("show"), ms); };
    M.onData = (cmd, r) => {
      if (cmd === "get_status" && r) { status = r; render(); }
      if ((cmd === "list_profiles" || cmd === "refresh_all") && Array.isArray(r)) profiles = r;
    };

    img.addEventListener("mousedown", (e) => { if (e.button === 0) down = { x: e.screenX, y: e.screenY }; });
    window.addEventListener("mouseup", () => { down = null; });
    window.addEventListener("mousemove", (e) => {
      if (down && e.buttons === 1 && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 4) {
        down = null;
        dragging = true;
        img.classList.add("drag");
        M.setEvent("drag");
        inv("mini_drag").catch(() => {});
      } else if (dragging && e.buttons === 0) {
        dragging = false;
        img.classList.remove("drag");
        M.clearEvent();
      }
    });
    img.addEventListener("click", () => M.poke(img));
    img.addEventListener("dblclick", () => inv("mini_leave").catch(() => {}));
    document.addEventListener("mousedown", (e) => { if (menu && !menu.contains(e.target) && !(e.target.closest && e.target.closest("[data-a=sw]"))) { menu.remove(); menu = null; } });

    const toast = document.getElementById("toast");
    if (toast) new MutationObserver(() => { if (!toast.classList.contains("hidden") && toast.textContent.trim()) M.say(toast.textContent.trim(), 3500); }).observe(toast, { attributes: true, childList: true, subtree: true });

    img.src = `mascot/${M.key()}.png`;
    render();
    M.say(M.t("idle"), 3000);
    sync();
  }
  ready(build);
})();
