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
   for(const b of [...buildings].sort((a,b)=>depth(b.z)-depth(a.z))){
    const z=depth(b.z), fade=Math.max(0,Math.min(1,(z-3)/2,(31.75-z)/5));
    if(fade<=0)continue;
    const polygon=(coords:[number,number,number][],color:string)=>{ctx.beginPath();coords.forEach(([x,y,d],i)=>{const p=project(x,y,d);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.stroke();};
    const renderBuilding=(mirror:boolean)=>{
     const y=(v:number)=>mirror?.7-v:v, x=b.x, r=x+b.width, back=z+.65, top=-b.height, floor=.35;
     ctx.save();ctx.globalAlpha=fade*(mirror?.19:1);ctx.lineWidth=.7;ctx.strokeStyle='rgba(90,218,247,.36)';
     polygon([[x,y(floor),z],[x,y(top),z],[r,y(top),z],[r,y(floor),z]],'rgba(6,18,32,.82)');
     polygon([[r,y(floor),z],[r,y(top),z],[r,y(top),back],[r,y(floor),back]],'rgba(17,44,63,.85)');
     polygon([[x,y(top),z],[x,y(top),back],[r,y(top),back],[r,y(top),z]],'rgba(25,57,76,.88)');
     const rows=Math.min(16,Math.floor(b.height*4));
     for(let n=1;n<rows;n++){const a=project(x+.1,y(-n*.23),z),d=project(r-.08,y(-n*.23),z);ctx.strokeStyle=n%4?'rgba(75,222,243,.3)':'rgba(190,84,248,.55)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(d.x,d.y);ctx.stroke();}
     ctx.restore();
    };
    renderBuilding(true);renderBuilding(false);
   }
   ctx.lineWidth=1;for(let i=-5;i<=5;i++){const a=project(i*.65,.35,2.3),b=project(i*.65,.35,32);ctx.strokeStyle=i%2?'rgba(74,226,249,.25)':'rgba(177,85,246,.23)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}for(let i=0;i<19;i++){const z=3+(((i*1.6-shift)%30.4)+30.4)%30.4;const a=project(-6,.35,z),b=project(6,.35,z);ctx.strokeStyle='rgba(80,205,235,.12)';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
   canvas.parentElement?.classList.add('has-depth-city');
  }
  function tick(t:number){raf=0;if(document.hidden||reduce.matches)return;time+=last?Math.min(t-last,50):0;last=t;draw();raf=requestAnimationFrame(tick);}
  function update(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;draw();if(!document.hidden&&!reduce.matches)raf=requestAnimationFrame(tick);}
  let pending=false;addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;offset=scrollY*.002;if(reduce.matches)draw();});}},{passive:true});addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',update);reduce.addEventListener?.('change',update);resize();update();
 }
}
