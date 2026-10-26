export function renderHero() {
  return `
    <div class="hero__copy">
      <p class="eyebrow">PORTFOLIO / 2026</p>
      <h1 id="hero-title">把想法，做成<br /><span>可体验的作品。</span></h1>
      <p class="hero__description">你好，我是 LiYuuzz。一名探索技术与创意的大学生，<br />用代码记录学习，也用设计让想法发生。</p>
      <div class="hero__actions">
        <a class="button button--primary" href="#projects">探索作品<span aria-hidden="true">↗</span></a>
        <a class="button button--ghost" href="#contact">与我联系</a>
      </div>
      <div class="hero__meta"><span>CODE</span><span>DESIGN</span><span>EXPERIMENT</span></div>
    </div>
    <div class="hero__visual" aria-label="可随指针旋转的三维科技核心">
      <div class="scene-grid"></div>
      <div class="orbit orbit--outer"></div>
      <div class="orbit orbit--inner"></div>
      <div class="cube">
        <div class="cube__face cube__face--front"></div>
        <div class="cube__face cube__face--back"></div>
        <div class="cube__face cube__face--right"></div>
        <div class="cube__face cube__face--left"></div>
        <div class="cube__face cube__face--top"></div>
        <div class="cube__face cube__face--bottom"></div>
      </div>
      <span class="scene-label">INTERACTIVE CORE / 01</span>
    </div>
  `;
}
