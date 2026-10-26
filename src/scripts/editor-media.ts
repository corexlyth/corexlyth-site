import type { SupabaseClient } from '@supabase/supabase-js';
import { prepareImage } from '../lib/image-processing';
type Media={id:string;asset_path:string;object_name:string;alt:string;width:number;height:number;bytes:number};
export function editorMedia(root:HTMLElement,client:SupabaseClient,callbacks:{busy:(v:boolean)=>void;alive:()=>boolean;cover:(path:string,alt:string)=>void;inline:(path:string,alt:string)=>void}){
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const select=$<HTMLSelectElement>('[data-media-list]'),alt=$<HTMLInputElement>('[data-media-alt]'),file=$<HTMLInputElement>('[data-media-file]');
 const records=new Map<string,Media>();let target:'cover'|'inline'='inline',uploading=false;
 const tell=(s:string,error=false)=>{$('[data-media-status]').textContent=s;$('[data-media-status]').dataset.error=String(error);};
 async function refresh(){const {data,error}=await client.rpc('cx_media',{p_action:'list'});if(error)throw error;if(!callbacks.alive())return;
  select.replaceChildren(new Option('Yüklü görseller',''));for(const m of data as Media[]){records.set(m.asset_path,m);select.add(new Option(`${m.alt} — ${Math.round(m.bytes/1024)} KB`,m.asset_path));}
 }
 function apply(m:Media){const text=alt.value.trim()||m.alt;if(Array.from(text).length<5){tell('Görsele en az 5 karakterlik bir açıklama yaz.',true);return;}
  if(target==='cover')callbacks.cover(m.asset_path,text);else callbacks.inline(m.asset_path,text);
  tell((target==='cover'?'Kapak seçildi. Değişikliği taslak olarak kaydet.':'Görsel yazıya eklendi. Önizleyip taslağı kaydedebilirsin.')+` ${m.width}×${m.height} · ${Math.round(m.bytes/1024)} KB`);
 }
 async function lookup(path:string){if(records.has(path))return records.get(path)!;const {data,error}=await client.rpc('cx_media',{p_action:'get',p_data:{asset:path}});if(error)throw error;if(!callbacks.alive())throw new Error('image_auth');records.set(path,data);return data as Media;}
 async function previewUrl(path:string){
  if(!path.startsWith('assets/img/uploads/'))return `${root.dataset.base}${path}`;
  const m=await lookup(path);const {data,error}=await client.storage.from('cx-editor-media').createSignedUrl(m.object_name,60);if(error)throw error;return data.signedUrl;
 }
 const start=(mode:'cover'|'inline')=>{if(uploading)return;if(Array.from(alt.value.trim()).length<5){tell('Yüklemeden önce görsel açıklamasını yaz.',true);alt.focus();return;}target=mode;file.click();};
 $('[data-media-upload-cover]').addEventListener('click',()=>start('cover'));$('[data-media-upload-inline]').addEventListener('click',()=>start('inline'));
 $('[data-media-use-cover]').addEventListener('click',()=>{target='cover';const m=records.get(select.value);if(m)apply(m);else tell('Önce yüklü bir görsel seç.',true);});
 $('[data-media-use-inline]').addEventListener('click',()=>{target='inline';const m=records.get(select.value);if(m)apply(m);else tell('Önce yüklü bir görsel seç.',true);});
 select.addEventListener('change',()=>{const m=records.get(select.value);if(m)alt.value=m.alt;});
 file.addEventListener('change',()=>{void(async()=>{
  const source=file.files?.[0];if(!source||uploading)return;uploading=true;callbacks.busy(true);let path='',registered=false;
  try{
   tell('Görsel küçültülüyor…');const {blob,width,height}=await prepareImage(source);
   const {data:user,error:userError}=await client.auth.getUser();if(userError||!user.user||!callbacks.alive())throw new Error('image_auth');
   path=`${user.user.id}/${crypto.randomUUID()}.webp`;tell('Görsel özel alana yükleniyor…');
   const upload=await client.storage.from('cx-editor-media').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'3600'});if(upload.error)throw upload.error;
   const {data,error}=await client.rpc('cx_media',{p_action:'register',p_data:{object:path,alt:alt.value.trim(),width,height}});if(error)throw error;registered=true;
   if(!callbacks.alive())return;await refresh();records.set(data.asset_path,data);select.value=data.asset_path;apply(data);
  }catch(e){
   if(path&&!registered)await client.storage.from('cx-editor-media').remove([path]);
   const code=(e as Error).message||'';tell(code==='image_format'?'JPG, PNG, WebP veya AVIF seç. SVG ve GIF kabul edilmiyor.':code==='image_too_large'?'Dosya en fazla 15 MB olabilir.':code==='image_output_large'?'Küçültülen görsel hâlâ çok büyük. Daha küçük bir görsel seç.':code==='image_auth'?'Görsel yüklemek için yetkili hesabınla giriş yap.':'Görsel yüklenemedi. Dosyayı ve bağlantını kontrol edip tekrar dene.',true);
  }finally{file.value='';uploading=false;callbacks.busy(false);}
 })();});
 return {refresh,previewUrl,clear:()=>{records.clear();select.replaceChildren(new Option('Yüklü görseller',''));alt.value='';file.value='';tell('Görsel alanı kapatıldı.');}};
}
