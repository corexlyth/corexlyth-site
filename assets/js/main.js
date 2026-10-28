"use strict";

document.documentElement.dataset.corexlyth = "online";

const boot = document.querySelector(".cx-boot");
window.addEventListener("load", () => {
  window.setTimeout(() => boot?.classList.add("is-done"), 420);
});

const menuButton = document.querySelector(".cx-menu-button");
const nav = document.querySelector(".cx-nav");
function markCurrentNavigation() {
  if (!nav) return;
  const current=new URL(location.href);
  let match=null;
  for (const link of nav.querySelectorAll('a')) {
    const target=new URL(link.href,location.href);
    const pathMatch=target.pathname.replace(/\/$/,'')===current.pathname.replace(/\/$/,'') || (current.pathname.includes('/yazi/') && target.pathname.endsWith('/arsiv/'));
    if(pathMatch && (target.hash ? target.hash===current.hash : !current.hash)) match=link;
    link.removeAttribute('aria-current');
  }
  match?.setAttribute('aria-current','page');
}
markCurrentNavigation();
window.addEventListener('hashchange',markCurrentNavigation);

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

const revealNodes = document.querySelectorAll(".cx-channel,.cx-featured,.cx-log-card,.cx-info,.cx-category-panel,.cx-all-records,.cx-article__content > p,.cx-article__content > h2,.cx-article__content > h3,.cx-article__content > aside,.cx-article__content > figure,.cx-article__content > ul,.cx-article__content > ol,.cx-article__content > blockquote");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("cx-motion");
  revealNodes.forEach((node) => node.classList.add("cx-reveal"));
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      obs.unobserve(entry.target);
    });
  }, {threshold: 0, rootMargin: "0px 0px 40px 0px"});
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


// Reading progress tracks the article, not comments or related posts.
const progressBar=document.querySelector('.cx-reading-progress span');
const readingArticle=document.querySelector('.cx-article');
if(progressBar && readingArticle){
 let queued=false;
 const update=()=>{queued=false;const end=readingArticle.getBoundingClientRect().bottom+window.scrollY;const distance=Math.max(1,end-window.innerHeight);const value=Math.max(0,Math.min(1,window.scrollY/distance));progressBar.style.transform=`scaleX(${value})`;};
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(update);}};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
 if('ResizeObserver' in window)new ResizeObserver(schedule).observe(readingArticle);
 update();
}

// A short eased glide for discrete mouse-wheel steps. Native touch, trackpad,
// nested scrollers, zoom gestures and reduced-motion preferences stay native.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let target=0, frame=0, lastTime=0;
  const stop=()=>{if(frame) cancelAnimationFrame(frame);frame=0;lastTime=0;};
  const maxScroll=()=>Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const insideScroller=(element)=>{
    for(let node=element instanceof Element ? element : element?.parentElement;node && node!==document.body;node=node.parentElement){
      if(node.matches('dialog,textarea,select,input,[contenteditable="true"],.cx-panel-carousel'))return true;
      const style=getComputedStyle(node);
      if((/(auto|scroll)/.test(style.overflowY) && node.scrollHeight>node.clientHeight+1) || (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth>node.clientWidth+1))return true;
    }
    return false;
  };
  function tick(time){
    if(motion.matches){stop();return;}
    target=Math.max(0,Math.min(maxScroll(),target));
    const elapsed=lastTime?Math.min(time-lastTime,50):16;lastTime=time;
    const delta=target-window.scrollY;
    if(Math.abs(delta)<.5){window.scrollTo({top:target,behavior:'instant'});stop();return;}
    window.scrollTo({top:window.scrollY+delta*(1-Math.exp(-elapsed/85)),behavior:'instant'});
    frame=requestAnimationFrame(tick);
  }
  window.addEventListener('wheel',event=>{
    if(motion.matches||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!event.cancelable||Math.abs(event.deltaX)>0||insideScroller(event.target)){stop();return;}
    const amount=Math.abs(event.deltaY);
    // Fine high-frequency pixel deltas are usually trackpad input: preserve them.
    if(!amount || (event.deltaMode===0 && (amount<80 || !Number.isInteger(amount)))){stop();return;}
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1);
    const next=Math.max(0,Math.min(maxScroll(),(frame?target:window.scrollY)+pixels));
    if(!frame && Math.abs(next-window.scrollY)<.5)return;
    event.preventDefault();target=next;
    if(!frame)frame=requestAnimationFrame(tick);
  },{passive:false});
  for(const type of ['touchstart','pointerdown','keydown'])window.addEventListener(type,stop,{passive:true});
  motion.addEventListener?.('change',stop);
})();


// Decorative background follows page progress without blocking native scrolling.
const signalDepth = document.querySelector('[data-signal-depth]');
if (signalDepth) {
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
 let pending = false;
 const updateSignal = () => {
  pending = false;
  if (reduced.matches) { signalDepth.style.removeProperty('--signal-y'); signalDepth.style.removeProperty('--signal-turn'); return; }
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const progress = Math.max(0, Math.min(1, scrollY / max));
  signalDepth.style.setProperty('--signal-y', `${Math.round(progress * -150)}px`);
  signalDepth.style.setProperty('--signal-turn', `${(progress * 38).toFixed(1)}deg`);
 };
 const scheduleSignal = () => { if (!pending) { pending = true; requestAnimationFrame(updateSignal); } };
 addEventListener('scroll', scheduleSignal, {passive:true});
 addEventListener('resize', scheduleSignal, {passive:true});
 reduced.addEventListener?.('change', scheduleSignal);
 scheduleSignal();
}

// Whole-page cyber backdrop responds to the reader's progress.
const cyberworld = document.querySelector('[data-cyberworld]');
if (cyberworld) {
 const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
 let queued = false;
 const paint = () => {
  queued = false;
  if (motionPreference.matches) { cyberworld.style.removeProperty('--cyber-scroll'); return; }
  const range = Math.max(1,document.documentElement.scrollHeight-innerHeight);
  cyberworld.style.setProperty('--cyber-scroll', `${Math.round(Math.min(1,Math.max(0,scrollY/range))*-180)}px`);
 };
 const schedule = () => { if (!queued) {queued=true;requestAnimationFrame(paint);} };
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});motionPreference.addEventListener?.('change',schedule);schedule();
}
