// Perspective-projected city: independent of external libraries or network access.
const canvas=document.querySelector<HTMLCanvasElement>('[data-depth-city]');
if(canvas){
 const ctx=canvas.getContext('2d',{alpha:true});
 if(ctx){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let w=0,h=0,raf=0,last=0,time=0,offset=0;
  const buildings=Array.from({length:100},(_,i)=>{const side=i%2?1:-1;return {x:side*(1.8+(i%5)*.75),z:3+(i%25)*1.15,height:1.8+((i*17)%31)/11,width:.45+(i%3)*.15};});
  function resize(){if(!canvas||!ctx)return;const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.5);w=r.width;h=r.height;canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);draw();}
  function draw(){if(!ctx||!canvas||!w||!h)return;ctx.clearRect(0,0,w,h);const focal=Math.min(w*.8,h*1.15),center=w/2,horizon=h*.43;
   const project=(x:number,y:number,z:number)=>({x:center+x*focal/z,y:horizon+y*focal/z});
   const glow=ctx.createRadialGradient(center,horizon,0,center,horizon,Math.max(w,h)*.65);glow.addColorStop(0,'rgba(33,122,175,.28)');glow.addColorStop(.42,'rgba(52,31,106,.14)');glow.addColorStop(1,'rgba(3,7,17,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
   const shift=reduce.matches?0:offset+time*.0002;
   const depth=(z:number)=>3+(((z-3-shift)%28.75)+28.75)%28.75;
   for(const b of [...buildings].sort((a,b)=>depth(b.z)-depth(a.z))){const z=depth(b.z),near=project(b.x,.35,z),top=project(b.x,-b.height,z),right=project(b.x+b.width,.35,z),rt=project(b.x+b.width,-b.height,z),back=project(b.x+b.width,-b.height,z+.45),base=project(b.x+b.width,.35,z+.45);if(near.x<-200||near.x>w+200)continue;
    ctx.fillStyle='rgba(5,15,28,.78)';ctx.strokeStyle='rgba(73,205,236,.24)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(near.x,near.y);ctx.lineTo(top.x,top.y);ctx.lineTo(rt.x,rt.y);ctx.lineTo(right.x,right.y);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='rgba(11,31,48,.8)';ctx.beginPath();ctx.moveTo(right.x,right.y);ctx.lineTo(rt.x,rt.y);ctx.lineTo(back.x,back.y);ctx.lineTo(base.x,base.y);ctx.closePath();ctx.fill();ctx.stroke();
    const reflectedLeft=project(b.x,.35+b.height*.65,z),reflectedRight=project(b.x+b.width,.35+b.height*.65,z);
    const reflection=ctx.createLinearGradient(0,Math.min(near.y,right.y),0,Math.max(reflectedLeft.y,reflectedRight.y)+1);reflection.addColorStop(0,"rgba(48,156,186,.12)");reflection.addColorStop(1,"rgba(42,86,152,0)");ctx.fillStyle=reflection;ctx.beginPath();ctx.moveTo(near.x,near.y);ctx.lineTo(right.x,right.y);ctx.lineTo(reflectedRight.x,reflectedRight.y);ctx.lineTo(reflectedLeft.x,reflectedLeft.y);ctx.closePath();ctx.fill();
    const rows=Math.min(13,Math.floor(b.height*4));for(let n=1;n<rows;n++){const a=project(b.x+.1,-n*.23,z),d=project(b.x+b.width*.8,-n*.23,z);ctx.strokeStyle=n%4?'rgba(75,222,243,.23)':'rgba(190,84,248,.5)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(d.x,d.y);ctx.stroke();}
   }
   ctx.lineWidth=1;for(let i=-5;i<=5;i++){const a=project(i*.65,.35,2.3),b=project(i*.65,.35,32);ctx.strokeStyle=i%2?'rgba(74,226,249,.25)':'rgba(177,85,246,.23)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}for(let i=0;i<19;i++){const z=3+(((i*1.6-shift)%30.4)+30.4)%30.4;const a=project(-6,.35,z),b=project(6,.35,z);ctx.strokeStyle='rgba(80,205,235,.12)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
   canvas.parentElement?.classList.add('has-depth-city');
  }
  function tick(t:number){raf=0;if(document.hidden||reduce.matches)return;if(!last||t-last>=16){time+=last?Math.min(t-last,50):0;last=t;draw();}raf=requestAnimationFrame(tick);}
  function update(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;draw();if(!document.hidden&&!reduce.matches)raf=requestAnimationFrame(tick);}
  let pending=false;addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;offset=scrollY*.002;if(reduce.matches)draw();});}},{passive:true});addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',update);reduce.addEventListener?.('change',update);resize();update();
 }
}
