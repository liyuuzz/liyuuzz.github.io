import { siteConfig } from "../../config/site.config.js";

export function renderProjects() {
  return `
    <div class="section-heading section-heading--row">
      <div><p class="eyebrow">SELECTED WORKS</p><h2 id="projects-title">实验与作品</h2></div>
      <p>每个项目都是一次新的探索。<br />从问题出发，用设计与代码寻找答案。</p>
    </div>
    <div class="project-grid">
      ${siteConfig.projects.map((project) => `
        <a class="project-card project-card--${project.theme}" href="${project.link}">
          <div class="project-card__visual">
            <div class="mini-scene"><i></i><i></i><i></i></div>
            <span>${project.index}</span>
          </div>
          <div class="project-card__body">
            <p>${project.type}</p>
            <h3>${project.title}</h3>
            <div class="project-card__footer"><span>${project.description}</span><b>↗</b></div>
          </div>
        </a>
      `).join("")}
    </div>
  `;
}
