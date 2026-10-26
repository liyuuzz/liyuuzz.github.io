/** 模块 01 · 入口：标语 + 实时遥测（摄像机的运动被读成信号） */
export function renderHero(cfg) {
  const hero = cfg.hero;
  return `
    <div class="plate">
      <header class="plate__head">
        <span class="plate__id">01</span>
        <span class="plate__label">Entry</span>
        <span class="plate__rule"></span>
      </header>

      <div class="entry-grid">
        <div>
          <h1 class="plate__title">
            ${hero.title.map((line) => `<span>${line}</span>`).join("")}
          </h1>
          <p class="plate__body">${hero.description}</p>
          <div class="plate__actions">
            <button class="act" type="button" data-action="next">
              <span class="act__dot"></span>
              <span class="act__label">${hero.primary}</span>
              <span class="act__arrow">→</span>
            </button>
            <button class="act act--ghost" type="button" data-goto="3">
              <span class="act__dot"></span>
              <span class="act__label">${hero.secondary}</span>
              <span class="act__arrow">→</span>
            </button>
          </div>
        </div>

        <aside class="tele" aria-hidden="true">
          <div class="tele__screen"><canvas id="tele" width="680" height="280"></canvas></div>
          <div class="tele__meta">
            <span><i>Velocity</i><b id="teleV">0.00</b></span>
            <span><i>Depth</i><b id="teleD">0000</b></span>
            <span><i>Roll</i><b id="teleP">0.0°</b></span>
          </div>
        </aside>
      </div>
    </div>
  `;
}
