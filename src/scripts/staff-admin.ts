import { getAuthClient } from '../lib/supabase-client';

type User = {id:string;email:string|null;display_name:string|null;role:'admin'|'moderator'|'author'|null;blocked:boolean};
const root=document.querySelector<HTMLElement>('[data-staff-admin]');
if(root){
 const client=getAuthClient(), status=root.querySelector<HTMLElement>('[data-staff-status]')!, content=root.querySelector<HTMLElement>('[data-staff-content]')!, list=root.querySelector<HTMLElement>('[data-staff-users]')!, refresh=root.querySelector<HTMLButtonElement>('[data-staff-refresh]')!;
 let epoch=0, currentUser='',busy=false;
 const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const clear=()=>{epoch++;currentUser='';content.hidden=true;list.replaceChildren();};
 const tell=(s:string)=>{status.textContent=s;};
 async function load(){
  if(!client||busy)return;
  const run=++epoch;clearList();tell('Yetki kontrol ediliyor…');
  const identity=await client.auth.getUser();if(run!==epoch)return;
  if(identity.error||!identity.data.user){clear();tell('Bu bölüme erişmek için admin hesabınla giriş yap.');return;}
  currentUser=identity.data.user.id;
  const {data,error}=await client.rpc('cx_staff_admin',{p_action:'list'});if(run!==epoch)return;
  if(error){clear();tell('Bu bölüm yalnızca admin yetkisi olan hesaplara açıktır.');return;}
  content.hidden=false;tell('Yetki doğrulandı. En son 100 kullanıcı listeleniyor.');
  for(const u of (data.users||[]) as User[]){
   const card=node('article');card.className='cx-staff-user';
   const title=node('strong',u.display_name||'Anonim'),email=node('p',u.email||'E-posta yok');
   const label=node('label',u.id===currentUser?'Rolün':'Rol');
   const select=node('select');select.setAttribute('aria-label',`${u.email||'Kullanıcı'} rolü`);
   for(const [value,name] of [['','Üye'],['author','Yazar'],['moderator','Moderatör'],['admin','Admin']])select.add(new Option(name,value));
   select.value=u.role||'';select.disabled=u.id===currentUser;label.append(select);
   card.append(title,email,node('p',u.blocked?'Topluluk gönderimleri engelli':'Hesap aktif'),label);
   if(u.id!==currentUser){
    const button=node('button','Rolü kaydet');button.type='button';
    button.addEventListener('click',()=>{void(async()=>{
     if(busy)return;const changeEpoch=epoch;busy=true;button.disabled=true;tell('Rol güncelleniyor…');
     const result=await client.rpc('cx_staff_admin',{p_action:'set_role',p_user:u.id,p_role:select.value||null});
     busy=false;if(changeEpoch!==epoch)return;button.disabled=false;
     if(result.error){tell('Rol güncellenemedi. Kullanıcının e-postası doğrulanmış olmalı.');return;}
     await load();if(changeEpoch+1===epoch)tell('Rol güncellendi ve işlem kaydedildi.');
    })();});card.append(button);
   }
   list.append(card);
  }
  if(!list.childElementCount)list.append(node('p','Kullanıcı bulunamadı.'));
 }
 function clearList(){content.hidden=true;list.replaceChildren();}
 refresh.addEventListener('click',()=>{void load();});
 client?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'){clear();tell('Oturum değişti.');if(event==='SIGNED_IN')setTimeout(()=>void load(),0);}});
 if(client)void load();else tell('Hesap hizmetine bağlanılamadı.');
}
