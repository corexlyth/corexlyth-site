import { getAuthClient } from '../lib/supabase-client';

type Post={slug:string;title:string;revision:number;published:boolean};
const root=document.querySelector<HTMLElement>('[data-staff-posts]');
if(root){
 const client=getAuthClient(),list=root.querySelector<HTMLElement>('[data-staff-posts-list]')!,status=root.querySelector<HTMLElement>('[data-staff-posts-status]')!,refresh=root.querySelector<HTMLButtonElement>('[data-staff-posts-refresh]')!;
 let epoch=0,busy=false;
 async function load(){
  if(!client||busy)return;const current=++epoch;list.replaceChildren();refresh.hidden=true;status.textContent='Yetki kontrol ediliyor…';
  const {data,error}=await client.rpc('cx_staff_posts',{p_action:'list'});if(current!==epoch)return;
  if(error){status.textContent='Yazı yönetimi için moderatör veya admin yetkisi gerekiyor.';return;}
  refresh.hidden=false;status.textContent='En son 100 kayıt gösteriliyor. Silinen yazı yayın akışından kaldırılır; site güncellemesi biraz sürebilir.';
  for(const post of (data.posts||[]) as Post[]){
   const card=document.createElement('article');card.className='cx-staff-user';const title=document.createElement('strong');title.textContent=post.title;const state=document.createElement('p');state.textContent=post.published?'Yayında':'Taslak';const button=document.createElement('button');button.type='button';button.textContent='Yazıyı sil';let armed=false;
   button.addEventListener('click',()=>{void(async()=>{if(busy)return;if(!armed){armed=true;button.textContent='Silmek için tekrar dokun';return;}busy=true;button.disabled=true;const operation=epoch;const {error}=await client.rpc('cx_staff_posts',{p_action:'delete',p_slug:post.slug,p_expected:post.revision});busy=false;if(operation!==epoch)return;if(error){status.textContent='Yazı silinemedi. Listeyi yenileyip tekrar dene.';button.disabled=false;return;}await load();status.textContent='Yazı silindi. Site güncellendiğinde sayfası da kaldırılacak.';})();});
   card.append(title,state,button);list.append(card);
  }
  if(!list.childElementCount)status.textContent='Yönetilecek yazı bulunamadı.';
 }
 refresh.addEventListener('click',()=>void load());
 client?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'){epoch++;list.replaceChildren();refresh.hidden=true;status.textContent='Oturum değişti.';if(event==='SIGNED_IN')setTimeout(()=>void load(),0);}});
 if(client)void load();else status.textContent='Hesap hizmetine bağlanılamadı.';
}
