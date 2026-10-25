import { getAuthClient } from '../lib/supabase-client';
import { validContent,validSlug,type ContentPayload } from '../lib/content-rules';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
const root=document.querySelector<HTMLElement>('[data-editor]');
if(root)void initialize(root);
async function initialize(root:HTMLElement){
 const client=getAuthClient();const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const form=$<HTMLFormElement>('[data-editor-form]'),list=$<HTMLSelectElement>('[data-editor-list]');
 let revision=0,slug='',role='',busy=false,dirty=false,published=false,signedOut=false,sessionEpoch=0;
 const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
 const tell=(s:string,error=false)=>{$('[data-editor-status]').textContent=s;$('[data-editor-status]').dataset.error=String(error);};
 const sync=()=>{form.querySelector('fieldset')!.disabled=busy||signedOut;list.disabled=busy||signedOut;$<HTMLButtonElement>('[data-editor-new]').disabled=busy;
  $<HTMLButtonElement>('[data-editor-publish]').disabled=busy||dirty||!revision||role!=='owner';
  $<HTMLButtonElement>('[data-editor-unpublish]').disabled=busy||!published||role!=='owner';};
 const reason=(e:{message?:string;code?:string;status?:number})=>e.message?.includes('revision_conflict')?'Yazı başka bir oturumda değişti. Metnini kopyalayarak koru; yazıyı yeniden açıp son sürümle karşılaştır.':e.message?.includes('publisher_required')?'Yayımlama için site sahibi yetkisi gerekiyor.':e.message?.includes('future_publication_date')?'İleri tarihli yazıyı henüz yayımlayamazsın.':e.message?.includes('editor_required')||e.message?.includes('login_required')||e.code==='42501'||e.status===403?'Bu bölüm yalnızca yetkili içerik yöneticilerine açıktır.':e.message?.includes('rate_limited')?'Çok sık kaydettin. Biraz bekleyip tekrar dene.':'İşlem tamamlanamadı. Alanları ve bağlantını kontrol et.';
 function payload():ContentPayload {return {title:field('title').value.trim(),description:field('description').value.trim(),body:field('body').value,category:field('category').value.trim(),tags:field('tags').value.split(',').map(s=>s.trim()).filter(Boolean),pubDate:field('pubDate').value,cover:field('cover').value,coverAlt:field('coverAlt').value.trim(),featured:field('featured').checked};}
 function state(){
  $('[data-editor-state]').textContent=revision?`Taslak sürümü: ${revision}. ${published?'Yayın isteği etkin.':'Yayında değil.'}${dirty?' Kaydedilmemiş değişiklikler var.':''}`:'Yeni taslak henüz kaydedilmedi.';
  field('slug').readOnly=Boolean(revision);sync();
 }
 async function deployedState(){
  try{const response=await fetch(`${root.dataset.base}content-manifest.json`,{cache:'no-store'});if(!response.ok)return;const manifest=await response.json();const live=manifest.publications?.find((p:{slug:string})=>p.slug===slug);
   const info=$('[data-editor-deployed]');if(!slug){info.textContent='';return;}
   info.textContent=live?.active?`Sitede derlenen sürüm: ${live.revision}. ${live.revision!==revision?'Taslakta farklı bir sürüm var.':''}`:published?'Yayın akışında; siteye aktarılması bekleniyor.':'Sitede etkin bir yayın kaydı yok.';
  }catch{ /* Publication controls still work if status cannot be fetched. */ }
 }
 async function refreshList(){const epoch=sessionEpoch;const {data,error}=await client!.rpc('cx_editor_read');if(error)throw error;if(epoch!==sessionEpoch)throw new Error('login_required');role=data.role;list.replaceChildren(new Option('Yeni yazı',''));
  for(const p of data.posts)list.add(new Option(`${p.title} — ${p.published?'yayın akışında':'taslak'}${p.published&&p.revision!==p.published_revision?' · yeni değişiklikler var':''}`,p.slug));list.value=slug;}
 async function open(value:string){
  if(busy||signedOut)return;const epoch=sessionEpoch;if(dirty&&!window.confirm('Kaydedilmemiş değişiklikleri bırakıp devam etmek istiyor musun?')){list.value=slug;return;}
  busy=true;sync();
  try{form.reset();$('[data-editor-preview-box]').hidden=true;$('[data-editor-live]').hidden=true;
   if(!value){slug='';revision=0;published=false;field('pubDate').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());field('coverAlt').value='CoreXLyth teknoloji illüstrasyonu';}
   else{const {data,error}=await client!.rpc('cx_editor_read',{p_slug:value});if(error)throw error;if(epoch!==sessionEpoch)throw new Error('login_required');slug=data.slug;revision=data.revision;published=data.published;
    for(const [k,v] of Object.entries(data.payload)){if(k==='featured')field(k).checked=Boolean(v);else if(field(k))field(k).value=Array.isArray(v)?v.join(', '):String(v);}
    field('slug').value=slug;
    $('[data-editor-live]').hidden=!published;$<HTMLAnchorElement>('[data-editor-live-link]').href=`${root.dataset.base}yazi/${encodeURIComponent(slug)}/`;
   }
   dirty=false;list.value=slug;await deployedState();tell('Yazı düzenlemeye hazır.');
  }catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}
 }
 if(!client){tell('Yazı hizmeti yapılandırılmadı.',true);return;}
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){signedOut=true;sessionEpoch++;role='';$('[data-editor-tools]').hidden=true;form.reset();$('[data-editor-preview-body]').replaceChildren();$('[data-editor-preview-title]').textContent='';$('[data-editor-deployed]').textContent='';list.replaceChildren();dirty=false;tell('Oturum kapatıldı. Yazıları yönetmek için tekrar giriş yap.');}});
 try{await refreshList();$('[data-editor-tools]').hidden=false;await open('');}catch(e){tell(reason(e as Error),true);return;}
 form.addEventListener('input',()=>{dirty=true;state();});form.addEventListener('change',()=>{dirty=true;state();});
 form.addEventListener('submit',event=>{event.preventDefault();void(async()=>{
  if(busy||!form.reportValidity())return;
  const p=payload(),id=field('slug').value.trim();if(!validContent(p)||!validSlug(id)){tell('Alanları kontrol et. Başlık, açıklama, etiketler ve adres geçerli olmalı.',true);return;}
  busy=true;sync();
  try{const {data,error}=await client.rpc('cx_editor_write',{p_action:'save',p_slug:id,p_expected:revision,p_payload:p});if(error)throw error;slug=id;revision=data.revision;dirty=false;await refreshList();tell('Taslak özel olarak kaydedildi. Yayımdaki sürüm değişmedi.');}
  catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}
 })();});
 async function publish(action:'publish'|'unpublish'){
  if(busy||!revision||(action==='publish'&&dirty))return;
  if(!window.confirm(action==='publish'?'Kaydedilmiş sürüm herkese açık yayın akışına eklensin mi?':'Yazı yayın akışından çıkarılsın mı? Statik sayfanın kaldırılması sonraki yayın kontrolünde gerçekleşir.'))return;
  busy=true;sync();
  try{const {error}=await client.rpc('cx_editor_write',{p_action:action,p_slug:slug,p_expected:revision});if(error)throw error;
   published=action==='publish';await refreshList();await deployedState();tell(published?'Yayın akışına eklendi. Site sıradaki yayın kontrolünden sonra güncellenecek.':'Yayından kaldırma kaydedildi. Site sıradaki yayın kontrolünden sonra güncellenecek.');
   $('[data-editor-live]').hidden=!published;$<HTMLAnchorElement>('[data-editor-live-link]').href=`${root.dataset.base}yazi/${encodeURIComponent(slug)}/`;
  }catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}
 }
 $('[data-editor-publish]').addEventListener('click',()=>{void publish('publish');});$('[data-editor-unpublish]').addEventListener('click',()=>{void publish('unpublish');});
 $('[data-editor-new]').addEventListener('click',()=>{void open('');});list.addEventListener('change',()=>{void open(list.value);});
 $('[data-editor-preview]').addEventListener('click',()=>{void(async()=>{const epoch=sessionEpoch;$('[data-editor-preview-title]').textContent=field('title').value;
  const rendered=await marked.parse(field('body').value);if(epoch!==sessionEpoch)return;
  $('[data-editor-preview-body]').innerHTML=DOMPurify.sanitize(rendered,{USE_PROFILES:{html:true},FORBID_TAGS:['form','input','button','iframe'],FORBID_ATTR:['id','name']});$('[data-editor-preview-box]').hidden=false;})();});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});

}
