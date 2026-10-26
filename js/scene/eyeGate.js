/**
 * 联系区域彩蛋 · 红眼
 *
 * 真实感来自五层，缺一层就会"假"：
 *   1. 皮下阴影与眼窝：眼睛不是浮在黑底上的图形，而是嵌在暗部里的器官；
 *   2. 上睑褶与睫毛：沿杏仁形上缘按切线方向生长，长短不一，外侧更长；
 *   3. 虹膜纤维 + 缘环 + 柔和瞳孔边缘：纤维只覆盖外圈，不穿过瞳孔；
 *   4. 两处角膜高光（大小不同、位置不对称）+ 下睑湿润反光；
 *   5. 运动：扫视跳动（快移—停留—微颤），瞳孔随呼吸轻微缩放。
 *
 * 节奏：黑场 → 眼睛由 0.9 倍缩放淡入 → 张望 → 眨眼 → 淡出交还联系方式。
 * 一次打开只播放一次（sessionStorage），任意点击/按键/滚轮可立即跳过。
 */

const TOTAL = 3560;
const STORAGE_KEY = "eive-eye-seen";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* 扫视关键帧：[时间, x, y]，同值区间即为"停留凝视" */
const LOOK = [
  [0, 0, 0],
  [240, -31, -5],
  [660, -31, -5],
  [840, 27, 3],
  [1220, 27, 3],
  [1360, -9, -2],
  [1540, 7, 2],
];

function lookAt(t) {
  if (t <= 0) return { x: 0, y: 0 };
  const last = LOOK[LOOK.length - 1];
  if (t >= last[0]) return { x: last[1], y: last[2] };

  for (let i = 0; i < LOOK.length - 1; i += 1) {
    const a = LOOK[i];
    const b = LOOK[i + 1];
    if (t >= a[0] && t < b[0]) {
      const p = easeOut((t - a[0]) / (b[0] - a[0]));
      return { x: a[1] + (b[1] - a[1]) * p, y: a[2] + (b[2] - a[2]) * p };
    }
  }
  return { x: 0, y: 0 };
}

/* 杏仁形的上缘是一条二次贝塞尔，睫毛需要它的位置与切线 */
const P0 = [36, 120];
const P1 = [200, 10];
const P2 = [364, 120];

function quad(t) {
  const u = 1 - t;
  return [
    u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0],
    u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1],
  ];
}

function quadTangent(t) {
  const u = 1 - t;
  return [
    2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]),
    2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]),
  ];
}

