/**
 * 摄像机运镜
 * - world 元素承担摄像机位移，rot 元素承担摄像机旋转（轴心在摄像机位置）
 * - 转场使用缓动曲线，过程中叠加侧倾（roll）与俯仰，形成"转头穿越"的电影感
 * - 转场速度会实时暴露给背景层，用于生成拖尾与加速感
 */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const easeInOutQuart = (t) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

export function createCameraRig({ worldEl, rotEl, positions = [], reducedMotion = false }) {
  const cam = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, speed: 0 };

  let layout = positions;
  let index = 0;
  let tween = null;
  let pointer = { x: 0, y: 0 };
  let listeners = [];
  let changeListeners = [];
  let lastTime = performance.now();
  let elapsed = 0;
  let rafId = 0;

  function notifyChange(next) {
    index = next;
    changeListeners.forEach((fn) => fn(next));
  }

  /**
   * 移动到指定模块。
   * @param {number} target 目标模块下标
   * @param {{instant?: boolean}} opts
   */
  function goTo(target, opts = {}) {
    const next = clamp(Math.round(target), 0, layout.length - 1);
    if (!layout.length) return;

    const fromZ = cam.z;
    const toZ = -layout[next].z;

    if (opts.instant || reducedMotion) {
      cam.z = toZ;
      tween = null;
      notifyChange(next);
      apply();
      return;
    }

    // 跳转步数越多，运镜越长、侧倾越明显
    const steps = Math.abs(next - index);
    const dx = layout[next].x - layout[index].x;
    const bankBase = clamp((dx / 160) * 4.5, -9, 9);
    const bank = bankBase !== 0 ? bankBase : (next > index ? 1 : -1) * Math.min(5, 2.2 + steps);

    tween = {
      fromZ,
      toZ,
      start: performance.now(),
      dur: clamp(1250 + steps * 240, 1100, 2600),
      bank,
      pitch: next > index ? 1.6 : -1.2,
    };

    notifyChange(next);
  }

  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }
  function getIndex() { return index; }

  function setPointer(x, y) {
    pointer.x = clamp(x, -1, 1);
    pointer.y = clamp(y, -1, 1);
  }

  function setLayout(list) {
    layout = list;
    cam.z = -layout[index].z;
    apply();
  }

  function apply() {
    worldEl.style.transform =
      `translate3d(${(-cam.x).toFixed(2)}px, ${(-cam.y).toFixed(2)}px, ${cam.z.toFixed(2)}px)`;
    rotEl.style.transform =
      `rotateX(${cam.rx.toFixed(3)}deg) rotateY(${cam.ry.toFixed(3)}deg) rotateZ(${cam.rz.toFixed(3)}deg)`;
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    elapsed += dt;

    const prevZ = cam.z;

    if (tween) {
      const p = clamp((now - tween.start) / tween.dur, 0, 1);
      const e = easeInOutQuint(p);
      cam.z = tween.fromZ + (tween.toZ - tween.fromZ) * e;

      const hump = Math.sin(Math.PI * p);
      cam.ry = tween.bank * hump;
      cam.rz = -tween.bank * hump * 0.42;
      cam.rx = tween.pitch * hump;
      cam.x = pointer.x * 26 * (1 - hump);
      cam.y = pointer.y * 16 * (1 - hump) - 18 * hump;

      if (p >= 1) {
        cam.ry = 0;
        cam.rz = 0;
        cam.rx = 0;
        tween = null;
      }
    } else {
      const k = Math.min(1, dt * 2.6);
      cam.x += (pointer.x * 30 - cam.x) * k;
      cam.y += (pointer.y * 18 - cam.y) * k;
      cam.ry += (pointer.x * -2.2 - cam.ry) * k;
      cam.rx += (pointer.y * 1.5 - cam.rx) * k;
      cam.rz += (0 - cam.rz) * k;
    }

    cam.speed = Math.abs(cam.z - prevZ) / Math.max(dt, 0.0001);
    apply();

    const state = {
      camX: cam.x,
      camY: cam.y,
      camZ: cam.z,
      speed: cam.speed,
      index,
      positions: layout,
      time: elapsed,
    };
    listeners.forEach((fn) => fn(state, dt));

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  return {
    goTo,
    next,
    prev,
    start,
    stop,
    setPointer,
    setLayout,
    getIndex,
    get state() { return cam; },
    onFrame(fn) { listeners.push(fn); },
    onChange(fn) { changeListeners.push(fn); },
  };
}
