import { siteConfig } from "../../config/site.config.js";

const traits = [
  { index: "01", title: "构建", en: "BUILD", description: "把灵感变成真实界面，让想法落到可用、可感知的细节。" },
  { index: "02", title: "探索", en: "EXPLORE", description: "保持好奇与快速验证，在实验中找到新的表达方式。" },
  { index: "03", title: "设计", en: "DESIGN", description: "用清晰的视觉语言和克制的动效，连接技术与感受。" },
];

export function renderAbout() {
  return `
    <div class="section-heading">
      <p class="eyebrow">ABOUT / 个人简介</p>
      <h2 id="about-title">持续学习，<br />保持创造。</h2>
      <p>${siteConfig.intro ?? "关注技术与设计的交汇，把复杂想法转化为清晰、可用的数字体验。"}</p>
    </div>
    <div class="trait-grid">
      ${traits.map((item) => `
        <article class="trait-card">
          <span>${item.index} / ${item.en}</span>
          <h3>${item.title}</h3>
          <p>${item.description}</p>
        </article>
      `).join("")}
    </div>
  `;
}
