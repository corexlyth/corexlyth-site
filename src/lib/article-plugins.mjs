import {defaultSchema} from 'rehype-sanitize';
const labels={NOTE:'Not',INFO:'Bilgi',TIP:'İpucu',WARNING:'Uyarı',IMPORTANT:'Önemli',DETAILS:'Ayrıntılar',GALLERY:'Görsel galerisi'};
export function literalHtml(){return tree=>{const visit=node=>{if(node.type==='html')node.type='text';for(const child of node.children||[])visit(child);};visit(tree);};}
const paragraph=text=>({type:'paragraph',children:[{type:'text',value:text}]});
function figure(image,gallery=false){return {type:'paragraph',data:{hName:'figure',hProperties:{className:[gallery?'cx-gallery__item':'cx-figure']}},children:[image,...(image.alt?[{...paragraph(image.alt),data:{hName:'figcaption'}}]:[])]};}
function onlyImages(children){const images=[];for(const child of children){if(child.type!=='paragraph')return null;for(const token of child.children){if(token.type==='image')images.push(token);else if(token.type!=='text'||token.value.trim())return null;}}return images;}
export function articleBlocks(){return tree=>{
 function visit(node){
  if(node.type==='blockquote'){
   const first=node.children?.[0]?.children?.[0];const match=first?.type==='text'&&first.value.match(/^\[!(NOTE|INFO|TIP|WARNING|IMPORTANT|DETAILS|GALLERY)\](?:[ \t]+([^\n]*))?(?:\r?\n|$)/i);
   if(match){
    const type=match[1].toUpperCase();const title=match[2]?.trim()||labels[type];
    // Gallery markers with mixed content remain ordinary quotes, so no author text is lost.
    const cloned=structuredClone(node.children);cloned[0].children[0].value=first.value.slice(match[0].length);
    if(!cloned[0].children[0].value)cloned[0].children.shift();if(!cloned[0].children.length)cloned.shift();
    const images=type==='GALLERY'?onlyImages(cloned):null;
    if(type!=='GALLERY'||(images&&images.length>=2)){
     node.children=cloned;
     if(type==='GALLERY'){node.data={hName:'div',hProperties:{className:['cx-gallery'],role:'group',ariaLabel:title}};node.children=images.map(img=>figure(img,true));return;}
     const label=paragraph(title);label.data={hName:type==='DETAILS'?'summary':'p',hProperties:{className:['cx-callout__title']}};
     node.data={hName:type==='DETAILS'?'details':'aside',hProperties:{className:['cx-callout',`cx-callout--${type.toLowerCase()}`],...(type==='DETAILS'?{}:{role:'note'})}};
     node.children.unshift(label);
    }
   }
  }
  for(let i=0;i<(node.children||[]).length;i++){
   const child=node.children[i];
   if(child.type==='paragraph'&&!child.data&&child.children?.length===1&&child.children[0].type==='image')node.children[i]=figure(child.children[0]);
   else visit(child);
  }
 }
 visit(tree);
};}
export function articleHast(){return tree=>{function visit(node){for(let i=0;i<(node.children||[]).length;i++){const child=node.children[i];if(child.type==='element'&&child.tagName==='table'){node.children[i]={type:'element',tagName:'div',properties:{className:['cx-table-scroll'],tabIndex:0,role:'region',ariaLabel:'Kaydırılabilir tablo'},children:[child]};}else visit(child);}}visit(tree);};}
export const articleSchema={...defaultSchema,clobberPrefix:'',tagNames:[...new Set([...(defaultSchema.tagNames||[]),'aside','figure','figcaption','details','summary'])],attributes:{...defaultSchema.attributes,'*':[...(defaultSchema.attributes?.['*']||[]),['className',/^cx-(?:callout(?:--(?:note|info|tip|warning|important|details)|__title)?|gallery(?:__item)?|figure|table-scroll)$/],['role','note','group','region'],'ariaLabel',['tabIndex',0]]}};
