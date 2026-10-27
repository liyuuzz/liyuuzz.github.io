/**
 * DNA 双螺旋 · 粒子目录导航
 *
 * ── 形态 ────────────────────────────────────────────────
 * 两条主链由球体粒子堆叠，横档由 3 个渐变小球连成。透视轴长取半径的
 * 2.15 倍（而不是远大于半径），因此近端粒子明显放大、远端缩小并向轴心
 * 收拢，两条链会真实地前后交叠——这是"立体感"的来源，不是折线拼的。
 * 着色：每个模块色衍生 3 个明度档，全链共 12 种粒子色，交替取样。
 *
 * ── 节点映射规则（改动前必读）────────────────────────────
 * 设模块数为 n，第 i 个模块：
 *   y_i     = 链心 + (i - (n-1)/2) · spanY/(n-1)   → 沿链等距分布
 *   theta_i = FRONT + i · 90°                       → 相邻模块相差 90°
 *   rotation = -(camZ / 模块间距) · 90°              → 由摄像机深度驱动
 * 于是模块被激活时 camZ = i · 间距，节点角度 = FRONT（正前方、最大最亮）。
 *
 * ── 点击定位与滚动旋转的关系 ────────────────────────────
 * 两者共用同一个变量 camZ：点击 → 摄像机缓动到目标 camZ → rotation 随之
 * 连续插值。所以"螺旋旋转"本质就是"摄像机推进"的可视化，不存在两套
 * 状态，也就不会出现螺旋转到位但页面没到的情况。
 */

const TURNS = 2.0; // 装饰主链的圈数：圈数少一点，两条链更容易被读出来
const PAIRS = 44; // 主链珠粒密度：够密才会读成"一条链"而不是虚线
const NODE_GAP = Math.PI / 2; // 相邻模块的角度差
const FRONT = -Math.PI / 2; // 正前方角度

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const WHITE = [255, 255, 255];
const BLACK = [4, 5, 7];
const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

