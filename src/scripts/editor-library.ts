import {publicationState,type EditorEntry,type PublishedVersion} from '../lib/publication-state';
export function editorLibrary(root:HTMLElement,onSelect:(slug:string)=>void){
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const items=$('[data-library-items]'),category=$<HTMLSelectElement>('[data-library-category]'),query=$<HTMLInputElement>('[data-library-query]');
 let posts:EditorEntry[]=[],selected='',disabled=false;const versions=new Map<string,PublishedVersion>(),checked=new Map<string,number>();
 function render(){
  const group=posts;
  const previous=category.value;category.replaceChildren(new Option('Tüm kategoriler',''));
  for(const value of [...new Set(group.map(p=>p.category||'Kategorisiz'))].sort((a,b)=>a.localeCompare(b,'tr')))category.add(new Option(value,value));
  if([...category.options].some(o=>o.value===previous))category.value=previous;

  const needle=query.value.toLocaleLowerCase('tr-TR').trim();const visible=group.filter(p=>(!category.value||(p.category||'Kategorisiz')===category.value)&&(!needle||`${p.title} ${p.category||''}`.toLocaleLowerCase('tr-TR').includes(needle)));
  items.replaceChildren();
  for(const post of visible){
   const button=document.createElement('button');button.type='button';button.className='cx-editor-entry';button.dataset.libraryOpen=post.slug;button.disabled=disabled;if(post.slug===selected)button.setAttribute('aria-current','true');
   const heading=document.createElement('strong');heading.textContent=post.title;
   const meta=document.createElement('span');meta.className='cx-editor-entry__meta';meta.textContent=post.category||'Kategorisiz';
   const state=publicationState(post,versions.get(post.slug),checked.get(post.slug)===(post.published_revision??post.revision));const badge=document.createElement('span');badge.className='cx-editor-entry__state';badge.dataset.state=state.key;badge.textContent=post.published?state.label:'Yayında değil';
   const detail=document.createElement('small');detail.textContent=post.description||'Düzenlemek için aç.';
   button.append(meta,heading,badge,detail);button.addEventListener('click',()=>{if(!disabled)onSelect(post.slug);});items.append(button);
  }
  if(!visible.length){const empty=document.createElement('p');empty.textContent=category.value||needle?'Bu filtreyle eşleşen yazı yok.':'Henüz yazı yok.';items.append(empty);}
 }
 category.addEventListener('change',render);query.addEventListener('input',render);
 return {
  get value(){return selected;},set value(value:string){if(value!==selected){const p=posts.find(p=>p.slug===value);if(p){category.value='';query.value='';}}selected=value;render();},
  set disabled(value:boolean){disabled=value;items.querySelectorAll<HTMLButtonElement>('[data-library-open]').forEach(button=>button.disabled=value);},
  setPosts(value:EditorEntry[]){posts=value;render();},
  manifest(value:PublishedVersion[]){versions.clear();for(const p of value)versions.set(p.slug,p);render();},
  verified(slug:string,revision:number){checked.set(slug,revision);render();},
  unverified(slug:string){checked.delete(slug);render();},
  clear(){posts=[];selected='';query.value='';checked.clear();versions.clear();render();},
  reveal(value:string){selected='';this.value=value;}
 };
}
