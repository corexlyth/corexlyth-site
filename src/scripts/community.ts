import { getAuthClient } from '../lib/supabase-client';

type Comment = { id:string; post:string; parent:string|null; name:string; body:string; status:string; createdAt:string; own:boolean };
type State = { comments:Comment[]; moderator:boolean; blocked:boolean; signedIn:boolean; displayName:string|null; likes:number; liked:boolean; saved:boolean; bookmarks?:{slug:string;title:string}[] };
for (const root of document.querySelectorAll<HTMLElement>('[data-community]')) void start(root);

async function start(root:HTMLElement) {
  const client = getAuthClient();
  const find = <T extends HTMLElement = HTMLElement>(selector:string) => root.querySelector<T>(selector)!;
  const status = find('[data-community-status]');
  const mode = root.dataset.community!;
  const base = root.dataset.base!;
  const post = root.dataset.post || null;
  const profile = find<HTMLFormElement>('[data-profile-form]');
  const commentForm = find<HTMLFormElement>('[data-comment-form]');
  const list = find('[data-comment-list]');
  const more = find<HTMLButtonElement>('[data-more]');
  const like = find<HTMLButtonElement>('[data-like]');
  const bookmark = find<HTMLButtonElement>('[data-bookmark]');
  let state:State|undefined, busy=false, cursor='0', replying:string|null=null, request=0;
  const tell = (text:string, error=false) => { status.textContent=text; status.dataset.error=String(error); };
  const node = <K extends keyof HTMLElementTagNameMap>(tag:K,text?:string) => { const el=document.createElement(tag); if(text) el.textContent=text; return el; };
  const errorText = (error:{message?:string;code?:string;status?:number}) => {
    const msg = error?.message || '';
    if(msg.includes('rate_limited') || error?.status===429) return 'Gönderim sınırına ulaştın. Biraz bekleyip tekrar dene.';
    if(msg.includes('member_blocked')) return 'Bu hesabın topluluk gönderimleri kısıtlandı.';
    if(msg.includes('comment_restricted')) return 'Bu hesabın yorum yapması kısıtlandı.';
    if(msg.includes('moderator_required')) return 'Bu bölüm için moderatör yetkisi gerekiyor.';
    if(msg.includes('login_required')) return 'İşlem için doğrulanmış hesabınla giriş yap.';
    if(msg.includes('invalid_parent')) return 'Bu yoruma artık yanıt verilemiyor. Listeyi yenile.';
    return 'İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene.';
  };
  const enabled = () => Boolean(state?.signedIn && !state.blocked && !busy);
  function sync() {
    if(mode==='account') root.hidden=!state?.signedIn;
    root.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled=busy; });
    if(profile) { profile.hidden=!state?.signedIn; profile.querySelector('fieldset')!.disabled=!enabled(); }
    if(commentForm) { commentForm.hidden=!state?.signedIn; commentForm.querySelector('fieldset')!.disabled=!enabled(); }
    if(like) like.disabled=!enabled();
    if(bookmark) bookmark.disabled=!enabled();
    root.querySelectorAll<HTMLButtonElement>('[data-member-action]').forEach(button=>button.disabled=!enabled());
    find('[data-community-login]').hidden=Boolean(state?.signedIn);
    const moderationLink=find('[data-moderation-link]');
    if(moderationLink) moderationLink.hidden=!state?.moderator;
  }
  function resetReply() {
    replying=null;
    if(commentForm) { find('[data-reply-status]').textContent='Yeni yorum'; find('[data-cancel-reply]').hidden=true; }
  }
  async function write(action:string,params:Record<string,unknown>={}) {
    if(busy || !client) return false;
    busy=true; sync(); tell('İşlem yapılıyor…');
    try {
      const {error}=await client.rpc('cx_community_write',{p_action:action,p_post:post,...params});
      if(error) throw error;
      return true;
    } catch(error) { tell(errorText(error as {message?:string}),true); return false; }
    finally { busy=false; sync(); }
  }
  function actionButton(text:string,action:()=>void) {
    const button=node('button',text); button.type='button'; button.dataset.memberAction=''; button.addEventListener('click',action); return button;
  }
  function renderComment(c:Comment) {
    const article=node('article'); article.className='cx-comment'; article.dataset.commentId=c.id;
    const head=node('p'); head.className='cx-comment__meta';
    const author=node('strong',c.name || 'Anonim'); const date=node('time',new Date(c.createdAt).toLocaleString('tr-TR'));date.dateTime=c.createdAt;
    head.append(author,document.createTextNode(' · '),date);
    const labels:Record<string,string>={pending:'İnceleme bekliyor',hidden:'İnceleme bekliyor'};
    article.append(head);
    if(mode==='moderation') { const link=node('a','Yazıyı aç');link.href=`${base}yazi/${encodeURIComponent(c.post)}/`;article.append(link); }
    if(c.parent) article.append(node('p',`↳ #${c.parent} numaralı yoruma yanıt`));
    const body=node('p',c.status==='deleted'?'Yorum silindi.':c.body);body.className='cx-comment__body'; article.append(body);
    if(labels[c.status]) article.append(node('p',labels[c.status]));
    const actions=node('div');actions.className='cx-comment__actions';
    if(mode==='article' && !c.parent && c.status==='published' && state?.signedIn) actions.append(actionButton('Yanıtla',()=>{
      replying=c.id;find('[data-reply-status]').textContent=`${c.name} adlı üyeye yanıt (#${c.id})`;
      find('[data-cancel-reply]').hidden=false;find<HTMLTextAreaElement>('textarea').focus();
    }));
    if((c.own || (mode==='moderation' && state?.moderator)) && c.status!=='deleted') {
      let confirmDelete=false;
      const remove=actionButton('Sil',()=>{
        if(!confirmDelete) { confirmDelete=true;remove.textContent='Silmek için tekrar dokun'; return; }
        void (async()=>{if(await write('delete',{p_comment:c.id})) { await load();tell('Yorumun silindi.'); }})();
      });actions.append(remove);
    }
    if(mode==='moderation' && state?.moderator && c.status!=='deleted') {
      for(const [label,action] of [...(c.status!=='published' ? [['Yayınla','publish']] : []),...(!c.own ? [['Üyeyi engelle','block'],['Engeli kaldır','unblock']] : [])]) {
        actions.append(actionButton(label,()=>{void(async()=>{if(await write(action,{p_comment:c.id})){await load();tell('Moderasyon işlemi kaydedildi.');}})();}));
      }
      if(!c.own){
        const label=node('label','Yorum kısıtlaması');
        const select=node('select');select.setAttribute('aria-label',`${c.name} için yorum kısıtlaması`);
        for(const [value,name] of [['1440','1 gün'],['10080','7 gün'],['permanent','Süresiz'],['release','Kısıtlamayı kaldır']])select.add(new Option(name,value));
        label.append(select);actions.append(label);
        actions.append(actionButton('Uygula',()=>{void(async()=>{
          if(busy||!client)return;busy=true;sync();tell('İşlem yapılıyor…');
          try{const release=select.value==='release';const {error}=await client.rpc('cx_comment_restriction_from_comment',{p_comment:c.id,p_minutes:release||select.value==='permanent'?null:Number(select.value),p_release:release});if(error)throw error;tell('Yorum kısıtlaması güncellendi.');}
          catch{tell('Kısıtlama güncellenemedi. Bu hesap için yetkini kontrol et.',true);}
          finally{busy=false;sync();}
        })();}));
      }
    }
    article.append(actions);return article;
  }
  async function load(append=false) {
    if(!client) return;
    const current=++request;
    if(!append) cursor='0';
    const {data,error}=await client.rpc('cx_community_read',{p_post:post,p_after:cursor,p_queue:mode==='moderation'});
    if(current!==request) return;
    if(error) { tell(errorText(error),true);if(!state) sync();return; }
    state=data as State;
    if(!append && list) list.replaceChildren();
    if(list) {
      const page=state.comments.slice(0,50);
      for(const c of page) list.append(renderComment(c));
      if(page.length) cursor=page.at(-1)!.id;
      more.hidden=state.comments.length<=50;
      if(!list.childElementCount) list.append(node('p',mode==='moderation'?'İncelenecek yorum yok.':'Henüz yorum yok. İlk yorumu sen yazabilirsin.'));
    }
    if(like) { find('[data-like-count]').textContent=String(state.likes);like.setAttribute('aria-pressed',String(state.liked)); }
    if(bookmark) {bookmark.textContent=state.saved?'Kaydedildi ✓':'Yazıyı kaydet';bookmark.setAttribute('aria-pressed',String(state.saved));}
    if(profile && document.activeElement!==profile.elements.namedItem('displayName')) (profile.elements.namedItem('displayName') as HTMLInputElement).value=state.displayName || '';
    if(mode==='account') {
      const saved=find('[data-saved-list]');saved.replaceChildren();
      for(const p of state.bookmarks || []) {const li=node('li');const link=node('a',p.title);link.href=`${base}yazi/${encodeURIComponent(p.slug)}/`;li.append(link);saved.append(li);}
      if(!saved.childElementCount) saved.append(node('li',state.signedIn?'Henüz bir yazı kaydetmedin.':'Kaydettiğin yazıları görmek için giriş yap.'));
    }
    const editorLink=find('[data-editor-link]');
    if(editorLink){editorLink.hidden=true;const authorPanel=find<HTMLDetailsElement>('[data-author-comments]');if(authorPanel)authorPanel.hidden=true;if(state.signedIn){const capability=await client.rpc('cx_editor_read');if(current!==request)return;editorLink.hidden=Boolean(capability.error);if(authorPanel)authorPanel.hidden=Boolean(capability.error);}}
    const adminLink=find('[data-admin-link]');
    if(adminLink){adminLink.hidden=true;if(state.signedIn){const capability=await client.rpc('cx_staff_admin',{p_action:'list'});if(current!==request)return;adminLink.hidden=Boolean(capability.error);}}
    sync();
    tell(state.blocked?'Hesabının topluluk gönderimleri kısıtlandı.':mode==='moderation'?'Yorumları inceleyebilir, yayımlayabilir veya silebilirsin.':'Topluluk güncel.');
  }
  if(!client) return;
  const authorPanel=find<HTMLDetailsElement>('[data-author-comments]');
  authorPanel?.addEventListener('toggle',()=>{if(!authorPanel.open||!state?.signedIn)return;void(async()=>{
    const current=request, message=find('[data-author-comments-status]'),out=find('[data-author-comments-list]');
    message.textContent='Yükleniyor…';out.replaceChildren();
    const {data,error}=await client.rpc('cx_author_comments');if(current!==request||!state?.signedIn)return;
    if(error){message.textContent='Yorumlar yüklenemedi. Bölümü kapatıp tekrar açmayı dene.';return;}
    message.textContent='';
    for(const c of data.comments||[]){const item=node('article');item.className='cx-comment';const link=node('a',c.title) as HTMLAnchorElement;link.href=`${base}yazi/${encodeURIComponent(c.slug)}/#yorumlar`;item.append(link,node('p',`${c.name} · ${new Date(c.created_at).toLocaleString('tr-TR')}`),node('p',c.body));out.append(item);}
    if(!out.childElementCount)out.append(node('p','Yazılarına gelen yayımlanmış yorum yok.'));
  })();});
  // These panels contain only the current member's private history.
  type PersonalItem={id:string;name?:string;usedUntil?:string;post?:string;postTitle?:string;active?:boolean;body?:string;status?:string;createdAt?:string};
  const cursors:Record<string,string|null>={names:null,comments:null};
  const loaded:Record<string,boolean>={names:false,comments:false};
  let personalEpoch=0;
  async function loadPersonal(kind:'names'|'comments',append=false){
    if(!client || !state?.signedIn)return;
    const epoch=personalEpoch;
    const out=find(`[data-personal-${kind}-list]`),message=find(`[data-personal-${kind}-status]`),button=find<HTMLButtonElement>(`[data-personal-${kind}-more]`);
    message.textContent='Yükleniyor…';button.disabled=true;
    const {data,error}=await client.rpc('cx_personal_profile',{p_kind:kind,p_before:append?cursors[kind]:null});
    if(epoch!==personalEpoch||!state?.signedIn)return;
    button.disabled=false;
    if(error){message.textContent='Bilgiler yüklenemedi. Bölümü kapatıp tekrar açarak yeniden deneyebilirsin.';return;}
    if(!append)out.replaceChildren();
    for(const entry of (data.items||[]) as PersonalItem[]){
      const li=node('li');
      if(kind==='names')li.textContent=`${entry.name} · ${new Date(entry.usedUntil!).toLocaleDateString('tr-TR')}`;
      else{
        const heading=entry.active?node('a',entry.postTitle):node('span',entry.postTitle);
        if(heading instanceof HTMLAnchorElement)heading.href=`${base}yazi/${encodeURIComponent(entry.post!)}/`;
        const text=node('p',entry.status==='deleted'?'Yorum silindi.':entry.body);
        const labels:Record<string,string>={pending:'İncelemede',published:'Yayında',hidden:'İncelemede',deleted:'Silindi'};
        li.append(heading,text,node('small',`${labels[entry.status||'']||''} · ${new Date(entry.createdAt!).toLocaleDateString('tr-TR')}`));
      }
      out.append(li);
    }
    loaded[kind]=true;cursors[kind]=data.next;button.hidden=!data.next;
    message.textContent=out.childElementCount?'':kind==='names'?'Henüz önceki takma adın yok.':'Henüz yorum yapmadın.';
  }
  if(mode==='account')for(const kind of ['names','comments'] as const){
    find<HTMLDetailsElement>(`[data-personal-${kind}]`)?.addEventListener('toggle',event=>{if((event.currentTarget as HTMLDetailsElement).open&&!loaded[kind])void loadPersonal(kind);});
    find<HTMLButtonElement>(`[data-personal-${kind}-more]`)?.addEventListener('click',()=>void loadPersonal(kind,true));
  }
  profile?.addEventListener('submit',event=>{event.preventDefault();void(async()=>{
    if(!profile.reportValidity()) return;
    if(await write('profile',{p_body:String(new FormData(profile).get('displayName') || '').trim()})){loaded.names=false;await load();if(find<HTMLDetailsElement>('[data-personal-names]')?.open)void loadPersonal('names');tell(state?.displayName?'Görünen adın kaydedildi.':'Takma adın kaldırıldı. Yorumlarında Anonim görüneceksin.');}
  })();});
  commentForm?.addEventListener('submit',event=>{event.preventDefault();void(async()=>{
    if(!commentForm.reportValidity()) return;
    if(await write('comment',{p_body:String(new FormData(commentForm).get('comment') || '').trim(),p_comment:replying})){
      commentForm.reset();resetReply();await load();tell('Yorumun incelemeye alındı. Onaylandıktan sonra burada görünecek.');
    }
  })();});
  find('[data-cancel-reply]')?.addEventListener('click',resetReply);
  like?.addEventListener('click',()=>{void(async()=>{if(await write('like',{p_value:!state?.liked})){await load();tell(state?.liked?'Yazıyı beğendin.':'Beğeni kaldırıldı.');}})();});
  bookmark?.addEventListener('click',()=>{void(async()=>{if(await write('bookmark',{p_value:!state?.saved})){await load();tell(state?.saved?'Yazı kaydettiklerine eklendi.':'Yazı kaydettiklerinden çıkarıldı.');}})();});
  more?.addEventListener('click',()=>{void load(true);});
  find('[data-community-refresh]').addEventListener('click',()=>{void load();});
  client.auth.onAuthStateChange(event=>{
    if(event==='SIGNED_OUT' || event==='SIGNED_IN') {
      request++;personalEpoch++;state=undefined;list?.replaceChildren();find('[data-saved-list]')?.replaceChildren();
      find('[data-author-comments-list]')?.replaceChildren();if(authorPanel)authorPanel.open=false;
      for(const kind of ['names','comments'] as const){loaded[kind]=false;cursors[kind]=null;find(`[data-personal-${kind}-list]`)?.replaceChildren();const panel=find<HTMLDetailsElement>(`[data-personal-${kind}]`);if(panel)panel.open=false;}
      profile?.reset();commentForm?.reset();resetReply();sync();
    }
    // Auth callback stays synchronous; RPCs start after the auth lock is released.
    if(event!=='INITIAL_SESSION') window.setTimeout(()=>{void load();},0);
  });
  try { await client.auth.getSession(); await load(); }
  catch { tell('Topluluk hizmetine ulaşılamadı. Yenile düğmesiyle tekrar dene.',true); }
}
