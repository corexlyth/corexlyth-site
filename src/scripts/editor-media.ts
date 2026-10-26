import type {SupabaseClient} from '@supabase/supabase-js';import {prepareImage} from '../lib/image-processing';
type Media={id:string;asset_path:string;object_name:string;alt:string;width:number;height:number;bytes:number};
type Entry={media?:Media;file?:File;input:HTMLInputElement;url?:string};
export function editorMedia(root:HTMLElement,client:SupabaseClient,callbacks:{busy:(v:boolean)=>void;alive:()=>boolean;cover:(path:string,alt:string)=>void;inline:(images:{path:string;alt:string}[],gallery:boolean)=>void}){
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const alt=$<HTMLInputElement>('[data-media-alt]'),file=$<HTMLInputElement>('[data-media-file]');
 const dialog=$<HTMLDialogElement>('[data-inline-media-dialog]'),inlineFile=$<HTMLInputElement>('[data-inline-media-file]'),existing=$<HTMLSelectElement>('[data-inline-media-list]'),queue=$('[data-inline-media-queue]');
 const records=new Map<string,Media>();let uploading=false,gallery=false,lastRegistered=0,entries:Entry[]=[];
 const tell=(s:string,error=false,inline=false)=>{const el=$(inline?'[data-inline-media-status]':'[data-media-status]');el.textContent=s;el.dataset.error=String(error);};
 function cleanQueue(){for(const e of entries)if(e.url)URL.revokeObjectURL(e.url);entries=[];queue.replaceChildren();}
 function renderEntry(item:{file?:File;media?:Media}){
  const row=document.createElement('div');row.className='cx-image-queue-row';
  const label=document.createElement('label');label.textContent=item.file?.name||item.media!.alt;
  const input=document.createElement('input');input.minLength=5;input.maxLength=300;input.required=true;input.placeholder='Bu görseli kısaca açıkla';input.value=item.media?.alt||'';
  input.addEventListener('input',()=>input.setCustomValidity(''));label.append(input);const entry:Entry={...item,input};
  if(item.file&&['image/jpeg','image/png','image/webp','image/avif'].includes(item.file.type)){entry.url=URL.createObjectURL(item.file);const img=document.createElement('img');img.src=entry.url;img.alt='Seçilen görsel';row.append(img);}
  row.append(label);entries.push(entry);queue.append(row);
 }
 async function refresh(){const {data,error}=await client.rpc('cx_media',{p_action:'list'});if(error)throw error;if(!callbacks.alive())return;
  existing.replaceChildren();
  for(const m of data as Media[]){records.set(m.asset_path,m);const label=`${m.alt} — ${Math.round(m.bytes/1024)} KB`;existing.add(new Option(label,m.asset_path));}
 }
 async function lookup(path:string){if(records.has(path))return records.get(path)!;const {data,error}=await client.rpc('cx_media',{p_action:'get',p_data:{asset:path}});if(error)throw error;if(!callbacks.alive())throw new Error('image_auth');records.set(path,data);return data as Media;}
 async function previewUrl(path:string){if(!path.startsWith('assets/img/uploads/'))return `${root.dataset.base}${path}`;const m=await lookup(path);const {data,error}=await client.storage.from('cx-editor-media').createSignedUrl(m.object_name,60);if(error)throw error;return data.signedUrl;}
 const errorText=(e:unknown)=>{const code=(e as Error).message||'';return code==='image_format'?'JPG, PNG, WebP veya AVIF seç. SVG ve GIF kabul edilmiyor.':code==='image_too_large'?'Dosya en fazla 15 MB olabilir.':code==='image_output_large'?'Küçültülen görsel hâlâ çok büyük. Daha küçük bir görsel seç.':code==='image_auth'?'Görsel yüklemek için yetkili hesabınla giriş yap.':'Görsel yüklenemedi. Dosyayı ve bağlantını kontrol edip tekrar dene.';};
 async function upload(source:File,text:string){let path='',registered=false;
  try{const {blob,width,height}=await prepareImage(source);const {data:user,error:userError}=await client.auth.getUser();if(userError||!user.user||!callbacks.alive())throw new Error('image_auth');
   path=`${user.user.id}/${crypto.randomUUID()}.webp`;const result=await client.storage.from('cx-editor-media').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'3600'});if(result.error)throw result.error;
   const wait=Math.max(0,1050-(Date.now()-lastRegistered));if(wait)await new Promise(r=>setTimeout(r,wait));
   if(!callbacks.alive())throw new Error('image_auth');
   const {data,error}=await client.rpc('cx_media',{p_action:'register',p_data:{object:path,alt:text,width,height}});if(error)throw error;registered=true;lastRegistered=Date.now();records.set(data.asset_path,data);return data as Media;
  }catch(e){if(path&&!registered)await client.storage.from('cx-editor-media').remove([path]);throw e;}
 }
 function setBusy(value:boolean){uploading=value;callbacks.busy(value);dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=value);existing.disabled=value;inlineFile.disabled=value;}
 $('[data-media-upload-cover]').addEventListener('click',()=>{if(uploading)return;if(Array.from(alt.value.trim()).length<5){tell('Yüklemeden önce kapak açıklamasını yaz.',true);alt.focus();return;}file.click();});
 file.addEventListener('change',()=>{void(async()=>{const source=file.files?.[0];if(!source||uploading)return;setBusy(true);try{tell('Kapak hazırlanıp özel alana yükleniyor…');const m=await upload(source,alt.value.trim());if(!callbacks.alive())return;await refresh();callbacks.cover(m.asset_path,m.alt);tell(`Kapak seçildi. ${m.width}×${m.height} · ${Math.round(m.bytes/1024)} KB. Taslağı kaydet.`);}catch(e){tell(errorText(e),true);}finally{file.value='';setBusy(false);}})();});
 function open(g:boolean){if(uploading)return;gallery=g;cleanQueue();existing.multiple=g;existing.size=g?4:1;existing.selectedIndex=-1;inlineFile.multiple=g;inlineFile.value='';$('[data-inline-media-title]').textContent=g?'Galeri ekle':'Yazıya görsel ekle';tell(g?'En az iki, en fazla 10 görsel seç. Her görsele bir açıklama yaz.':'Bir görsel seç ve açıklamasını yaz.',false,true);dialog.showModal();}
 $('[data-media-open-inline]').addEventListener('click',()=>open(false));$('[data-media-open-gallery]').addEventListener('click',()=>open(true));
 $('[data-inline-media-choose]').addEventListener('click',()=>inlineFile.click());
 inlineFile.addEventListener('change',()=>{cleanQueue();const files=[...(inlineFile.files||[])];if(files.length>10){tell('Bir defada en fazla 10 görsel seçebilirsin.',true,true);return;}for(const f of files)renderEntry({file:f});});
 $('[data-inline-media-existing]').addEventListener('click',()=>{cleanQueue();const items=[...existing.selectedOptions];if(items.length>10){tell('Bir defada en fazla 10 görsel seçebilirsin.',true,true);return;}for(const option of items){const media=records.get(option.value);if(media)renderEntry({media});}});
 $('[data-inline-media-close]').addEventListener('click',()=>{dialog.close();cleanQueue();});dialog.addEventListener('cancel',event=>{if(uploading)event.preventDefault();else cleanQueue();});
 $('[data-inline-media-insert]').addEventListener('click',()=>{void(async()=>{
  if(uploading)return;if(entries.length<(gallery?2:1)){tell(gallery?'Galeri için en az iki görsel seç.':'Bir görsel seç.',true,true);return;}
  for(const e of entries){e.input.setCustomValidity(Array.from(e.input.value.trim()).length<5?'Görsel için en az 5 karakterlik bir açıklama yaz.':'');if(!e.input.reportValidity())return;}
  setBusy(true);try{const images=[];for(let i=0;i<entries.length;i++){const e=entries[i];tell(`${i+1}/${entries.length} görsel hazırlanıyor…`,false,true);if(!e.media){e.media=await upload(e.file!,e.input.value.trim());e.file=undefined;}images.push({path:e.media.asset_path,alt:e.input.value.trim()});if(!callbacks.alive())return;}
   await refresh();callbacks.inline(images,gallery);dialog.close();root.querySelector<HTMLTextAreaElement>('[name=body]')?.focus();cleanQueue();tell('Görseller yazı alanına eklendi. Taslağı kaydet.');
  }catch(e){tell(errorText(e)+' Hazırlanmış görselleri yeniden yüklemeden tekrar deneyebilirsin.',true,true);}finally{setBusy(false);}
 })();});
 return {refresh,previewUrl,clear:()=>{records.clear();existing.replaceChildren();alt.value='';file.value='';inlineFile.value='';cleanQueue();if(dialog.open)dialog.close();tell('Görsel alanı kapatıldı.');}};
}
