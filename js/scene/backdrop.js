/**
 * 空间场（3D 纵深环境 · 观测仪器版）
 *
 * 不用网格。整片空间由一组等距递增的场线定义：线在投影中向灭点收束，
 * 靠近镜头的部分起伏更大，形成"地形/磁场"的错觉，而不是一张浅网格。
 *
 * 投影与 DOM 模块共用同一公式：k = P / (P + depth)，P 与 CSS --perspective 一致。
 * 于是在场线上看到的每一次起伏、每一道扫描面，都和模块处在同一个几何空间。
 */

const PROJECTION = 1200;
const FLOOR_Y = 260;
const CEIL_Y = -330;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createBackdrop(canvas) {
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let dust = [];

  function makeDust() {
    return {
      x: (Math.random() - 0.5) * 2600,
      y: (Math.random() - 0.5) * 1600,
      z: 120 + Math.random() * 2600,
      a: 0.12 + Math.random() * 0.5,
      s: 0.5 + Math.random() * 1.1,
    };
  }

  function seed() {
    const n = Math.round(clamp((width * height) / 16000, 40, 130));
    dust = Array.from({ length: n }, makeDust);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width / 2;
    cy = height / 2;
    seed();
  }

  /* 场线：一组向灭点收束的曲线，带缓慢的横向漂移与一道扫描亮带 */
  function drawFieldLines(state) {
    const horizon = cy - state.camY * 0.5;
    const stepX = width > 980 ? 22 : 32;
    const sweep = (state.time * 0.1) % 1;

    let z = 110;
    for (let i = 0; i < 30; i += 1) {
      z *= 1.165;
      const k = PROJECTION / (PROJECTION + z);
      if (k < 0.008) break;

      const fade = clamp(1 - z / 9500, 0, 1);
      const band = Math.exp(-Math.pow((i / 30 - sweep) * 5.5, 2)) * 0.075;
      const alpha = (fade * 0.13 + band) * (0.5 + 0.5 * k);

      for (const [planeY, mul] of [[FLOOR_Y, 1], [CEIL_Y, 0.55]]) {
        const baseY = horizon + planeY * k;
        if (baseY < -160 || baseY > height + 160) continue;

        const amp = 3 + 34 * k;
        ctx.strokeStyle = `rgba(237, 239, 241, ${alpha * mul})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = -stepX; x <= width + stepX; x += stepX) {
          const y =
            baseY +
            Math.sin(x / 300 + state.time * 0.22 + i * 0.33) * amp +
            Math.sin(x / 96 - state.time * 0.14 + i * 0.17) * amp * 0.22;
          if (x <= -stepX + 0.1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  /* 基准线：一条极淡的水平参考线 + 短刻度，确立"测量"的语气 */
  function drawDatum(state) {
    const horizon = cy - state.camY * 0.5;
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "rgba(237, 239, 241, 0)");
    grad.addColorStop(0.18, "rgba(237, 239, 241, 0.16)");
    grad.addColorStop(0.82, "rgba(237, 239, 241, 0.16)");
    grad.addColorStop(1, "rgba(237, 239, 241, 0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    ctx.stroke();

    ctx.strokeStyle = "rgba(237, 239, 241, 0.18)";
    const ticks = 9;
    for (let i = 0; i <= ticks; i += 1) {
      const x = (width / ticks) * i;
      const long = i % 3 === 0;
      ctx.beginPath();
      ctx.moveTo(x, horizon - (long ? 7 : 3));
      ctx.lineTo(x, horizon + (long ? 7 : 3));
      ctx.stroke();
    }
  }

  /* 穿越面：每进入一个模块，就会掠过一道极淡的扫描平面 */
  function drawScanPlanes(state) {
    const horizon = cy - state.camY * 0.5;

    for (let i = 0; i < state.positions.length; i += 1) {
      const item = state.positions[i];
      const depth = -(item.z + state.camZ);
      if (depth < 760 || depth > 8000) continue;

      const k = PROJECTION / (PROJECTION + depth);
      const y = horizon + item.y * k;
      const alpha = Math.sin(clamp((depth - 760) / 4200, 0, 1) * Math.PI) * 0.16;
      if (alpha <= 0.005) continue;

      const glow = ctx.createLinearGradient(0, 0, width, 0);
      const tone = i === state.index ? "255, 68, 51" : "237, 239, 241";
      glow.addColorStop(0, `rgba(${tone}, 0)`);
      glow.addColorStop(0.5, `rgba(${tone}, ${alpha})`);
      glow.addColorStop(1, `rgba(${tone}, 0)`);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // 细线环：模块所在深度的界标，让你"穿过"它进入下一个空间
      const gx = cx + (item.x - state.camX) * k;
      const r = 620 * k;
      if (r > 14) {
        ctx.strokeStyle = `rgba(${tone}, ${alpha * 0.75})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx, y, r, 0, Math.PI * 2);
        ctx.stroke();

        for (let a = 0; a < 4; a += 1) {
          const ang = (Math.PI / 2) * a + 0.2;
          ctx.beginPath();
          ctx.moveTo(gx + Math.cos(ang) * r * 0.94, y + Math.sin(ang) * r * 0.94);
          ctx.lineTo(gx + Math.cos(ang) * r * 1.08, y + Math.sin(ang) * r * 1.08);
          ctx.stroke();
        }
      }
    }
  }

  /* 尘埃：极少、极暗，只用来提示深度 */
  function drawDust(state, dt) {
    const move = (10 + state.speed * 0.55) * dt;

    for (let i = 0; i < dust.length; i += 1) {
      const d = dust[i];
      d.z -= move;
      if (d.z < 90) {
        dust[i] = makeDust();
        dust[i].z = 2700;
        continue;
      }

      const k = PROJECTION / (PROJECTION + d.z);
      const sx = cx + (d.x - state.camX * 0.6) * k;
      const sy = cy - state.camY * 0.6 + d.y * k;
      if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) continue;

      const near = clamp(1 - d.z / 2700, 0, 1);
      const size = Math.max(0.5, d.s * k * 2);
      ctx.fillStyle = `rgba(237, 239, 241, ${d.a * (0.12 + near * 0.75)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(state, dt) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    drawFieldLines(state);
    drawDatum(state);
    drawScanPlanes(state);
    drawDust(state, Math.min(dt, 0.05));
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  return { render, resize };
}
