import {validSlug,type ContentPayload} from './content-rules.ts';
export function titleSlug(title:string,reserved:Iterable<string>=[]){
 const base=title.toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,150).replace(/-+$/,'');
 if(!base)return '';const taken=new Set(reserved);let slug=base,index=2;while(taken.has(slug))slug=`${base}-${index++}`;return slug;
}
export type Recovery={version:1;owner:string;slug:string;revision:number;published:boolean;payload:ContentPayload;at:number};
export const recoveryKey=(owner:string)=>`cx-editor-recovery:v1:${owner}`;
export function readRecovery(raw:string|null,owner:string,now=Date.now()):Recovery|null{
 try{const v=JSON.parse(raw||'null');if(!v||v.version!==1||v.owner!==owner||!Number.isInteger(v.revision)||v.revision<0||typeof v.published!=='boolean'||(typeof v.slug!=='string'||v.slug.length>160||(v.revision>0&&!validSlug(v.slug)))||!Number.isFinite(v.at)||v.at>now+60000||now-v.at>3*86400000)return null;
 const p=v.payload;if(!p||!['title','description','body','category','cover','coverAlt','pubDate'].every(k=>typeof p[k]==='string')||p.title.length>200||p.description.length>220||p.body.length>100000||p.category.length>80||p.coverAlt.length>300||p.cover.length>300||(!/^\d{4}-\d{2}-\d{2}$/.test(p.pubDate)||Number.isNaN(Date.parse(p.pubDate))||new Date(p.pubDate).toISOString().slice(0,10)!==p.pubDate)||typeof p.featured!=='boolean'||!Array.isArray(p.tags)||p.tags.length>1200||!p.tags.every((t:unknown)=>typeof t==='string'&&t.length<=1200)||p.tags.join(',').length>1200)return null;
 if(p.cover&&!/^assets\/img\/[a-zA-Z0-9/_-]+\.(svg|png|jpg|jpeg|webp|avif)$/.test(p.cover))return null;
 return v;
 }catch{return null;}
}
