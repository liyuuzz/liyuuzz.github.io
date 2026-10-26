/** 模块 04 · 联系 */
export function renderContact(cfg) {
  const contact = cfg.contact;
  const email = (cfg.email || "").trim();
  const titleLines = contact.title.split("\n");

  const rows = [];

  rows.push(`
    <li class="reach__row">
      <span class="reach__key">GITHUB</span>
      <a class="reach__val" href="${cfg.github}" target="_blank" rel="noreferrer">github.com/liyuuzz</a>
      <span class="reach__go">↗</span>
    </li>`);

  if (email) {
    rows.push(`
      <li class="reach__row">
        <span class="reach__key">EMAIL</span>
        <a class="reach__val" href="mailto:${email}">${email}</a>
        <span class="reach__go">↗</span>
      </li>`);
  }

  rows.push(`
    <li class="reach__row">
      <span class="reach__key">INDEX</span>
      <button class="reach__val" type="button" data-goto="0">回到入口</button>
      <span class="reach__go">←</span>
    </li>`);

  return `
    <div class="plate">
      <header class="plate__head">
        <span class="plate__id">04</span>
        <span class="plate__label">Contact</span>
        <span class="plate__rule"></span>
      </header>

      <h2 class="plate__title">${titleLines.map((l) => `<span>${l}</span>`).join("")}</h2>
      <p class="plate__body">${contact.description}</p>

      <ul class="reach">${rows.join("")}</ul>
    </div>
  `;
}
