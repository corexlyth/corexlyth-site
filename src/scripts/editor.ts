import { getAuthClient } from '../lib/supabase-client';
import { validContent,validSlug,type ContentPayload } from '../lib/content-rules';
import { renderArticleMarkdown } from '../lib/article-markdown';
import { editorToolbar } from './editor-toolbar';
import DOMPurify from 'dompurify';
import { editorMedia } from './editor-media';
const root=document.querySelector<HTMLElement>('[data-editor]');
if(root)void initialize(root);
async function initialize(root:HTMLElement){
 const client=getAuthClient();const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const form=$<HTMLFormElement>('[data-editor-form]'),list=$<HTMLSelectElement>('[data-editor-list]');
 let revision=0,slug='',role='',busy=false,dirty=false,published=false,signedOut=false,sessionEpoch=0,previewVersion=0,publicationDate='';
 let previewTimer:ReturnType<typeof setTimeout>;
 const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
 const tell=(s:string,error=false)=>{$('[data-editor-status]').textContent=s;$('[data-editor-status]').dataset.error=String(error);};
 const sync=()=>{root.querySelectorAll<HTMLButtonElement>('.cx-editor-media button').forEach(b=>b.disabled=busy||signedOut);form.querySelector('fieldset')!.disabled=busy||signedOut;list.disabled=busy||signedOut;$<HTMLButtonElement>('[data-editor-new]').disabled=busy||signedOut;
  $<HTMLButtonElement>('[data-editor-publish]').disabled=busy||dirty||!revision||role!=='owner';
  $<HTMLButtonElement>('[data-editor-unpublish]').disabled=busy||!published||role!=='owner';};
 const reason=(e:{message?:string;code?:string;status?:number})=>e.message?.includes('revision_conflict')?'Yazı başka bir oturumda değişti. Metnini kopyalayarak koru; yazıyı yeniden açıp son sürümle karşılaştır.':e.message?.includes('publisher_required')?'Yayımlama için site sahibi yetkisi gerekiyor.':e.message?.includes('editor_required')||e.message?.includes('login_required')||e.code==='42501'||e.status===403?'Bu bölüm yalnızca yetkili içerik yöneticilerine açıktır.':e.message?.includes('media_not_found')?'Yazıda kullanılan bir görsel bulunamadı. Önce görseli yükleyip yeniden seç.':e.message?.includes('too_many_images')?'Bir yazıda en fazla 100 yüklü görsel kullanılabilir.':e.message?.includes('rate_limited')?'Çok sık kaydettin. Biraz bekleyip tekrar dene.':'İşlem tamamlanamadı. Alanları ve bağlantını kontrol et.';
 function payload():ContentPayload {return {title:field('title').value.trim(),description:field('description').value.trim(),body:field('body').value,category:field('category').value.trim(),tags:field('tags').value.split(',').map(s=>s.trim()).filter(Boolean),pubDate:publicationDate||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date()),cover:field('cover').value,coverAlt:field('coverAlt').value.trim(),featured:field('featured').checked};}
 function state(){
  $('[data-editor-state]').textContent=revision?`Taslak sürümü: ${revision}. ${published?'Yayın isteği etkin.':'Yayında değil.'}${dirty?' Kaydedilmemiş değişiklikler var.':''}`:'Yeni taslak henüz kaydedilmedi.';
  field('slug').readOnly=Boolean(revision);$('[data-editor-date]').textContent=published&&publicationDate?`İlk yayın tarihi: ${new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul'}).format(new Date(publicationDate+'T12:00:00+03:00'))}. Düzenlemelerde bu tarih korunur.`:'Yayın tarihi ilk yayımlama anında otomatik belirlenir. Hazır olmayan yazıyı taslak olarak saklayabilirsin.';sync();
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
  try{previewVersion++;form.reset();field('cover').value='';$<HTMLImageElement>('[data-media-cover-preview]').removeAttribute('src');$('[data-media-cover-preview]').hidden=true;$('[data-editor-preview-box]').hidden=true;$('[data-editor-live]').hidden=true;
   if(!value){slug='';revision=0;published=false;publicationDate='';}
   else{const {data,error}=await client!.rpc('cx_editor_read',{p_slug:value});if(error)throw error;if(epoch!==sessionEpoch)throw new Error('login_required');slug=data.slug;revision=data.revision;published=data.published;
    publicationDate=data.payload.pubDate;
    for(const [k,v] of Object.entries(data.payload)){if(k==='featured')field(k).checked=Boolean(v);else if(field(k))field(k).value=Array.isArray(v)?v.join(', '):String(v);}
    field('slug').value=slug;
    $('[data-editor-live]').hidden=!published;$<HTMLAnchorElement>('[data-editor-live-link]').href=`${root.dataset.base}yazi/${encodeURIComponent(slug)}/`;
   }
   $('[data-media-status]').textContent=field('cover').value?'Bu yazının kayıtlı kapağı kullanılıyor. Değiştirmek için yeni bir görsel yükle.':'Bu yazının kapak görselini cihazından yükle.';
   dirty=false;list.value=slug;await deployedState();tell('Yazı düzenlemeye hazır.');schedulePreview();
  }catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}
 }
 if(!client){tell('Yazı hizmeti yapılandırılmadı.',true);return;}
 const media=editorMedia(root,client,{busy:(v)=>{busy=v;sync();},alive:()=>!signedOut,
  cover:(path,alt)=>{field('cover').value=path;field('coverAlt').value=alt;dirty=true;state();schedulePreview();},
  inline:(images,gallery)=>{const body=field('body') as unknown as HTMLTextAreaElement;const lines=images.map(({path,alt})=>{const escaped=alt.replace(/\\/g,'\\\\').replace(/\[/g,'\\[').replace(/\]/g,'\\]').replace(/[\r\n]/g,' ');return `![${escaped}](${root.dataset.base}${path})`;});
   const text=gallery?'> [!GALLERY]\n'+lines.map(s=>'> '+s).join('\n>\n'):lines.join('\n\n');body.setRangeText('\n\n'+text+'\n\n',body.selectionStart,body.selectionEnd,'end');dirty=true;state();schedulePreview();}

 });
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){signedOut=true;sessionEpoch++;previewVersion++;clearTimeout(previewTimer);role='';media.clear();sync();$('[data-editor-tools]').hidden=true;form.reset();field('cover').value='';$<HTMLImageElement>('[data-media-cover-preview]').removeAttribute('src');$('[data-media-cover-preview]').hidden=true;publicationDate='';$('[data-editor-preview-body]').replaceChildren();$('[data-editor-preview-title]').textContent='';$<HTMLImageElement>('[data-editor-preview-cover]').removeAttribute('src');$('[data-editor-deployed]').textContent='';list.replaceChildren();dirty=false;tell('Oturum kapatıldı. Yazıları yönetmek için tekrar giriş yap.');}});
 try{await refreshList();$('[data-editor-tools]').hidden=false;await open('');try{await media.refresh();}catch{root.querySelector('[data-media-status]')!.textContent='Görsel listesi yüklenemedi. Sayfayı yenileyerek tekrar dene.';}}catch(e){tell(reason(e as Error),true);return;}
 form.addEventListener('input',()=>{dirty=true;state();schedulePreview();});form.addEventListener('change',()=>{dirty=true;state();schedulePreview();});
 editorToolbar(root,()=>{dirty=true;state();},schedulePreview);
 form.addEventListener('submit',event=>{event.preventDefault();void(async()=>{
  if(busy||!form.reportValidity())return;
  const p=payload(),id=field('slug').value.trim();if(!p.cover){tell('Önce bu yazı için bir kapak görseli yükle.',true);return;}if(!validContent(p)||!validSlug(id)){tell('Alanları kontrol et. Başlık, açıklama, etiketler ve adres geçerli olmalı.',true);return;}
  busy=true;sync();
  try{const {data,error}=await client.rpc('cx_editor_write',{p_action:'save',p_slug:id,p_expected:revision,p_payload:p});if(error)throw error;slug=id;revision=data.revision;publicationDate=data.pubDate||publicationDate;dirty=false;await refreshList();tell('Taslak özel olarak kaydedildi. Yayımdaki sürüm değişmedi.');}
  catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}
 })();});
 async function publish(action:'publish'|'unpublish'){
  if(busy||!revision||(action==='publish'&&dirty))return;
  if(!window.confirm(action==='publish'?'Kaydedilmiş sürüm herkese açık yayın akışına eklensin mi?':'Yazı yayın akışından çıkarılsın mı? Statik sayfanın kaldırılması sonraki yayın kontrolünde gerçekleşir.'))return;
  busy=true;sync();
  try{const {data,error}=await client.rpc('cx_editor_write',{p_action:action,p_slug:slug,p_expected:revision});if(error)throw error;
   published=action==='publish';publicationDate=data?.pubDate||publicationDate;await refreshList();await deployedState();tell(published?'Yayın akışına eklendi. Site sıradaki yayın kontrolünden sonra güncellenecek.':'Yayından kaldırma kaydedildi. Site sıradaki yayın kontrolünden sonra güncellenecek.');
   $('[data-editor-live]').hidden=!published;$<HTMLAnchorElement>('[data-editor-live-link]').href=`${root.dataset.base}yazi/${encodeURIComponent(slug)}/`;
  }catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}
 }
 $('[data-editor-publish]').addEventListener('click',()=>{void publish('publish');});$('[data-editor-unpublish]').addEventListener('click',()=>{void publish('unpublish');});
 $('[data-editor-new]').addEventListener('click',()=>{void open('');});list.addEventListener('change',()=>{void open(list.value);});
 function schedulePreview(){previewVersion++;clearTimeout(previewTimer);previewTimer=setTimeout(()=>{void preview();},320);}
 async function preview(){
  const epoch=sessionEpoch,version=++previewVersion;const p=payload();if(!p.body.trim()&&!p.title.trim()){$('[data-editor-preview-box]').hidden=true;return;}
  try{
   const rendered=await renderArticleMarkdown(p.body);if(epoch!==sessionEpoch||version!==previewVersion)return;
   const fragment=DOMPurify.sanitize(rendered,{RETURN_DOM_FRAGMENT:true,USE_PROFILES:{html:true},FORBID_TAGS:['form','button','iframe'],FORBID_ATTR:['id','name']});
   for(const img of fragment.querySelectorAll('img')){const raw=img.getAttribute('src')||'';const match=raw.match(/assets\/img\/uploads\/[0-9a-f-]{36}\.webp/);if(match)img.src=await media.previewUrl(match[0]);}
   const coverUrl=p.cover?await media.previewUrl(p.cover):'';if(epoch!==sessionEpoch||version!==previewVersion)return;
   $('[data-editor-preview-title]').textContent=p.title;
   const cover=$<HTMLImageElement>('[data-editor-preview-cover]');if(coverUrl)cover.src=coverUrl;else cover.removeAttribute('src');cover.alt=p.coverAlt;cover.hidden=!coverUrl;
   const coverPreview=$<HTMLImageElement>('[data-media-cover-preview]');if(coverUrl)coverPreview.src=coverUrl;else coverPreview.removeAttribute('src');coverPreview.alt=p.coverAlt;coverPreview.hidden=!coverUrl;
   $('[data-editor-preview-body]').replaceChildren(fragment);$('[data-editor-preview-box]').hidden=false;
  }catch{if(epoch===sessionEpoch&&version===previewVersion)tell('Önizleme hazırlanamadı. Görselin yüklenmiş olduğundan emin ol.',true);}
 }
 $('[data-editor-preview]').addEventListener('click',()=>{clearTimeout(previewTimer);void preview();});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});

}
