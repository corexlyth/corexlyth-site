// Root Pages output is copied, not mirrored. Remove only the known generated aliases
// so a withdrawn article does not leave a stale redirect behind.
import {readFile,rm} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('src/config/blogger-import.json','utf8'));
for(const post of manifest.posts){
 const url=new URL(post.sourceUrl);
 if(url.hostname!=='corexlyth.blogspot.com'||!/^\/20\d{2}\/(0[1-9]|1[0-2])\/[a-z0-9_-]+\.html$/.test(url.pathname))throw new Error('Invalid Blogger alias');
 await rm(url.pathname.slice(1),{force:true});
}
