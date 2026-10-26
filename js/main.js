import { siteConfig } from "../config/site.config.js";
import { renderHero } from "./components/hero.js";
import { renderAbout } from "./components/about.js";
import { renderProjects } from "./components/projects.js";
import { renderContact } from "./components/contact.js";
import { createCameraRig } from "./scene/camera.js";
import { createBackdrop } from "./scene/backdrop.js";
import { createHelix } from "./scene/helix.js";
import { createEyeGate } from "./scene/eyeGate.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const RENDERERS = {
  home: renderHero,
  about: renderAbout,
  projects: renderProjects,
  contact: renderContact,
};

/* 各模块在空间中的姿态：轻微俯仰与转角，让版面明确"斜着浮在空间里" */
const OFFSETS = [
  { x: 0, y: 0, ry: -8, rx: 2.2 },
  { x: -34, y: 20, ry: 10, rx: -2.2 },
  { x: 28, y: -14, ry: -10, rx: 2.4 },
  { x: -20, y: 10, ry: 8, rx: -2 },
];

const el = {
  world: document.getElementById("world"),
  rot: document.getElementById("worldRot"),
  field: document.getElementById("field"),
  helix: document.getElementById("helix"),
  depth: document.getElementById("depth"),
  vel: document.getElementById("vel"),
  counter: document.getElementById("counter"),
  mark: document.getElementById("scaleMark"),
  gate: document.getElementById("eyeGate"),
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = window.matchMedia("(hover: none)").matches;

if (coarse) {
  const hint = document.getElementById("hint");
  if (hint) hint.innerHTML = '<span class="hint__k">上下滑动</span>穿越空间';
}

/* ---------- 构建模块 ---------- */
const items = siteConfig.modules.map((module) => {
  const section = document.createElement("section");
  section.className = `module module--${module.id}`;
  section.id = module.id;
  section.setAttribute("aria-label", module.label);

  const render = RENDERERS[module.id];
  section.innerHTML = render ? render(siteConfig) : renderHero(siteConfig);

  el.rot.appendChild(section);
  return { el: section, cache: { opacity: -1, blur: -1, visibility: "" } };
});

Object.assign(el, {
  tele: document.getElementById("tele"),
  teleV: document.getElementById("teleV"),
  teleD: document.getElementById("teleD"),
  teleP: document.getElementById("teleP"),
});

/* ---------- 空间布局 ---------- */
let positions = [];
let totalDepth = 1;
let spacing = 1560;

function computeLayout() {
  const narrow = window.innerWidth <= 980;
  spacing = narrow ? 1080 : 1560;

  positions = items.map((_, i) => {
    const o = OFFSETS[i % OFFSETS.length];
    return {
      x: narrow ? o.x * 0.3 : o.x,
      y: narrow ? o.y * 0.5 : o.y,
      z: -spacing * i,
      rotY: narrow ? 0 : o.ry,
      rotX: narrow ? 0 : o.rx,
    };
  });

  totalDepth = -positions[positions.length - 1].z || 1;

  items.forEach((item, i) => {
    const p = positions[i];
    item.el.style.transform =
      `translate(-50%, -50%) translate3d(${p.x}px, ${p.y}px, ${p.z}px) ` +
      `rotateY(${p.rotY}deg) rotateX(${p.rotX}deg)`;
  });
}

computeLayout();

/* ---------- 摄像机 ---------- */
const rig = createCameraRig({
  worldEl: el.world,
  rotEl: el.rot,
  positions,
  reducedMotion,
});

/* ---------- 环境 / 螺旋 / 彩蛋 ---------- */
const backdrop = createBackdrop(el.field);
const helix = createHelix(el.helix, {
  modules: siteConfig.modules,
  onSelect: (index) => rig.goTo(index),
});
const eyeGate = createEyeGate(el.gate);

/* ---------- 遥测 ---------- */
const teleCtx = el.tele ? el.tele.getContext("2d") : null;
const TELE_W = el.tele ? el.tele.width : 0;
const TELE_H = el.tele ? el.tele.height : 0;
const TELE_N = 150;
const teleBuf = new Array(TELE_N).fill(0);
let teleAcc = 0;
let accentColor = siteConfig.modules[0].color;

function drawTelemetry() {
  if (!teleCtx) return;
  const baseY = TELE_H * 0.74;

  teleCtx.clearRect(0, 0, TELE_W, TELE_H);

  teleCtx.strokeStyle = "rgba(237, 239, 241, 0.12)";
  teleCtx.lineWidth = 1;
  teleCtx.beginPath();
  teleCtx.moveTo(0, baseY);
  teleCtx.lineTo(TELE_W, baseY);
  teleCtx.stroke();

  for (let i = 0; i <= 6; i += 1) {
    const x = (TELE_W / 6) * i;
    teleCtx.beginPath();
    teleCtx.moveTo(x, baseY - 5);
    teleCtx.lineTo(x, baseY + 5);
    teleCtx.stroke();
  }

  teleCtx.beginPath();
  teleCtx.moveTo(0, baseY);
  for (let i = 0; i < TELE_N; i += 1) {
    const x = (TELE_W / (TELE_N - 1)) * i;
    const y = baseY - teleBuf[i] * TELE_H * 0.56;
    teleCtx.lineTo(x, y);
  }
  teleCtx.lineTo(TELE_W, baseY);
  teleCtx.closePath();

  const rgb = accentColor.replace("#", "");
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);

  const fill = teleCtx.createLinearGradient(0, baseY - TELE_H * 0.5, 0, baseY);
  fill.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
  fill.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  teleCtx.fillStyle = fill;
  teleCtx.fill();

  teleCtx.beginPath();
  for (let i = 0; i < TELE_N; i += 1) {
    const x = (TELE_W / (TELE_N - 1)) * i;
    const y = baseY - teleBuf[i] * TELE_H * 0.56;
    if (i === 0) teleCtx.moveTo(x, y);
    else teleCtx.lineTo(x, y);
  }
  teleCtx.strokeStyle = accentColor;
  teleCtx.lineWidth = 1.9;
  teleCtx.stroke();

  const ly = baseY - teleBuf[TELE_N - 1] * TELE_H * 0.56;
  teleCtx.fillStyle = accentColor;
  teleCtx.beginPath();
  teleCtx.arc(TELE_W - 3, ly, 3.4, 0, Math.PI * 2);
  teleCtx.fill();
}

