/** 模块 03 · 作品：以列表呈现，避免卡片化的堆叠感 */
export function renderProjects(cfg) {
  const projects = cfg.projects;

  return `
    <div class="plate">
      <header class="plate__head">
        <span class="plate__id">03</span>
        <span class="plate__label">Works</span>
        <span class="plate__rule"></span>
      </header>

      <h2 class="plate__title">精选实验与作品</h2>

      <ol class="works">
        ${projects
          .map(
            (p) => `
          <li class="work">
            <span class="work__id">${p.index}</span>
            <div>
              <h3 class="work__title">${p.title}</h3>
              <p class="work__desc">${p.description}</p>
              <span class="work__tags">${p.tags.join(" / ")}</span>
            </div>
            <a class="work__link" href="${p.link}" target="_blank" rel="noreferrer">${p.linkLabel} ↗</a>
          </li>`
          )
          .join("")}
      </ol>
    </div>
  `;
}