export function createHelix(canvas, { modules, onSelect }) {
  const ctx = canvas.getContext("2d");

  /* 12 档粒子色：每个模块 3 个明度，交替使用形成多色链 */
  const tones = [];
  modules.forEach((m) => {
    const rgb = hexToRgb(m.color);
    tones.push(mix(rgb, WHITE, 0.34), rgb, mix(rgb, BLACK, 0.3));
  });

  /* 球体精灵预渲染：每帧不再创建渐变，手机端擦除大量开销 */
  const sprites = tones.map((rgb) => {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(
      size * 0.37, size * 0.32, size * 0.03,
      size * 0.5, size * 0.5, size * 0.5
    );
    grad.addColorStop(0, rgba(mix(rgb, WHITE, 0.94), 1));
    grad.addColorStop(0.26, rgba(mix(rgb, WHITE, 0.34), 1));
    grad.addColorStop(0.62, rgba(rgb, 1));
    grad.addColorStop(0.88, rgba(mix(rgb, BLACK, 0.55), 0.92));
    grad.addColorStop(1, rgba(mix(rgb, BLACK, 0.85), 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    g.fill();
    return c;
  });

  const nodes = modules.map((m, i) => ({
    index: i,
    label: m.label,
    base: m.base,
    baseName: m.baseName,
    rgb: hexToRgb(m.color),
    tone: tones[i * 3 + 1],
  }));

  let W = 0;
  let H = 0;
  let rotation = 0;
  let active = 0;
  let hover = -1;
  let time = 0;
  let hits = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 球体粒子：预渲染精灵 + 按深度调透明度，避免每帧建渐变 */
  function blob(x, y, r, toneIndex, alpha) {
    if (r < 0.3 || alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites[toneIndex], x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /** 把螺旋上的一点（围绕 y 轴的角度 + 高度）投影到屏幕 */
  function project(theta, y, R, cx, axis) {
    const z = Math.sin(theta) * R;
    const k = axis / (axis + z);
    return { x: cx + Math.cos(theta) * R * k, y, z, k };
  }

  /** 两链之间的一点：在 3D 里直线插值，再投影，横档才有透视收束 */
  function across(theta, f, y, R, cx, axis) {
    const amp = 1 - 2 * f;
    const z = Math.sin(theta) * R * amp;
    const k = axis / (axis + z);
    return { x: cx + Math.cos(theta) * R * amp * k, y, z, k };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!W || !H) return;

    const cx = W * 0.5;
    const cy = H * 0.5;
    const small = W < 170;
    const R = clamp(W * 0.3, 26, 82);
    const axis = R * 3.2; // 透视强度克制：太小会散成星云，太大就成了平梯子
    const axisH = H * 0.86;
    const n = nodes.length;
    const spanY = H * (small ? 0.62 : 0.58);
    const stepY = n > 1 ? spanY / (n - 1) : 0;
    const nodeY = (i) => cy + (i - (n - 1) / 2) * stepY;

    const queue = [];
    hits = [];

    /* 链身辉光：让"发光的多色粒子"先有一层空气感，而不是纯点阵 */
    const aura = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, axisH * 0.56);
    aura.addColorStop(0, "rgba(120, 170, 220, 0.055)");
    aura.addColorStop(0.55, "rgba(120, 140, 210, 0.022)");
    aura.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, W, H);

    /* ── 装饰主链 ── */
    const strandA = [];
    const strandB = [];

    for (let j = 0; j < PAIRS; j += 1) {
      const t = j / (PAIRS - 1);
      const y = cy + (t - 0.5) * axisH;
      const theta = t * TURNS * Math.PI * 2 + rotation;

      const a = project(theta, y, R, cx, axis);
      const b = project(theta + Math.PI, y, R, cx, axis);

      strandA.push({ p: a, tone: (j * 2) % tones.length });
      strandB.push({ p: b, tone: (j * 2 + 1) % tones.length });

      // 横档：细、暗，退到背景层，让两条链成为主体
      for (let s = 1; s <= 3; s += 1) {
        const p = across(theta, s / 4, y, R, cx, axis);
        queue.push({ p, r: 1.35, tone: (j + s) % tones.length, a: 0.3 });
      }
    }

    /* 链身连线：把珠粒串成连续骨架，这是"读成螺旋"的关键 */
    [strandA, strandB].forEach((strand) => {
      ctx.lineWidth = 1;
      for (let i = 0; i < strand.length - 1; i += 1) {
        const p0 = strand[i].p;
        const p1 = strand[i + 1].p;
        const light = clamp(1 - (p0.z + R) / (2 * R), 0, 1);
        ctx.strokeStyle = rgba(tones[strand[i].tone], 0.16 + light * 0.3);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      strand.forEach((s) => {
        queue.push({ p: s.p, r: 2.1, tone: s.tone, a: 0.96 });
      });
    });

    /* ── 功能节点：与模块一一对应 ── */
    const labels = [];

    nodes.forEach((node) => {
      const y = nodeY(node.index);
      const theta = FRONT + node.index * NODE_GAP + rotation;
      const a = project(theta, y, R, cx, axis);
      const b = project(theta + Math.PI, y, R, cx, axis);

      const isActive = node.index === active;
      const isHover = node.index === hover;
      const facing = clamp(1 - (a.z + R) / (2 * R), 0, 1); // 1 最前

      // 节点横档：该模块颜色的粒子串
      for (let s = 0; s <= 6; s += 1) {
        const p = across(theta, s / 6, y, R, cx, axis);
        queue.push({
          p,
          r: isActive ? 2.9 : 2.3,
          tone: node.index * 3 + (s % 3),
          a: 0.4 + facing * 0.55,
        });
      }

      const boost = isActive ? 1.75 : isHover ? 1.4 : 1;
      // 前链大、后链小：由 k 决定，而不是写死的两个尺寸
      queue.push({ p: a, r: 6.4 * boost, tone: node.index * 3 + 1, a: 0.62 + facing * 0.38 });
      queue.push({ p: b, r: 4.6 * boost, tone: node.index * 3, a: 0.34 + facing * 0.3 });

      labels.push({ node, a, facing, isActive, isHover });
      hits.push({ index: node.index, x: a.x, y: a.y, r: 24 });
    });

    /* 远的先画、近的后画 → 真实遮挡 */
    queue.sort((m, q) => q.p.z - m.p.z);
    queue.forEach((s) => {
      const light = clamp(1 - (s.p.z + R) / (2 * R), 0, 1);
      blob(s.p.x, s.p.y, s.r * s.p.k, s.tone, s.a * (0.34 + 0.66 * light));
    });

    /* ── 节点标注 ── */
    labels.forEach(({ node, a, facing, isActive }) => {
      if (small && !isActive) return;

      // 四个标题始终可见：背面节点降低亮度但不隐藏，否则用户无法导航
      const alpha = isActive ? 1 : clamp(0.5 + facing * 0.36, 0, 0.86);
      const gap = small ? 15 : 22;
      const size = small ? 9.5 : 11;
      const text = `${node.base}  ${node.label}`;

      ctx.font = `${isActive ? 600 : 400} ${size}px ui-monospace, "SFMono-Regular", Consolas, monospace`;
      ctx.textBaseline = "middle";

      // 先按节点所在侧排布，再根据文字宽度翻转，保证不会被画布边缘裁掉
      const tw = ctx.measureText(text).width;
      let align = a.x >= cx - 1 ? "left" : "right";
      let lx = a.x + (align === "left" ? gap : -gap);

      if (align === "left" && lx + tw > W - 6) {
        align = "right";
        lx = a.x - gap;
      } else if (align === "right" && lx - tw < 6) {
        align = "left";
        lx = a.x + gap;
      }
      lx = clamp(lx, 6, W - 6);

      const dirX = align === "left" ? 1 : -1;
      const ly = a.y;

      ctx.textAlign = align;

      // 引线：从节点指向标注，强化"节点—标题"的对应关系
      ctx.strokeStyle = rgba(node.rgb, alpha * 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x + dirX * 7, a.y);
      ctx.lineTo(lx - dirX * 4, ly);
      ctx.stroke();

      ctx.fillStyle = isActive ? rgba(node.rgb, 0.98) : rgba(node.rgb, alpha);
      // 深色描边做底：文字压在粒子或链线上时依然可读
      ctx.strokeStyle = "rgba(6, 7, 8, 0.88)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeText(text, lx, ly);
      ctx.fillText(text, lx, ly);

      if (isActive && !small) {
        ctx.font = '400 8px ui-monospace, "SFMono-Regular", Consolas, monospace';
        ctx.fillStyle = rgba(mix(node.rgb, WHITE, 0.45), 0.62);
        ctx.fillText(node.baseName, lx, ly + 16);
      }

      // 标注也可点击：命中区覆盖文字
      const w = Math.min(tw, small ? 62 : 84);
      hits.push({
        index: node.index,
        x: align === "left" ? lx + w / 2 : lx - w / 2,
        y: ly + (isActive && !small ? 6 : 0),
        r: 20,
      });
    });

    /* 激活节点的呼吸环 */
    const current = labels.find((l) => l.isActive);
    if (current) {
      const pulse = 1 + Math.sin(time * 2.2) * 0.08;
      ctx.strokeStyle = rgba(current.node.rgb, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(current.a.x, current.a.y, 15 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = rgba(current.node.rgb, 0.16);
      ctx.beginPath();
      ctx.arc(current.a.x, current.a.y, 23 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function nearest(x, y) {
    let best = -1;
    let bestD = 26;
    hits.forEach((h) => {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestD && d < h.r) {
        bestD = d;
        best = h.index;
      }
    });
    return best;
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointermove", (event) => {
    const p = pointFrom(event);
    hover = nearest(p.x, p.y);
    canvas.style.cursor = hover >= 0 ? "pointer" : "default";
  });

  canvas.addEventListener("pointerleave", () => {
    hover = -1;
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("pointerdown", (event) => {
    const p = pointFrom(event);
    const idx = nearest(p.x, p.y);
    if (idx >= 0) {
      event.preventDefault();
      onSelect(idx);
    }
  });

  function render(state, dt) {
    if (!W || !H) return;
    time += dt;
    // 旋转角只由摄像机深度决定：每推进一个模块，螺旋恰好转 90°
    const target = -(state.camZ / state.spacing) * NODE_GAP;
    rotation += (target - rotation) * Math.min(1, dt * 6.5);
    active = state.index;
    draw();
  }

  resize();
  draw(); // 首帧同步绘制，避免加载瞬间空白
  window.addEventListener("resize", resize, { passive: true });

  return { render, resize };
}