/* ---------- 模块景深 ---------- */
function updateModules(camZ) {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const p = positions[i];
    const relZ = p.z + camZ;
    const depth = -relZ;

    let opacity = 0;
    let blur = 0;

    if (relZ <= 260) {
      if (depth <= 140) opacity = 1;
      else opacity = clamp(1 - (depth - 140) / 620, 0, 1);
      blur = depth > 200 ? Math.min(4, (depth - 200) / 190) : 0;
    }

    opacity = Math.round(opacity * 50) / 50;

    if (item.cache.opacity !== opacity) {
      item.el.style.opacity = opacity;
      item.cache.opacity = opacity;
    }

    if (!coarse) {
      const b = Math.round(blur * 4) / 4;
      if (item.cache.blur !== b) {
        item.el.style.filter = b > 0.05 ? `blur(${b}px)` : "none";
        item.cache.blur = b;
      }
    }

    const vis = opacity <= 0.02 ? "hidden" : "visible";
    if (item.cache.visibility !== vis) {
      item.el.style.visibility = vis;
      item.cache.visibility = vis;
    }

    item.el.setAttribute("aria-hidden", opacity < 0.5 ? "true" : "false");
  }
}

/* ---------- 每帧 ---------- */
let hudTimer = 0;

rig.onFrame((state, dt) => {
  updateModules(state.camZ);
  backdrop.render(state, dt);
  helix.render({ camZ: state.camZ, index: state.index, spacing }, dt);

  teleBuf.push(clamp(Math.sqrt(clamp(state.speed / 1500, 0, 1)), 0, 1) * 0.85);
  teleBuf.shift();
  teleAcc += dt;
  if (teleAcc > 0.033) {
    teleAcc = 0;
    drawTelemetry();
  }

  const now = performance.now();
  if (now - hudTimer > 100) {
    hudTimer = now;
    const depthM = Math.max(0, Math.round(state.camZ / 10));
    const vel = (state.speed / 1000).toFixed(2);

    el.depth.textContent = String(depthM).padStart(4, "0");
    el.vel.textContent = vel;
    if (el.teleV) el.teleV.textContent = vel;
    if (el.teleD) el.teleD.textContent = String(depthM).padStart(4, "0");
    if (el.teleP) el.teleP.textContent = `${Math.abs(rig.state.rz).toFixed(1)}°`;

    const progress = clamp(state.camZ / totalDepth, 0, 1);
    if (el.mark) el.mark.style.left = `${progress * 100}%`;
  }
});

