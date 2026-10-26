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
    if (img.closest(".cx-figure,.cx-gallery,.cx-media-frame,.cx-auto-media,.cx-lightbox,.cx-story-card,.cx-record-row,.cx-article-cover,a,button")) return;
    const wrap = document.createElement("span");
    wrap.className = "cx-auto-media";
    const media = img.closest("picture") || img;
    media.before(wrap);
    wrap.appendChild(media);
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

// Native modal provides focus containment, Escape handling and an inert background.
const lightbox = document.querySelector("dialog.cx-lightbox");
const lightboxImage = lightbox?.querySelector("img");
if (lightbox && lightboxImage && typeof lightbox.showModal === "function") {
  const caption = lightbox.querySelector("figcaption");
  const count = lightbox.querySelector("[data-lightbox-count]");
  const previous = lightbox.querySelector("[data-lightbox-prev]");
  const next = lightbox.querySelector("[data-lightbox-next]");
  const images = [...document.querySelectorAll(".cx-article-cover img,.cx-article__content img,.cx-media-frame img,.cx-auto-media img")]
    .filter(img => !img.closest("a,button,.cx-lightbox"));
  let active = 0;
  let opener;

  function displayImage(index) {
    active = (index + images.length) % images.length;
    const img = images[active];
    const label = img.alt || `Görsel ${active + 1}`;
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || "";
    caption.textContent = label;
    count.textContent = `${active + 1} / ${images.length}`;
    previous.hidden = next.hidden = images.length < 2;
  }
  lightboxImage.addEventListener("error", () => {
    caption.textContent = "Görsel yüklenemedi. Önizlemeyi kapatıp yeniden deneyebilirsin.";
  });
  images.forEach((img, index) => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cx-image-trigger";
    trigger.setAttribute("aria-label", `Görseli büyüt: ${img.alt || `Görsel ${index + 1}`}`);
    trigger.setAttribute("aria-haspopup", "dialog");
    const media = img.closest("picture") || img;
    media.before(trigger);
    trigger.appendChild(media);
    trigger.addEventListener("click", () => {
      opener = trigger;
      displayImage(index);
      lightbox.showModal();
      document.documentElement.classList.add("cx-modal-open");
    });
  });
  previous.addEventListener("click", () => displayImage(active - 1));
  next.addEventListener("click", () => displayImage(active + 1));
  lightbox.querySelector(".cx-lightbox__close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      const controls = [...lightbox.querySelectorAll("button")].filter(button => !button.hidden && !button.disabled);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      displayImage(active + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  lightbox.addEventListener("close", () => {
    document.documentElement.classList.remove("cx-modal-open");
    lightboxImage.removeAttribute("src");
    opener?.focus({ preventScroll: true });
  });
}

// Native anchor navigation still works without JavaScript.
document.querySelectorAll(".cx-toc a").forEach(link => {
  const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!heading) return;
  heading.tabIndex = -1;
  link.addEventListener("click", () => heading.focus({ preventScroll: true }));
});

console.info("CoreXLyth // system online");

const expandButton = document.querySelector("[data-records-expand]");
const recordList = document.getElementById(expandButton?.getAttribute("aria-controls") || "");
if (expandButton && recordList) {
  const extraRows = [...recordList.querySelectorAll(".cx-record-row--extra")];
  expandButton.hidden = false;
  expandButton.disabled = extraRows.length === 0;
  expandButton.title = extraRows.length ? "Diğer kayıtları göster" : "Tüm kayıtlar zaten gösteriliyor";
  const setExpanded = (expanded) => {
    extraRows.forEach(row => row.hidden = !expanded);
    expandButton.setAttribute("aria-expanded", String(expanded));
    expandButton.innerHTML = expanded ? 'AKIŞI DARALT <span>↑</span>' : 'AKIŞI GENİŞLET <span>↓</span>';
  };
  setExpanded(false);
  if (!extraRows.length) expandButton.removeAttribute("aria-expanded");
  expandButton.addEventListener("click", () => setExpanded(expandButton.getAttribute("aria-expanded") !== "true"));
}

document.querySelectorAll(".cx-panel-carousel").forEach((carousel) => {
  carousel.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (carousel.scrollWidth <= carousel.clientWidth) return;
    event.preventDefault();
    carousel.scrollLeft += event.deltaY;
  }, {passive:false});
});

