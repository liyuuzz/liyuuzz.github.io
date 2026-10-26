/**
 * 联系区域的交互彩蛋：红眼
 *
 * 节奏（毫秒）：
 *   0     瞬间黑场（无过渡，硬切）
 *   60    红眼自黑暗中浮现
 *   640   眼珠开始左右张望
 *   2060  眨眼
 *   2400  红眼淡出
 *   2780  黑幕揭开，露出联系方式
 *   3440  结束
 *
 * 期间摄像机已同步推进到联系模块，黑幕揭开时人已经在那个空间里。
 * 任意点击 / 按键 / 滚轮 / 触摸都会立即跳过，避免挡住正常操作。
 */

const STEPS = [
  { at: 60, cls: "is-lit" },
  { at: 640, cls: "is-looking" },
  { at: 2060, cls: "is-blink" },
  { at: 2400, cls: "is-out" },
  { at: 2780, cls: "is-clear" },
];

const ALL_CLASSES = ["is-active", "is-lit", "is-looking", "is-blink", "is-out", "is-clear"];
const TOTAL = 3440;

export function createEyeGate(root) {
  let timers = [];
  let active = false;

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
    clearTimers();
    detach();
    root.classList.remove(...ALL_CLASSES);
    root.setAttribute("aria-hidden", "true");
  }

  function skip() {
    end();
  }

  function play() {
    if (!root || active) return;
    active = true;

    root.setAttribute("aria-hidden", "false");
    root.classList.add("is-active");

    STEPS.forEach((step) => {
      timers.push(window.setTimeout(() => root.classList.add(step.cls), step.at));
    });
    timers.push(window.setTimeout(end, TOTAL));

    // 捕获阶段监听，任何操作都优先结束彩蛋
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    window.addEventListener("wheel", skip, { capture: true, passive: true });
    window.addEventListener("touchstart", skip, { capture: true, passive: true });
  }

  return { play, skip, end };
}
