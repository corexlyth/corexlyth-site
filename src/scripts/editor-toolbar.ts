export function editorToolbar(root:HTMLElement,change:()=>void,preview:()=>void){
 const body=root.querySelector<HTMLTextAreaElement>('[name=body]')!;
 const replace=(text:string,selectStart?:number,selectEnd?:number)=>{const start=body.selectionStart;body.setRangeText(text,start,body.selectionEnd,'end');body.focus();if(selectStart!==undefined)body.setSelectionRange(start+selectStart,start+(selectEnd??text.length));change();preview();};
 root.querySelectorAll<HTMLButtonElement>('[data-write-block]').forEach(button=>button.addEventListener('click',()=>{
  const kind=button.dataset.writeBlock!;const selected=body.value.slice(body.selectionStart,body.selectionEnd);
  const wrap=(prefix:string,suffix:string,fallback:string)=>{const value=selected||fallback;replace(prefix+value+suffix,prefix.length,prefix.length+value.length);};
  if(kind==='bold')return wrap('**','**','Kalın metin');
  if(kind==='italic')return wrap('*','*','Vurgulu metin');
  if(kind==='inline-code')return wrap('`','`','kod');
  if(kind==='link'){const value=selected||'Bağlantı metni';return replace(`[${value}](https://ornek.com)`,value.length+3,value.length+3+'https://ornek.com'.length);}
  const pad='\n\n';
  if(kind==='h2'||kind==='h3'||kind==='h4'){const prefix='#'.repeat(Number(kind.slice(1)))+' ';const value=selected||'Başlığını yaz';return replace(pad+prefix+value+pad,pad.length+prefix.length,pad.length+prefix.length+value.length);}
  if(['list','ordered','check'].includes(kind)){const lines=(selected||'Birinci madde\nİkinci madde').split('\n');const text=lines.map((line,i)=>(kind==='ordered'?`${i+1}. `:kind==='check'?'- [ ] ':'- ')+line).join('\n');return replace(pad+text+pad);}
  if(kind==='quote')return replace(pad+(selected||'Alıntı metnini yaz.').split('\n').map(s=>'> '+s).join('\n')+pad);
  if(kind==='code')return replace(pad+'```text\n'+(selected||'Kodunu buraya yaz')+'\n```'+pad);
  if(kind==='table')return replace(pad+'| Başlık 1 | Başlık 2 |\n| --- | --- |\n| Değer 1 | Değer 2 |\n| Değer 3 | Değer 4 |'+pad);
  if(kind==='divider')return replace(pad+'---'+pad);
  const markers:Record<string,string>={note:'NOTE',info:'INFO',warning:'WARNING',tip:'TIP',important:'IMPORTANT',details:'DETAILS'};
  if(markers[kind]){const text=selected||'Metnini buraya yaz.';return replace(pad+`> [!${markers[kind]}]\n`+text.split('\n').map(line=>'> '+line).join('\n')+pad);}
 }));
}
