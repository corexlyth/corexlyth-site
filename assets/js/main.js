"use strict";

document.documentElement.dataset.corexlyth = "online";

const boot = document.querySelector(".cx-boot");
window.addEventListener("load", () => {
  window.setTimeout(() => boot?.classList.add("is-done"), 420);
});

const menuButton = document.querySelector(".cx-menu-button");
const nav = document.querySelector(".cx-nav");
menuButton?.addEventListener("click", () => {
  const open = nav?.classList.toggle("is-open") ?? false;
  menuButton.setAttribute("aria-expanded", String(open));
});
nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !nav?.classList.contains("is-open")) return;
  nav.classList.remove("is-open");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.focus();
});
document.addEventListener("click", (event) => {
  if (!nav?.classList.contains("is-open")) return;
  if (nav.contains(event.target) || menuButton?.contains(event.target)) return;
  nav.classList.remove("is-open");
  menuButton?.setAttribute("aria-expanded", "false");
});

function upgradeImages(root = document) {
  root.querySelectorAll("img").forEach((img) => {
    if (img.closest(".cx-media-frame,.cx-auto-media,.cx-lightbox,.cx-story-card,.cx-record-row,.cx-article-cover,a,button")) return;
    const wrap = document.createElement("figure");
    wrap.className = "cx-auto-media";
    img.parentNode?.insertBefore(wrap, img);
    wrap.appendChild(img);
  });
}
upgradeImages();

const revealNodes = document.querySelectorAll(".cx-channel,.cx-featured,.cx-log-card,.cx-info");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("cx-motion");
  revealNodes.forEach((node) => node.classList.add("cx-reveal"));
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      obs.unobserve(entry.target);
    });
  }, {threshold: .1});
  revealNodes.forEach((node) => observer.observe(node));
}

const toTop = document.querySelector(".cx-to-top");
const updateTopButton = () => toTop?.classList.toggle("is-visible", window.scrollY > 520);
window.addEventListener("scroll", updateTopButton, {passive:true});
updateTopButton();
toTop?.addEventListener("click", () => window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}));

const lightbox = document.querySelector(".cx-lightbox");
const lightboxImage = lightbox?.querySelector("img");
const closeLightbox = () => {
  if (!lightbox) return;
  lightbox.hidden = true;
  if (lightboxImage) lightboxImage.removeAttribute("src");
};
document.querySelectorAll(".cx-media-frame img,.cx-auto-media img").forEach((img) => {
  img.style.cursor = "zoom-in";
  img.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!lightbox || !lightboxImage) return;
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || "";
    lightbox.hidden = false;
  });
});
lightbox?.querySelector(".cx-lightbox__close")?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox && !lightbox.hidden) closeLightbox();
});

console.info("CoreXLyth // system online");

const expandButton = document.querySelector(".cx-expand-btn");
const recordList = document.querySelector(".cx-record-list");
expandButton?.addEventListener("click", () => {
  const expanded = recordList?.classList.toggle("is-expanded") ?? false;
  expandButton.setAttribute("aria-expanded", String(expanded));
  expandButton.innerHTML = expanded ? 'AKIŞI DARALT <span>↑</span>' : 'AKIŞI GENİŞLET <span>↓</span>';
});

document.querySelectorAll(".cx-panel-carousel").forEach((carousel) => {
  carousel.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (carousel.scrollWidth <= carousel.clientWidth) return;
    event.preventDefault();
    carousel.scrollLeft += event.deltaY;
  }, {passive:false});
});

