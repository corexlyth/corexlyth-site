export type ContentPayload = { title:string;description:string;body:string;category:string;tags:string[];cover:string;coverAlt:string;pubDate:string;featured:boolean };
export const validSlug=(s:string)=>s.length<=160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
export function validContent(p:unknown):p is ContentPayload {
 if(!p || typeof p!=='object')return false;
 const v=p as ContentPayload;
 const len=(s:unknown,min:number,max:number)=>typeof s==='string'&&Array.from(s.trim()).length>=min&&Array.from(s.trim()).length<=max;
 return len(v.title,8,200)&&len(v.description,35,220)&&len(v.body,1,100000)&&len(v.category,2,80)&&len(v.coverAlt,5,300)
 &&typeof v.cover==='string'&&/^assets\/img\/[a-zA-Z0-9/_-]+\.(svg|png|jpg|jpeg|webp|avif)$/.test(v.cover)&&!v.cover.includes('..')
 &&Array.isArray(v.tags)&&v.tags.length>=1&&v.tags.length<=20&&v.tags.every(t=>len(t,2,50))
 &&typeof v.featured==='boolean'&&typeof v.pubDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.pubDate)
 &&!Number.isNaN(Date.parse(v.pubDate))&&new Date(v.pubDate).toISOString().slice(0,10)===v.pubDate;
}
