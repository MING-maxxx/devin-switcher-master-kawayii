(() => {
  "use strict";
  const MINI = !!window.__MINI__ || /[?&]mini=1/.test(location.search);
  const lang = () => (localStorage.getItem("dsw-lang") === "en" ? "en" : "zh");
  const SAY = {
    zh: { idle: "欢迎回来～", happy: "额度还很多，放心用吧～", normal: "额度用掉一半啦，留意一下哦", sleepy: "额度快用完啦，换个号吧～", switching: "正在切换，等我一下～", success: "搞定啦！", error: "呜…出错了，看看提示吧", loading: "我去看看额度～", empty: "还没有账号哦，快添加一个吧～", drag: "哇，要带我去哪～", poke: ["嘿嘿～", "别戳啦，好痒～", "今天也要加油哦！"] },
    en: { idle: "Welcome back~", happy: "Plenty of quota left~", normal: "About half used, keep an eye on it", sleepy: "Quota is almost gone, try another account~", switching: "Switching, one moment~", success: "All done!", error: "Oops, something went wrong…", loading: "Let me check the quota~", empty: "No accounts yet, add one~", drag: "Whoa, where are we going~", poke: ["Hehe~", "That tickles~", "Keep going!"] },
  };
  const STATES = ["idle", "happy", "normal", "sleepy", "switching", "success", "error", "loading", "empty", "drag"];
  const state = { on: localStorage.getItem("dsw-mascot") !== "off", mood: "normal", empty: false, event: null };
  const M = (window.dswMascot = { state, onPaint: null, onSay: null, onData: null });
  let root, img, bub, timer, bubTimer;
  const t = (k) => SAY[lang()][k];
  const key = () => {
    const k = state.event || (state.empty ? "empty" : state.mood);
    return STATES.includes(k) ? k : "idle";
  };

  function paint() {
    if (root) {
      root.classList.toggle("off", !state.on);
      document.body.classList.toggle("dsw-m", state.on);
      const src = `mascot/${key()}.png`;
      if (!img.src.endsWith(src)) img.src = src;
    }
    if (M.onPaint) M.onPaint(key());
  }
  function say(text, ms = 4200) {
    if (bub) {
      bub.textContent = text;
      bub.classList.add("show");
      clearTimeout(bubTimer);
      bubTimer = setTimeout(() => bub.classList.remove("show"), ms);
    }
    if (M.onSay) M.onSay(text, ms);
  }
  function setEvent(k, ms) {
    clearTimeout(timer);
    state.event = k;
    paint();
    say(t(k));
    if (ms) timer = setTimeout(() => { state.event = null; paint(); }, ms);
  }
  function clearEvent() { clearTimeout(timer); state.event = null; paint(); }
  function poke(el) {
    const L = t("poke");
    say(L[Math.floor(Math.random() * L.length)], 2600);
    if (el) { el.classList.remove("boing"); void el.offsetWidth; el.classList.add("boing"); }
  }
  Object.assign(M, { say, setEvent, clearEvent, poke, t, key });

  const leftOf = (u) => {
    if (!u) return null;
    const d = u.daily_left, w = u.weekly_left ?? (d != null ? 0 : null);
    const v = [d, w].filter((x) => x != null);
    return v.length ? Math.min(...v) : null;
  };
  function observe(cmd, r) {
    if (cmd === "get_status" && r) {
      const e = leftOf(r.usage || (r.desktop && r.desktop.usage));
      const m = e == null ? "normal" : e >= 50 ? "happy" : e >= 20 ? "normal" : "sleepy";
      if (m !== state.mood) { state.mood = m; paint(); if (!state.event) say(t(m)); }
    }
    if ((cmd === "list_profiles" || cmd === "refresh_all") && Array.isArray(r)) {
      const em = r.length === 0;
      if (em !== state.empty) { state.empty = em; paint(); if (em) say(t("empty"), 6000); }
    }
    if (M.onData) M.onData(cmd, r);
  }

  const START = { use_profile: "switching", refresh_usage: "loading", refresh_all: "loading" };
  const OK = { use_profile: "success", launch_parallel: "success", save_current: "success", import_desktop: "success", manual_finish: "success" };
  const QUIET = new Set(["get_status", "list_profiles", "poll_login", "cancel_login", "manual_start", "start_login"]);
  window.dswWrapInvoke = (raw) => async (cmd, args) => {
    if (START[cmd] && state.on) setEvent(START[cmd]);
    try {
      const r = await raw(cmd, args);
      observe(cmd, r);
      if (OK[cmd]) setEvent(OK[cmd], 2400);
      else if (START[cmd]) clearEvent();
      return r;
    } catch (e) {
      if (!QUIET.has(cmd)) setEvent("error", 2800);
      else if (START[cmd]) clearEvent();
      throw e;
    }
  };

  function init() {
    STATES.forEach((s) => { new Image().src = `mascot/${s}.png`; });
    if (MINI) return;
    root = document.createElement("div");
    root.id = "dsw-mascot";
    bub = document.createElement("div");
    bub.className = "bub";
    img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    root.append(bub, img);
    document.body.append(root);
    img.onerror = () => { root.classList.add("off"); document.body.classList.remove("dsw-m"); };
    img.onclick = () => poke(img);
    const h1 = document.querySelector("h1");
    if (h1) { const ic = new Image(); ic.className = "dsw-icon"; ic.alt = ""; ic.onerror = () => ic.remove(); ic.src = "mascot/icon.png"; h1.prepend(ic); }
    const lb = document.getElementById("langBtn");
    if (lb) {
      const b = document.createElement("button");
      b.id = "mascotBtn";
      b.className = "lang";
      lb.after(b);
      const lab = () => { b.textContent = lang() === "en" ? "Mascot" : "看板娘"; };
      lab();
      b.onclick = () => { state.on = !state.on; localStorage.setItem("dsw-mascot", state.on ? "on" : "off"); paint(); if (state.on) say(t(state.empty ? "empty" : state.mood)); };
      lb.addEventListener("click", () => setTimeout(lab, 50));
    }
    const card = document.querySelector("#sheet .sheet-card");
    if (card) { const p = new Image(); p.className = "dsw-peek"; p.alt = ""; p.onerror = () => p.remove(); p.src = "mascot/peek.png"; card.prepend(p); }
    paint();
    say(t("idle"), 3000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
