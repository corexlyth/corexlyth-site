import { getAuthClient } from '../lib/supabase-client';

const panel=document.querySelector<HTMLDetailsElement>('[data-author-assign]');
if(panel){
 const client=getAuthClient(), status=panel.querySelector<HTMLElement>('[data-author-assign-status]')!, list=panel.querySelector<HTMLElement>('[data-author-assign-list]')!;
 let epoch=0,busy=false;
 async function load(){
  if(!client||busy)return;const current=++epoch;list.replaceChildren();status.textContent='Yükleniyor…';
  const {data,error}=await client.rpc('cx_author_assignment',{p_action:'list'});if(current!==epoch)return;
  if(error){status.textContent='Yazılar yüklenemedi veya admin yetkin bulunmuyor.';return;}
  status.textContent='En fazla 100 yazı ve 100 yetkili hesap gösterilir.';
  for(const p of data.posts||[]){
   const card=document.createElement('article');card.className='cx-staff-user';const title=document.createElement('strong');title.textContent=p.title;const label=document.createElement('label');label.textContent='Yazar';const select=document.createElement('select');select.add(new Option('Hesap seç',''));
   for(const a of data.authors||[])select.add(new Option(`${a.email} · ${a.role}`,a.id));label.append(select);
   const button=document.createElement('button');button.type='button';button.textContent='Yazarı ata';
   button.addEventListener('click',()=>{void(async()=>{if(busy||!select.value){status.textContent='Önce bir hesap seç.';return;}busy=true;button.disabled=true;const version=epoch;const {error}=await client.rpc('cx_author_assignment',{p_action:'assign',p_slug:p.slug,p_author:select.value});busy=false;if(version!==epoch)return;button.disabled=false;if(error){status.textContent='Atama yapılamadı. Listeyi yenileyip tekrar dene.';return;}await load();status.textContent='Yazar atandı ve işlem kaydedildi.';})();});card.append(title,label,button);list.append(card);
  }
  if(!list.childElementCount)status.textContent='Sahibi belirlenmemiş yazı yok.';
 }
 panel.addEventListener('toggle',()=>{if(panel.open)void load();});
 client?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'){epoch++;list.replaceChildren();panel.open=false;status.textContent='';}});
}
