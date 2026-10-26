/**
 * 全站内容配置。
 * 修改这里的文字即可更新页面，无需改动组件与样式。
 * 新增模块：在 modules 里加一项，并在 js/components 里注册对应渲染函数。
 */
export const siteConfig = {
  owner: "LiYuuzz",
  brand: "LIYUUZZ",
  role: "Creative Developer",
  email: "", // 填入邮箱后会优先用于联系区块，留空则回退到 GitHub 主页
  github: "https://github.com/liyuuzz",

  // 空间里依次排列的模块，顺序即摄像机推进顺序
  modules: [
    { id: "home", label: "入口", en: "ENTRY" },
    { id: "about", label: "关于", en: "PROFILE" },
    { id: "projects", label: "作品", en: "WORKS" },
    { id: "contact", label: "联系", en: "CONTACT" },
  ],

  hero: {
    eyebrow: "SPACE 01 / ENTRY",
    title: ["把想法，", "做成可体验的作品。"],
    description:
      "你好，我是 LiYuuzz。用代码与设计，把抽象的想法搭成可以走进去的空间——这里是我的入口。",
    primary: "进入空间",
    secondary: "直接联系",
  },

  about: {
    eyebrow: "SPACE 02 / PROFILE",
    title: "持续学习，\n保持创造。",
    body: "我关注技术如何与设计结合，把复杂的想法转化为清晰、可用的数字体验。这条空间里记录着我的项目实验、学习过程，以及正在发生的下一步。",
    traits: [
      { index: "01", en: "BUILD", title: "把灵感变成真实界面", note: "从结构到交互，完整走完一遍实现。" },
      { index: "02", en: "EXPLORE", title: "保持好奇与快速验证", note: "先做出来，再在真实使用里修正方向。" },
      { index: "03", en: "DESIGN", title: "让体验清晰而有质感", note: "节奏、层级与细节，决定最终的感受。" },
    ],
  },

  projects: [
    {
      index: "01",
      type: "WEB EXPERIENCE",
      title: "沉浸式个人空间",
      description: "以连续 3D 场景组织个人信息，让浏览变成一次空间探索。",
      tags: ["3D Scene", "Interaction", "Responsive"],
      link: "https://liyuuzz.github.io/",
      linkLabel: "打开站点",
      theme: "lime",
    },
    {
      index: "02",
      type: "CREATIVE CODING",
      title: "生成式视觉实验",
      description: "把几何、运动与代码结合，生成持续变化且具有节奏感的图形。",
      tags: ["Generative", "Motion", "Canvas"],
      link: "https://github.com/liyuuzz",
      linkLabel: "查看代码",
      theme: "cyan",
    },
    {
      index: "03",
      type: "DIGITAL PRODUCT",
      title: "校园效率工具",
      description: "从真实需求出发，把重复流程转化为轻量清晰的工具。",
      tags: ["Product", "Utility", "Prototype"],
      link: "https://github.com/liyuuzz",
      linkLabel: "了解更多",
      theme: "violet",
    },
  ],

  contact: {
    eyebrow: "SPACE 04 / CONTACT",
    title: "下一次创造，\n从一次交流开始。",
    description: "欢迎交流技术、创意与新的项目想法。",
  },
};
