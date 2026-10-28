import { getAuthClient } from '../lib/supabase-client';
import { validContent,validSlug,type ContentPayload } from '../lib/content-rules';
import { renderArticleMarkdown } from '../lib/article-markdown';
import { editorToolbar } from './editor-toolbar';
import DOMPurify from 'dompurify';
import {titleSlug,readRecovery,recoveryKey,type Recovery} from '../lib/editor-draft';
import {editorLibrary} from './editor-library';
import {publicationState,pageMatchesPublication,type PublishedVersion} from '../lib/publication-state';
import { editorMedia } from './editor-media';
const root=document.querySelector<HTMLElement>('[data-editor]');
if(root)void initialize(root);
async function initialize(root:HTMLElement){
 const client=getAuthClient();const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const form=$<HTMLFormElement>('[data-editor-form]'),list=editorLibrary(root,value=>{void open(value);});
 let revision=0,slug='',role='',busy=false,dirty=false,published=false,signedOut=false,sessionEpoch=0,previewVersion=0,publicationDate='',publishedRevision=0,publicationStage='draft',publicationCheck=0;
 let publicationTimer:ReturnType<typeof setInterval>|undefined;
 let previewTimer:ReturnType<typeof setTimeout>,autoTimer:ReturnType<typeof setTimeout>,manualTimer:ReturnType<typeof setTimeout>;
 let saving=false,blocked=false,slugManual=false,lastAttempt=0,retries=0,owner='',pendingRecovery:Recovery|null=null;
 const reserved=new Set<string>();
 const categorySelect=$<HTMLSelectElement>('[data-editor-category]'),newCategory=$<HTMLInputElement>('[data-editor-category-new]');
 const initialCategories=[...categorySelect.options].map(option=>({value:option.value,text:option.text}));
 const saveStatus=(message:string,status='idle')=>{const el=$('[data-editor-save]');if(el.textContent!==message)el.textContent=message;el.dataset.state=status;};
 function chooseCategory(value:string){if(value&&![...categorySelect.options].some(o=>o.value===value)){categorySelect.add(new Option(value,value),categorySelect.options.length-1);}categorySelect.value=value;field('category').value=value;newCategory.value='';newCategory.required=false;$('[data-editor-category-wrap]').hidden=true;}
 function cache(){if(!owner||signedOut||!dirty)return false;try{localStorage.setItem(recoveryKey(owner),JSON.stringify({version:1,owner,slug:revision?slug:field('slug').value,revision,published,payload:payload(),at:Date.now()}));return true;}catch{return false;}}
 function clearCache(){if(owner)try{localStorage.removeItem(recoveryKey(owner));}catch{}}
 function changed(){dirty=true;retries=0;const cached=cache();state();saveStatus(saving?'Kaydediliyor… Yeni değişikliklerin de sıraya alındı.':blocked?'Yayın durdu. Sunucudaki sürümü kontrol et.':cached?'Değişiklikler bu cihazda korunuyor. Yayımlanmayı bekliyor.':'Kaydedilmemiş değişiklikler var.',saving?'saving':blocked?'error':'pending');scheduleAuto();schedulePreview();}
 function scheduleAuto(){clearTimeout(autoTimer);}
 function generateSlug(){if(!revision&&!saving&&!slugManual)field('slug').value=titleSlug(field('title').value,reserved);}

 const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
 const tell=(s:string,error=false)=>{$('[data-editor-status]').textContent=s;$('[data-editor-status]').dataset.error=String(error);};
 const sync=()=>{root.querySelectorAll<HTMLButtonElement>('.cx-editor-media button').forEach(b=>b.disabled=busy||signedOut);form.querySelector('fieldset')!.disabled=busy||signedOut||Boolean(pendingRecovery);list.disabled=busy||signedOut||saving||Boolean(pendingRecovery);$<HTMLButtonElement>('[data-editor-new]').disabled=busy||signedOut||saving||Boolean(pendingRecovery);$<HTMLButtonElement>('[data-editor-refresh]').disabled=busy||signedOut||saving||Boolean(pendingRecovery);
  root.querySelectorAll<HTMLButtonElement>('[data-editor-recovery] button').forEach(button=>button.disabled=busy||saving||signedOut);
  $<HTMLButtonElement>('[data-editor-slug-reset]').disabled=Boolean(revision)||saving;
  $<HTMLButtonElement>('[data-editor-publish]').disabled=busy||saving||Boolean(pendingRecovery)||role!=='owner';
  $<HTMLButtonElement>('[data-editor-unpublish]').disabled=busy||saving||Boolean(pendingRecovery)||!published||role!=='owner';};
 const reason=(e:{message?:string;code?:string;status?:number})=>e.message?.includes('revision_conflict')?'Yazı başka bir oturumda değişti. Metnini kopyalayarak koru; yazıyı yeniden açıp son sürümle karşılaştır.':e.message?.includes('publisher_required')?'Yayımlama için site sahibi yetkisi gerekiyor.':e.message?.includes('editor_required')||e.message?.includes('login_required')||e.code==='42501'||e.status===403?'Bu bölüm yalnızca yetkili içerik yöneticilerine açıktır.':e.message?.includes('media_not_found')?'Yazıda kullanılan bir görsel bulunamadı. Önce görseli yükleyip yeniden seç.':e.message?.includes('too_many_images')?'Bir yazıda en fazla 100 yüklü görsel kullanılabilir.':e.message?.includes('rate_limited')?'Çok sık kaydettin. Biraz bekleyip tekrar dene.':'İşlem tamamlanamadı. Alanları ve bağlantını kontrol et.';
 function payload():ContentPayload {return {title:field('title').value.trim(),description:field('description').value.trim(),body:field('body').value,category:field('category').value.trim(),tags:field('tags').value.split(',').map(s=>s.trim()).filter(Boolean),pubDate:publicationDate||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date()),cover:field('cover').value,coverAlt:field('coverAlt').value.trim(),featured:field('featured').checked};}
 function state(){
  $('[data-editor-state]').textContent=revision?`Yazı sürümü: ${revision}. ${published?(publicationStage==='live'?'Yayında.':'Siteye aktarımın tamamlanması bekleniyor.'):'Yayından kaldırıldı.'}${dirty?' Kaydedilmemiş değişiklikler var.':''}`:'Yeni yazı henüz yayımlanmadı.';
  field('slug').readOnly=Boolean(revision)||saving;$('[data-editor-date]').textContent=published&&publicationDate?`İlk yayın tarihi: ${new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul'}).format(new Date(publicationDate+'T12:00:00+03:00'))}. Düzenlemelerde bu tarih korunur.`:'Yayın tarihi ilk yayımlama anında otomatik belirlenir. ';sync();
 }
 async function deployedState(){
  if(signedOut)return;const epoch=sessionEpoch,target=slug,expected=publishedRevision,requested=published,check=++publicationCheck;
  const current=()=>epoch===sessionEpoch&&target===slug&&expected===publishedRevision&&requested===published&&check===publicationCheck;
  const view=$('[data-editor-live]'),link=$<HTMLAnchorElement>('[data-editor-live-link]'),info=$('[data-editor-deployed]');
  try{const response=await fetch(`${root.dataset.base}content-manifest.json`,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('manifest_unavailable');const manifest=await response.json();if(!current())return;
   const versions:PublishedVersion[]=(manifest.publications||[]).filter((p:PublishedVersion)=>typeof p.slug==='string'&&Number.isInteger(p.revision)&&typeof p.active==='boolean');list.manifest(versions);
   if(!target||!requested){view.hidden=true;link.removeAttribute('href');info.textContent=target?(versions.find(p=>p.slug===target)?.active?'Yayından kaldırma isteği aktarılıyor. Eski sayfa site güncellemesi bitene kadar açık kalabilir.':'Bu yazı yayında değil.'):'';publicationStage='draft';state();return;}
   const live=versions.find(p=>p.slug===target);const result=publicationState({slug:target,title:'',revision,published:requested,published_revision:expected},live);publicationStage=result.key;
   view.hidden=true;link.removeAttribute('href');
   if(result.key!=='ready'){info.textContent=result.key==='updating'?'Yayımdaki eski sürüm açık. İstenen güncelleme siteye aktarılıyor; işlem bitince bağlantı açılacak.':'Yayın isteğin alındı. Yazının siteye aktarımı bekleniyor. Bu aşamada henüz yayında değil.';state();return;}
   info.textContent='Yayın dosyası hazır. Yazının sayfası doğrulanıyor…';
   const url=`${root.dataset.base}yazi/${encodeURIComponent(target)}/`;const page=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});const html=page.ok?await page.text():'';if(!current())return;
   if(!page.ok||!pageMatchesPublication(html,target,expected)){publicationStage='queued';list.unverified(target);info.textContent='Site güncellemesi henüz bu adreste hazır değil. Bağlantı hazır olduğunda otomatik açılacak.';state();return;}
   publicationStage='live';list.verified(target,expected);link.href=url;view.hidden=false;info.textContent=`Yayında · sitedeki sürüm: ${expected}.${revision!==expected?' Yayımlanmamış değişiklikler var.':''}`;state();
  }catch{if(current()){if(publicationStage!=='live'){view.hidden=true;link.removeAttribute('href');}info.textContent='Yayın durumu kontrol edilemedi. Listeyi ve yayın durumunu yenileyerek tekrar deneyebilirsin.';state();}}
 }
 async function refreshList(){const epoch=sessionEpoch;const {data,error}=await client!.rpc('cx_editor_read');if(error)throw error;if(epoch!==sessionEpoch)throw new Error('login_required');role=data.role;list.setPosts(data.posts);
  for(const p of data.posts)reserved.add(p.slug);const current=data.posts.find((p:{slug:string})=>p.slug===slug);if(current){published=Boolean(current.published);publishedRevision=current.published_revision??(published?current.revision:0);}list.value=slug;}
 async function open(value:string,discardRecovery=true){
  if(busy||saving||signedOut||pendingRecovery)return;const epoch=sessionEpoch;if(dirty&&!window.confirm('Kaydedilmemiş değişiklikleri bırakıp devam etmek istiyor musun?')){list.value=slug;return;}
  clearTimeout(autoTimer);clearTimeout(manualTimer);busy=true;sync();
  try{let loaded:{slug:string;revision:number;published:boolean;publishedRevision?:number;payload:ContentPayload}|null=null;if(value){const {data,error}=await client!.rpc('cx_editor_read',{p_slug:value});if(error)throw error;if(epoch!==sessionEpoch)throw new Error('login_required');loaded=data;}
   if(discardRecovery)clearCache();blocked=false;retries=0;slugManual=Boolean(value);previewVersion++;form.reset();field('cover').value='';$<HTMLImageElement>('[data-media-cover-preview]').removeAttribute('src');$('[data-media-cover-preview]').hidden=true;$('[data-editor-preview-box]').hidden=true;$('[data-editor-live]').hidden=true;
   if(!value){slug='';revision=0;published=false;publicationDate='';publishedRevision=0;publicationStage='draft';chooseCategory('');}
   else{const data=loaded!;slug=data.slug;revision=data.revision;published=data.published;
    publicationDate=data.payload.pubDate;publishedRevision=data.publishedRevision??(published?revision:0);publicationStage=published?'queued':'draft';
    for(const [k,v] of Object.entries(data.payload)){if(k==='featured')field(k).checked=Boolean(v);else if(field(k))field(k).value=Array.isArray(v)?v.join(', '):String(v);}
    field('slug').value=slug;chooseCategory(data.payload.category);
   }
   $('[data-media-status]').textContent=field('cover').value?'Bu yazının kayıtlı kapağı kullanılıyor. Değiştirmek için yeni bir görsel yükle.':'Bu yazının kapak görselini cihazından yükle.';
   dirty=false;list.value=slug;saveStatus(revision?'Kayıtlı yazı açık.':'Henüz yayımlanmamış yeni yazı.');void deployedState();tell('Yazı düzenlemeye hazır.');schedulePreview();
  }catch(e){if(epoch===sessionEpoch){list.value=slug;tell(reason(e as Error),true);}}finally{if(epoch===sessionEpoch){busy=false;state();if(dirty)scheduleAuto();}}
 }
 if(!client){tell('Yazı hizmeti yapılandırılmadı.',true);return;}
 const media=editorMedia(root,client,{busy:(v)=>{busy=v;sync();},alive:()=>!signedOut,
  cover:(path,alt)=>{field('cover').value=path;field('coverAlt').value=alt;changed();},
  inline:(images,gallery)=>{const body=field('body') as unknown as HTMLTextAreaElement;const lines=images.map(({path,alt})=>{const escaped=alt.replace(/\\/g,'\\\\').replace(/\[/g,'\\[').replace(/\]/g,'\\]').replace(/[\r\n]/g,' ');return `![${escaped}](${root.dataset.base}${path})`;});
   const text=gallery?'> [!GALLERY]\n'+lines.map(s=>'> '+s).join('\n>\n'):lines.join('\n\n');body.setRangeText('\n\n'+text+'\n\n',body.selectionStart,body.selectionEnd,'end');changed();}

 });
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(owner&&session?.user&&session.user.id!==owner)){signedOut=true;sessionEpoch++;previewVersion++;clearTimeout(previewTimer);clearTimeout(autoTimer);clearTimeout(manualTimer);clearCache();pendingRecovery=null;owner='';saving=false;if(publicationTimer)clearInterval(publicationTimer);publicationCheck++;publishedRevision=0;publicationStage='draft';role='';revision=0;slug='';published=false;categorySelect.replaceChildren(...initialCategories.map(option=>new Option(option.text,option.value)));chooseCategory('');$('[data-editor-live]').hidden=true;$<HTMLAnchorElement>('[data-editor-live-link]').removeAttribute('href');$('[data-editor-state]').textContent='';$('[data-editor-recovery]').hidden=true;saveStatus('Oturum kapatıldı.');media.clear();sync();$('[data-editor-tools]').hidden=true;form.reset();field('cover').value='';$<HTMLImageElement>('[data-media-cover-preview]').removeAttribute('src');$('[data-media-cover-preview]').hidden=true;publicationDate='';$('[data-editor-preview-body]').replaceChildren();$('[data-editor-preview-title]').textContent='';$<HTMLImageElement>('[data-editor-preview-cover]').removeAttribute('src');$('[data-editor-deployed]').textContent='';list.clear();dirty=false;tell('Oturum kapatıldı. Yazıları yönetmek için tekrar giriş yap.');}});
 try{const authEpoch=sessionEpoch;await refreshList();const {data:identity,error:identityError}=await client.auth.getUser();if(identityError||!identity.user)throw new Error('login_required');if(authEpoch!==sessionEpoch||signedOut)return;owner=identity.user.id;
  let recovery:Recovery|null=null;try{recovery=readRecovery(localStorage.getItem(recoveryKey(owner)),owner);if(!recovery)clearCache();}catch{}
  $('[data-editor-tools]').hidden=false;await open('',false);pendingRecovery=recovery;
  if(recovery){$('[data-editor-recovery]').hidden=false;saveStatus('Yarım kalan değişiklikler var. Devam etmeyi veya vazgeçmeyi seç.','pending');sync();}
  try{await media.refresh();}catch{root.querySelector('[data-media-status]')!.textContent='Görsel listesi yüklenemedi. Sayfayı yenileyerek tekrar dene.';}
 }catch(e){tell(reason(e as Error),true);return;}
 $('[data-recovery-discard]').addEventListener('click',()=>{pendingRecovery=null;clearCache();$('[data-editor-recovery]').hidden=true;state();saveStatus('Henüz yayımlanmamış yeni yazı.');});
 $('[data-recovery-restore]').addEventListener('click',()=>{void(async()=>{
  const r=pendingRecovery;if(!r||busy||signedOut)return;const epoch=sessionEpoch;busy=true;sync();
  try{let same=false;if(r.revision){const result=await client.rpc('cx_editor_read',{p_slug:r.slug});if(result.error)throw result.error;same=result.data.revision===r.revision;published=same&&result.data.published;publishedRevision=same?(result.data.publishedRevision??(published?result.data.revision:0)):0;}
   if(epoch!==sessionEpoch)return;
   slug=same?r.slug:'';revision=same?r.revision:0;if(!same)published=false;publicationDate=r.payload.pubDate;
   for(const [k,v] of Object.entries(r.payload)){if(k==='featured')field(k).checked=Boolean(v);else if(field(k))field(k).value=Array.isArray(v)?v.join(', '):String(v);}
   chooseCategory(r.payload.category);slugManual=true;field('slug').value=same?r.slug:r.revision?titleSlug(r.payload.title,reserved):reserved.has(r.slug)?titleSlug(r.slug,reserved):r.slug;
   pendingRecovery=null;$('[data-editor-recovery]').hidden=true;blocked=false;publicationStage=published?'queued':'draft';list.value=slug;changed();void deployedState();tell(r.revision&&!same?'Sunucuda daha yeni sürüm var. Kurtarılan metin yeni bir yazı olarak açıldı.':'Yarım kalan değişiklikler geri yüklendi.');
  }catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}
 })();});
 form.addEventListener('input',event=>{if(event.target===field('title'))generateSlug();if(event.target===field('slug'))slugManual=true;if(event.target===newCategory)field('category').value=newCategory.value;changed();});
 form.addEventListener('change',event=>{if(event.target===categorySelect){const fresh=categorySelect.value==='__new__';$('[data-editor-category-wrap]').hidden=!fresh;newCategory.required=fresh;field('category').value=fresh?newCategory.value:categorySelect.value;if(fresh)newCategory.focus();}changed();});
 $('[data-editor-slug-reset]').addEventListener('click',()=>{slugManual=false;generateSlug();changed();});
 editorToolbar(root,changed,()=>{});
 form.addEventListener('submit',event=>{event.preventDefault();void publish('publish');});
 function chooseSavedCategory(value:string){if(![...categorySelect.options].some(o=>o.value===value))categorySelect.add(new Option(value,value),categorySelect.options.length-1);if(field('category').value.trim()===value){field('category').value=value;categorySelect.value=value;newCategory.required=false;$('[data-editor-category-wrap]').hidden=true;}}
 window.addEventListener('online',()=>{retries=0;if(dirty)scheduleAuto();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cache();});
 window.addEventListener('pagehide',cache);
 async function publish(action:'publish'|'unpublish'){
  if(busy||saving||pendingRecovery||signedOut||(action==='unpublish'&&!published))return;
  const p=payload(),id=field('slug').value.trim();
  if(action==='publish'&&(!validContent(p)||!validSlug(id))){if(!p.cover)tell('Önce bu yazı için bir kapak görseli yükle.',true);else if(form.reportValidity())tell('Başlık, açıklama, kategori, etiketler ve adresi kontrol et.',true);return;}
  if(!window.confirm(action==='publish'?'Yazının bu sürümü yayın akışına eklensin mi?':'Yazı yayın akışından çıkarılsın mı? Site güncellemesi biraz sürebilir.'))return;
  busy=true;sync();const epoch=sessionEpoch;
  try{const result=action==='publish'?await client.rpc('cx_editor_publish_now',{p_slug:id,p_expected:revision,p_payload:p}):await client.rpc('cx_editor_write',{p_action:'unpublish',p_slug:slug,p_expected:revision});
   if(result.error)throw result.error;if(epoch!==sessionEpoch)return;
   if(action==='publish'){slug=id;revision=result.data.revision;publicationDate=result.data.pubDate||p.pubDate;reserved.add(id);dirty=false;clearCache();chooseSavedCategory(p.category);saveStatus('Yayın isteği kaydedildi.');}
   published=action==='publish';publishedRevision=published?revision:0;publicationStage=published?'queued':'draft';$('[data-editor-live]').hidden=true;await refreshList();list.reveal(slug);void deployedState();tell(published?'Yayın isteğin alındı. Aktarım tamamlanınca yazın sitede görünecek.':'Yazı yayından kaldırılmak üzere işaretlendi. Site güncellenince sayfası kaldırılacak.');
  }catch(e){if(epoch===sessionEpoch){cache();tell(reason(e as Error),true);}}finally{if(epoch===sessionEpoch){busy=false;state();}}
 }
 $('[data-editor-unpublish]').addEventListener('click',()=>{void publish('unpublish');});
 $('[data-editor-new]').addEventListener('click',()=>{void open('');});
 $('[data-editor-refresh]').addEventListener('click',()=>{void(async()=>{if(busy||saving||signedOut)return;busy=true;sync();try{await refreshList();await deployedState();tell('Yazı listesi ve yayın durumu güncellendi.');}catch(e){tell(reason(e as Error),true);}finally{busy=false;state();}})();});
 publicationTimer=setInterval(()=>{if(!document.hidden&&!signedOut)void deployedState();},30000);
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
 window.addEventListener('beforeunload',event=>{if(dirty){cache();event.preventDefault();event.returnValue='';}});

}
