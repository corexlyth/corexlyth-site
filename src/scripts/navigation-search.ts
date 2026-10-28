const root = document.querySelector<HTMLElement>('[data-nav-search]');
if (root) {
  const toggle = root.querySelector<HTMLButtonElement>('.cx-nav-search__toggle')!;
  const panel = root.querySelector<HTMLElement>('.cx-nav-search__panel')!;
  const input = root.querySelector<HTMLInputElement>('input')!;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const status = root.querySelector<HTMLElement>('.cx-nav-search__status')!;
  const list = root.querySelector<HTMLElement>('.cx-nav-search__results')!;
  const base = root.dataset.base || '/';
  let enginePromise: Promise<any> | undefined, timer: ReturnType<typeof setTimeout>, request = 0;
  const header = root.closest<HTMLElement>('.cx-header__inner');
  const close = () => { panel.hidden = true; header?.classList.remove('is-search-open'); toggle.setAttribute('aria-expanded','false'); request++; };
  const open = () => { header?.classList.add('is-search-open'); panel.hidden = false; toggle.setAttribute('aria-expanded','true'); input.focus(); };
  toggle.addEventListener('click', () => panel.hidden ? open() : close());
  document.addEventListener('click', e => { if (!root.contains(e.target as Node)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { close(); toggle.focus(); } });
  async function search() {
    const query=input.value.trim().slice(0,100), id=++request; list.replaceChildren();
    if(query.length<2){status.textContent='Aramak için en az iki harf yaz.';return;}
    status.textContent='Yazılar aranıyor…';
    try {
      enginePromise ??= import(/* @vite-ignore */ `${base}pagefind/pagefind.js`).then(async api=>{await api.options({baseUrl:base});return api;}).catch(error=>{enginePromise=undefined;throw error;});
      const engine=await enginePromise, result=await engine.search(query);
      if(id!==request)return;
      const matches=result?.results || [];
      const records=await Promise.all(matches.map((item:any)=>item.data()));
      if(id!==request)return;
      // Pagefind may return partial matches; check the complete indexed article
      // so every entered term really occurs in the title or body.
      const words = (value: string) => (value.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/\p{M}/gu,'').match(/[\p{L}\p{N}]+/gu) || []);
      const terms = words(query);
      const contains = (text: string) => {
        const tokens = words(text);
        return terms.length > 0 && terms.every(term => tokens.some(token => /^\d+$/.test(term) ? token === term : token.startsWith(term)));
      };
      const relevant = records.filter((record:any) => contains(`${record.meta?.title || ''} ${record.content || ''}`));
      relevant.sort((a:any,b:any) => Number(contains(b.meta?.title || '')) - Number(contains(a.meta?.title || '')));
      for(const record of relevant.slice(0,5)){
        const url=new URL(record.url,location.origin); if(url.origin!==location.origin)continue;
        if(!url.pathname.startsWith(base))url.pathname=base+url.pathname.replace(/^\/+/, '');
        const a=document.createElement('a'); a.href=url.pathname+url.search+url.hash; a.className='cx-nav-search__result';
        const title=document.createElement('strong');title.textContent=record.meta?.title||'CoreXLyth yayını';
        const excerpt=document.createElement('span');excerpt.textContent=record.plain_excerpt||'Yazıyı görüntüle';a.append(title,excerpt);list.append(a);
      }
      status.textContent=relevant.length ? `${relevant.length} sonuç bulundu${relevant.length>5?' · ilk 5 gösteriliyor':''}.` : 'Sonuç bulunamadı. Başka bir kelime dene.';
    } catch(error){if(id!==request)return;console.warn('Arama yüklenemedi',error);status.textContent='Arama yüklenemedi. Tekrar deneyebilirsin.';}
  }
  input.addEventListener('input',()=>{ clearTimeout(timer); const id=++request; if(!input.value.trim()){list.replaceChildren();status.textContent='Aramak için en az iki harf yaz.';return;} timer=setTimeout(()=>{if(id===request)void search();},220); });
  form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);void search();});
}
