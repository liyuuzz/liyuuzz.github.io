import { siteConfig } from "../config/site.config.js";
import { renderHero } from "./components/hero.js";
import { renderAbout } from "./components/about.js";
import { renderProjects } from "./components/projects.js";
import { renderContact } from "./components/contact.js";

const mount = (selector, renderer) => {
  const target = document.querySelector(selector);
  if (target) target.innerHTML = renderer();
};

mount(".site-nav", () => `
  ${siteConfig.navigation.map((item) => `<a href="${item.href}">${item.label}</a>`).join("")}
`);
mount("#home", renderHero);
mount("#about", renderAbout);
mount("#projects", renderProjects);
mount("#contact", renderContact);
mount(".site-footer", () => `
  <span>© ${new Date().getFullYear()} ${siteConfig.owner}</span>
  <span>DESIGNED FOR THE NEXT IDEA</span>
`);

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  navigation.classList.toggle("is-open", !open);
});
navigation?.addEventListener("click", () => navigation.classList.remove("is-open"));

const tiltRoot = document.documentElement;
const canTilt = window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (canTilt) {
  window.addEventListener("pointermove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * -12;
    tiltRoot.style.setProperty("--tilt-x", `${y}deg`);
    tiltRoot.style.setProperty("--tilt-y", `${x}deg`);
  }, { passive: true });
  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--card-x", `${((event.clientY - rect.top) / rect.height - 0.5) * -7}deg`);
      card.style.setProperty("--card-y", `${((event.clientX - rect.left) / rect.width - 0.5) * 7}deg`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--card-x", "0deg");
      card.style.setProperty("--card-y", "0deg");
    });
  });
}
