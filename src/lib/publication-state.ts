export type PublishedVersion={slug:string;revision:number;active:boolean};
export type EditorEntry={slug:string;title:string;category?:string;description?:string;revision:number;published:boolean;published_revision?:number;updated_at?:string};
export function publicationState(post:EditorEntry,live?:PublishedVersion,verified=false){
 if(!post.published)return live?.active?{key:'withdrawing',label:'Yayından kaldırılıyor'}:{key:'draft',label:'Taslak'};
 if(!live?.active)return {key:'queued',label:'Siteye aktarım bekliyor'};
 if(live.revision!==(post.published_revision??post.revision))return {key:'updating',label:'Güncelleme aktarılıyor'};
 return verified?{key:'live',label:'Yayında'}:{key:'ready',label:'Siteye aktarıldı'};
}
export function pageMatchesPublication(html:string,slug:string,revision:number){
 const marker=html.match(/<meta\s+name="cx-publication"\s+content="([^"]+)"\s*\/?\s*>/);
 return marker?.[1]===`${slug}:${revision}`;
}
