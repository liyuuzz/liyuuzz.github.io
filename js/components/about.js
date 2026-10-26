/** 模块 02 · 关于 */
export function renderAbout(cfg) {
  const about = cfg.about;
  const titleLines = about.title.split("\n");

  return `
    <div class="plate">
      <header class="plate__head">
        <span class="plate__id">02</span>
        <span class="plate__label">Profile</span>
        <span class="plate__rule"></span>
      </header>

      <div class="about-grid">
        <div>
          <h2 class="plate__title">${titleLines.map((l) => `<span>${l}</span>`).join("")}</h2>
          <p class="plate__body">${about.body}</p>
        </div>

        <ul class="caps">
          ${about.traits
            .map(
              (t) => `
            <li class="cap">
              <span class="cap__id">${t.index}</span>
              <div>
                <h3 class="cap__title">${t.title}</h3>
                <p class="cap__note">${t.note}</p>
              </div>
            </li>`
            )
            .join("")}
        </ul>
      </div>
    </div>
  `;
}
