export const MAX_SOURCE_BYTES=15*1024*1024;
export const MAX_IMAGE_BYTES=2*1024*1024;
export async function prepareImage(file:File){
 if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw new Error('image_format');
 if(file.size>MAX_SOURCE_BYTES)throw new Error('image_too_large');
 const image=await createImageBitmap(file,{imageOrientation:'from-image'});
 try{
  if(image.width*image.height>80000000)throw new Error('image_pixels');
  const scale=Math.min(1,1920/Math.max(image.width,image.height));
  const width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('image_canvas');ctx.drawImage(image,0,0,width,height);
  const encode=(quality:number)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('image_encode')),'image/webp',quality));
  let blob=await encode(.84);if(blob.size>MAX_IMAGE_BYTES)blob=await encode(.65);
  if(blob.type!=='image/webp')throw new Error('image_webp_unsupported');
  if(blob.size>MAX_IMAGE_BYTES)throw new Error('image_output_large');
  return {blob,width,height};
 }finally{image.close();}
}
