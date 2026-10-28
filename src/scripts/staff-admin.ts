import { getAuthClient } from '../lib/supabase-client';

type User = {id:string;email:string|null;display_name:string|null;comment_restricted:boolean;comment_restriction_until:string|null};
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
   card.append(title,email,node('p',u.comment_restricted?(u.comment_restriction_until?`Yorum kısıtlı · ${new Date(u.comment_restriction_until).toLocaleString('tr-TR')}`:'Yorum süresiz kısıtlı'):'Yorum kısıtlaması yok'));
   if(u.id!==currentUser){
    const restrictionLabel=node('label','Yorum kısıtlaması'), restriction=node('select');
    restriction.setAttribute('aria-label',`${u.email||'Kullanıcı'} yorum kısıtlaması`);
    for(const [value,name] of [['release','Kısıtlamayı kaldır'],['1440','1 gün'],['10080','7 gün'],['permanent','Süresiz']])restriction.add(new Option(name,value));
    restrictionLabel.append(restriction);const restrictButton=node('button','Yorum kısıtlamasını uygula');restrictButton.type='button';
    restrictButton.addEventListener('click',()=>{void(async()=>{
     if(busy)return;const changeEpoch=epoch;busy=true;restrictButton.disabled=true;tell('İşlem yapılıyor…');
     const release=restriction.value==='release';
     const result=await client.rpc('cx_comment_restriction_set',{p_target:u.id,p_minutes:release||restriction.value==='permanent'?null:Number(restriction.value),p_release:release});
     busy=false;if(changeEpoch!==epoch)return;restrictButton.disabled=false;
     if(result.error){tell('Yorum kısıtlaması değiştirilemedi.');return;}await load();if(changeEpoch+1===epoch)tell('Yorum kısıtlaması güncellendi ve işlem kaydedildi.');
    })();});card.append(restrictionLabel,restrictButton);

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