/* ---------- 模块切换：换色温、换编号、换地址 ---------- */
function applyAccent(index) {
  const module = siteConfig.modules[index];
  if (!module) return;
  accentColor = module.color;

  const hex = module.color.replace("#", "");
  const rgb = [0, 2, 4].map((o) => parseInt(hex.slice(o, o + 2), 16)).join(", ");
  document.documentElement.style.setProperty("--accent", module.color);
  document.documentElement.style.setProperty("--accent-rgb", rgb);
}

rig.onChange((index) => {
  applyAccent(index);

  el.counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;

  const id = siteConfig.modules[index] ? siteConfig.modules[index].id : "";
  if (id && window.location.hash !== `#${id}`) {
    window.history.replaceState(null, "", `#${id}`);
  }
});

/* ---------- 进入联系模块时的彩蛋（每次打开只一次） ---------- */
const CONTACT_INDEX = siteConfig.modules.findIndex((m) => m.id === "contact");
let lastIndex = -1;

rig.onChange((index) => {
  const enteringContact = index === CONTACT_INDEX && lastIndex !== CONTACT_INDEX && lastIndex !== -1;
  lastIndex = index;
  if (enteringContact && !reducedMotion) eyeGate.play();
});

/* ---------- 指针视差 ---------- */
window.addEventListener(
  "pointermove",
  (event) => {
    rig.setPointer(
      (event.clientX / window.innerWidth) * 2 - 1,
      (event.clientY / window.innerHeight) * 2 - 1
    );
  },
  { passive: true }
);

/* ---------- 滚轮 ---------- */
let wheelLock = 0;
window.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 10) return;

    const now = performance.now();
    if (now < wheelLock) return;
    wheelLock = now + 620;

    if (delta > 0) rig.next();
    else rig.prev();
  },
  { passive: false }
);

/* ---------- 触摸 ---------- */
let touchStartY = null;
let touchScroller = null;

window.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length !== 1) return;
    touchStartY = event.touches[0].clientY;
    touchScroller = event.target.closest(".module");
  },
  { passive: true }
);

window.addEventListener(
  "touchend",
  (event) => {
    if (touchStartY === null) return;
    const endY = event.changedTouches[0] ? event.changedTouches[0].clientY : touchStartY;
    const delta = touchStartY - endY;
    const scrollable = touchScroller && touchScroller.scrollHeight > touchScroller.clientHeight + 6;

    if (!scrollable && Math.abs(delta) > 58) {
      if (delta > 0) rig.next();
      else rig.prev();
    }

    touchStartY = null;
    touchScroller = null;
  },
  { passive: true }
);

/* ---------- 键盘 ---------- */
window.addEventListener("keydown", (event) => {
  const tag = (event.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case " ":
      event.preventDefault();
      rig.next();
      break;
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      event.preventDefault();
      rig.prev();
      break;
    case "Home":
      event.preventDefault();
      rig.goTo(0);
      break;
    case "End":
      event.preventDefault();
      rig.goTo(items.length - 1);
      break;
    default:
      break;
  }
});

/* ---------- 按钮与跳转 ---------- */
document.addEventListener("click", (event) => {
  const jump = event.target.closest("[data-goto], [data-nav]");
  if (jump) {
    event.preventDefault();
    const target = jump.dataset.goto ?? jump.dataset.nav;
    rig.goTo(Number(target));
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action) {
    event.preventDefault();
    if (action.dataset.action === "next") rig.next();
    if (action.dataset.action === "prev") rig.prev();
  }
});

/* ---------- 视口变化 ---------- */
let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    computeLayout();
    rig.setLayout(positions);
    backdrop.resize();
    helix.resize();
  }, 160);
});

/* ---------- 启动 ---------- */
const hashId = window.location.hash.replace("#", "");
const initialIndex = Math.max(
  0,
  siteConfig.modules.findIndex((m) => m.id === hashId)
);

rig.goTo(initialIndex, { instant: true });
el.counter.textContent = `${String(initialIndex + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
rig.start();
drawTelemetry();

window.addEventListener("hashchange", () => {
  const id = window.location.hash.replace("#", "");
  const idx = siteConfig.modules.findIndex((m) => m.id === id);
  if (idx >= 0) rig.goTo(idx);
});
