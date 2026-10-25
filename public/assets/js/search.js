"use strict";

(() => {
  const root = document.getElementById("cx-search");
  if (!root) return;
  const base = root.dataset.base || "/corexlyth-site/";
  const form = root.querySelector(".cx-search-form");
  const input = root.querySelector("#cx-search-input");
  const status = root.querySelector("#cx-search-state");
  const list = root.querySelector("#cx-search-results");
  let enginePromise;
  let requestId = 0;
  let debounce;

  const loadIndex = () => enginePromise ??= import(`${base}pagefind/pagefind.js`).then(async (api) => {
    await api.options({ baseUrl: base });
    return api;
  }).catch((error) => {
    enginePromise = null;
    throw error;
  });

  const setStatus = (message) => { status.textContent = message; };
  const clear = () => { list.replaceChildren(); };

  function safeResultURL(value) {
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      const expected = base.endsWith("/") ? base : base + "/";
      if (!url.pathname.startsWith(expected)) {
        url.pathname = expected + url.pathname.replace(/^\/+/, "");
      }
      if (!url.pathname.startsWith(expected)) return null;
      return url.pathname + url.search + url.hash;
    } catch {
      return null;
    }
  }

  function renderResult(record) {
    const href = safeResultURL(record.url);
    if (!href) return null;
    const link = document.createElement("a");
    link.className = "cx-search-result";
    link.href = href;
    const title = document.createElement("h2");
    title.textContent = record.meta?.title || "CoreXLyth yayını";
    const excerpt = document.createElement("p");
    excerpt.textContent = record.plain_excerpt || "Yayını görüntüle.";
    const url = document.createElement("small");
    url.textContent = "YAYINI AÇ  ↗";
    link.append(title, excerpt, url);
    return link;
  }

  async function search(raw, updateUrl = true) {
    const query = raw.trim().slice(0, 100);
    const thisRequest = ++requestId;
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      history.replaceState({}, "", url);
    }
    clear();
    if (query.length < 2) {
      setStatus(query ? "En az iki karakter yaz." : "Aramak için bir kelime yaz.");
      return;
    }
    setStatus("Kayıtlar taranıyor…");
    try {
      const engine = await loadIndex();
      const results = await engine.search(query);
      if (thisRequest !== requestId) return;
      const found = results?.results ?? [];
      if (!found.length) {
        setStatus(`“${query}” için sonuç bulunamadı. Başka bir kelime deneyebilirsin.`);
        return;
      }
      const records = await Promise.all(found.slice(0,30).map((entry) => entry.data()));
      if (thisRequest !== requestId) return;
      const fragment = document.createDocumentFragment();
      for (const record of records) {
        const element = renderResult(record);
        if (element) fragment.appendChild(element);
      }
      list.appendChild(fragment);
      setStatus(`${found.length} yayın bulundu${found.length > 30 ? " — ilk 30 sonuç gösteriliyor" : ""}.`);
    } catch (error) {
      if (thisRequest !== requestId) return;
      console.warn("CoreXLyth search index not available", error);
      setStatus("Arama dizini yüklenemedi. Arşiv üzerinden yazılara ulaşabilirsin.");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(debounce);
    search(input.value);
  });
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => search(input.value), 260);
  });
  window.addEventListener("popstate", () => {
    input.value = new URLSearchParams(window.location.search).get("q") || "";
    search(input.value, false);
  });
  input.value = new URLSearchParams(window.location.search).get("q") || "";
  if (input.value) search(input.value, false);
  else input.focus({ preventScroll: true });
})();