export function createEyeGate(root) {
  const canvas = root ? root.querySelector("canvas") : null;
  const ctx = canvas ? canvas.getContext("2d") : null;

  let raf = 0;
  let active = false;
  let startTime = 0;
  let timers = [];

  /* 虹膜纤维只生成一次，避免每帧抖动 */
  const fibers = Array.from({ length: 168 }, (_, i) => ({
    ang: (i / 168) * Math.PI * 2 + (Math.random() - 0.5) * 0.045,
    inner: 26 + Math.random() * 5,
    outer: 46 + Math.random() * 17,
    width: 0.5 + Math.random() * 1.5,
    alpha: 0.07 + Math.random() * 0.34,
    warm: Math.random(),
  }));

  /* 睫毛同样固定：每次播放的形状应一致 */
  const lashes = Array.from({ length: 46 }, (_, i) => {
    const t = 0.045 + (i / 45) * 0.91;
    return {
      t,
      len: 7 + Math.random() * 9 + Math.sin(t * Math.PI) * 7, // 中部与外侧更长
      sway: (Math.random() - 0.5) * 0.5,
      alpha: 0.5 + Math.random() * 0.45,
      width: 0.7 + Math.random() * 1.1,
    };
  });

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function almond() {
    ctx.beginPath();
    ctx.moveTo(P0[0], P0[1]);
    ctx.quadraticCurveTo(P1[0], P1[1], P2[0], P2[1]);
    ctx.quadraticCurveTo(P1[0], P1[1] + 216, P0[0], P0[1]);
    ctx.closePath();
  }

  function drawLashes() {
    ctx.lineCap = "round";
    lashes.forEach((l) => {
      const [x, y] = quad(l.t);
      const [tx, ty] = quadTangent(l.t);
      const len = Math.hypot(tx, ty) || 1;
      // 法线朝外（向上），再叠加一点向外侧的倾斜
      const nx = ty / len;
      const ny = -tx / len;
      const sway = (l.t - 0.5) * 0.85 + l.sway;
      const dx = nx * 0.82 + sway * 0.5;
      const dy = ny * 0.82 + Math.abs(sway) * 0.22;
      const d = Math.hypot(dx, dy) || 1;

      ctx.strokeStyle = `rgba(9, 1, 3, ${l.alpha})`;
      ctx.lineWidth = l.width;
      ctx.beginPath();
      ctx.moveTo(x, y - 1.5);
      ctx.quadraticCurveTo(
        x + (dx / d) * l.len * 0.55,
        y - 1.5 + (dy / d) * l.len * 0.55,
        x + (dx / d) * l.len,
        y - 1.5 + (dy / d) * l.len
      );
      ctx.stroke();
    });
  }

  function drawEye(now) {
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;

    const t = now - startTime;
    const scale = w / 400;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(scale, scale);

    // 由 0.9 倍推出，配合透明度，形成"从黑暗里浮现"
    const emerge = easeOut(clamp(t / 460, 0, 1));
    const breathe = 1 + Math.sin(t * 0.0026) * 0.006;
    const sc = (0.9 + 0.1 * emerge) * breathe;

    // 眨眼：整体纵向压扁，而不是透明度闪烁
    let lid = 1;
    if (t > 2120 && t < 2450) {
      const p = (t - 2120) / 330;
      lid = p < 0.45 ? 1 - (p / 0.45) * 0.95 : 0.05 + ((p - 0.45) / 0.55) * 0.95;
    }

    const look = lookAt(t - 620);
    const tremorX = Math.sin(t * 0.045) * 0.7 + Math.sin(t * 0.013) * 0.5;
    const tremorY = Math.cos(t * 0.037) * 0.6;
    const ix = 200 + look.x + tremorX;
    const iy = 120 + look.y + tremorY;

    const alpha = clamp(t / 420, 0, 1) * clamp((2920 - t) / 380, 0, 1);
    const flicker = 0.965 + Math.sin(t * 0.021) * 0.02 + Math.sin(t * 0.0067) * 0.015;

    ctx.globalAlpha = alpha * flicker;

    /* ── 皮下阴影与眼窝：让眼睛嵌进暗部 ── */
    const socket = ctx.createRadialGradient(200, 124, 40, 200, 124, 236);
    socket.addColorStop(0, "rgba(46, 9, 13, 0.95)");
    socket.addColorStop(0.42, "rgba(24, 5, 8, 0.7)");
    socket.addColorStop(0.76, "rgba(10, 2, 4, 0.28)");
    socket.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = socket;
    ctx.fillRect(-80, -80, 560, 400);

    /* 上睑褶：一条极淡的弧线，暗示眼窝结构 */
    ctx.strokeStyle = "rgba(150, 52, 58, 0.16)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(48, 96);
    ctx.quadraticCurveTo(200, -20, 352, 96);
    ctx.stroke();

    ctx.save();
    ctx.translate(200, 120);
    ctx.scale(sc, sc * lid);
    ctx.translate(-200, -120);

    /* ── 眼白 ── */
    almond();
    ctx.save();
    ctx.clip();

    const sclera = ctx.createRadialGradient(200, 106, 10, 200, 120, 196);
    sclera.addColorStop(0, "#3a0b12");
    sclera.addColorStop(0.5, "#1b0408");
    sclera.addColorStop(0.82, "#0c0104");
    sclera.addColorStop(1, "#050001");
    ctx.fillStyle = sclera;
    ctx.fillRect(0, 0, 400, 240);

    /* ── 虹膜 ── */
    const pupilR = 25 * (1 + Math.sin(t * 0.0031) * 0.06);
    const irisR = 60;

    const iris = ctx.createRadialGradient(ix - 9, iy - 11, 4, ix, iy, irisR);
    iris.addColorStop(0, "#ff9a76");
    iris.addColorStop(0.22, "#f63a2e");
    iris.addColorStop(0.58, "#b1121c");
    iris.addColorStop(0.86, "#6d0a12");
    iris.addColorStop(1, "#2c0308");
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
    ctx.fill();

    /* 纤维：只出现在瞳孔外侧，越靠外越细 */
    fibers.forEach((f) => {
      if (f.inner < pupilR + 2) f.inner = pupilR + 2;
      const c = Math.cos(f.ang);
      const s = Math.sin(f.ang);
      ctx.strokeStyle = f.warm > 0.52
        ? `rgba(255, 158, 118, ${f.alpha})`
        : `rgba(58, 0, 8, ${f.alpha + 0.14})`;
      ctx.lineWidth = f.width;
      ctx.beginPath();
      ctx.moveTo(ix + c * f.inner, iy + s * f.inner);
      ctx.lineTo(ix + c * f.outer, iy + s * f.outer);
      ctx.stroke();
    });

    /* 缘环：外圈变暗，真实感的关键 */
    const rim = ctx.createRadialGradient(ix, iy, irisR - 20, ix, iy, irisR + 1);
    rim.addColorStop(0, "rgba(20, 0, 4, 0)");
    rim.addColorStop(0.68, "rgba(34, 1, 7, 0.34)");
    rim.addColorStop(1, "rgba(6, 0, 2, 0.94)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(ix, iy, irisR + 1, 0, Math.PI * 2);
    ctx.fill();

    /* 瞳孔：边缘柔和的黑洞 */
    const pupil = ctx.createRadialGradient(ix, iy, 3, ix, iy, pupilR + 6);
    pupil.addColorStop(0, "#000");
    pupil.addColorStop(0.66, "#030004");
    pupil.addColorStop(1, "rgba(3, 0, 4, 0)");
    ctx.fillStyle = pupil;
    ctx.beginPath();
    ctx.arc(ix, iy, pupilR + 6, 0, Math.PI * 2);
    ctx.fill();

    /* 角膜高光：一大一小，位置不对称 */
    ctx.save();
    ctx.translate(ix - 18, iy - 22);
    ctx.rotate(-0.42);
    const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    spec.addColorStop(0, "rgba(255, 246, 240, 0.95)");
    spec.addColorStop(0.46, "rgba(255, 228, 218, 0.38)");
    spec.addColorStop(1, "rgba(255, 220, 210, 0)");
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12.5, 7.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(255, 202, 188, 0.34)";
    ctx.beginPath();
    ctx.ellipse(ix + 16, iy + 20, 5.2, 3.1, 0.42, 0, Math.PI * 2);
    ctx.fill();

    /* 上眼睑投影：从上方压下来的阴影 */
    const shade = ctx.createLinearGradient(0, 16, 0, 158);
    shade.addColorStop(0, "rgba(0, 0, 0, 0.9)");
    shade.addColorStop(0.5, "rgba(0, 0, 0, 0.3)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 400, 170);

    /* 下睑湿润反光：一条很窄的亮边 */
    const wet = ctx.createLinearGradient(0, 170, 0, 210);
    wet.addColorStop(0, "rgba(255, 150, 130, 0)");
    wet.addColorStop(0.45, "rgba(255, 160, 140, 0.16)");
    wet.addColorStop(1, "rgba(255, 150, 130, 0.02)");
    ctx.fillStyle = wet;
    ctx.fillRect(0, 165, 400, 60);

    ctx.restore(); // 解除杏仁裁剪

    /* 睫毛：画在裁剪之外，才会越过眼睑边缘 */
    drawLashes();

    /* 眼睑边缘：柔化的红线，而不是画笔描边 */
    almond();
    ctx.strokeStyle = "rgba(255, 74, 56, 0.2)";
    ctx.lineWidth = 3.4;
    ctx.stroke();
    almond();
    ctx.strokeStyle = "rgba(255, 96, 78, 0.42)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // 解除缩放/眨眼
    ctx.restore(); // 解除画布缩放
  }

  function clearTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  function detach() {
    window.removeEventListener("pointerdown", skip, true);
    window.removeEventListener("keydown", skip, true);
    window.removeEventListener("wheel", skip, true);
    window.removeEventListener("touchstart", skip, true);
  }

  function end() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    clearTimers();
    detach();
    root.classList.remove("is-active", "is-clear");
    root.setAttribute("aria-hidden", "true");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function skip() {
    end();
  }

  function frame(now) {
    if (!active) return;
    drawEye(now);
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (!root || !ctx || active) return;
    // 一次打开只触发一次
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (err) {
      /* 隐私模式下忽略，仍播放一次 */
    }

    active = true;
    root.setAttribute("aria-hidden", "false");
    root.classList.add("is-active");
    resize();
    startTime = performance.now();
    raf = requestAnimationFrame(frame);

    timers.push(window.setTimeout(() => root.classList.add("is-clear"), 2920));
    timers.push(window.setTimeout(end, TOTAL));

    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    window.addEventListener("wheel", skip, { capture: true, passive: true });
    window.addEventListener("touchstart", skip, { capture: true, passive: true });
  }

  return { play, skip, end };
}
