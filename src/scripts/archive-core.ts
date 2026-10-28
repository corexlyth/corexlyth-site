// Decorative archive core: its canvas never receives pointer events.
const canvas = document.querySelector<HTMLCanvasElement>('[data-archive-core]');
const heading = document.querySelector<HTMLElement>('.cx-vault__header h1');
if (canvas && heading) {
  const ctx = canvas.getContext('2d');
  const frame = canvas.parentElement;
  if (ctx && frame) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const count = innerWidth < 700 ? 1700 : 3200;
    const points = Array.from({ length: count }, (_, i) => {
      const y = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const radius = i % 5 === 0 ? Math.cbrt(Math.random()) : 1;
      const ring = Math.sqrt(1 - y * y) * radius;
      return { x: ring * Math.cos(a), y: y * radius, z: ring * Math.sin(a), size: .7 + Math.random() * 1.1, light: Math.random() };
    });
    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = 100; glyphCanvas.height = 50;
    const glyph = glyphCanvas.getContext('2d');
    const initials: {x:number;y:number;size:number;sx:number;sy:number;sz:number}[] = [];
    if (glyph) {
      glyph.fillStyle = '#fff'; glyph.font = '900 45px sans-serif';
      glyph.textAlign = 'center'; glyph.textBaseline = 'middle'; glyph.fillText('CX',50,25);
      const pixels = glyph.getImageData(0,0,100,50).data;
      for (let y=0; y<50; y+=2) for (let x=0; x<100; x+=2) {
        if (pixels[(y*100+x)*4+3] > 100) {
          const sy = Math.random()*2-1, angle=Math.random()*Math.PI*2, r=Math.sqrt(1-sy*sy);
          initials.push({x:(x-50)/100,y:(y-25)/50,size:1.4+Math.random()*.6,sx:r*Math.cos(angle),sy,sz:r*Math.sin(angle)});
        }
      }
    }
    let width=0,height=0,raf=0,last=0,elapsed=0,visible=true;
    const minGlyphY = Math.min(0, ...initials.map(dot => dot.y));
    function resize() {
      if (!canvas || !ctx) return;
      const bounds=canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio || 1,2);
      width=bounds.width; height=bounds.height;
      canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0); draw();
    }
    function draw() {
      if (!ctx || !canvas || !heading || !frame || !width || !height) return;
      ctx.clearRect(0,0,width,height);
      const bounds=canvas.getBoundingClientRect(), title=heading.getBoundingClientRect();
      const scale=Math.min(width,height)*.34;
      const centerX=(title.left+title.width/2)-bounds.left;
      // The top of the formed letters begins just below the title's lower edge.
      const centerY=title.bottom-bounds.top+5-minGlyphY*scale*.78;
      const phase=elapsed*.00030, c=Math.cos(phase), s=Math.sin(phase);
      for (const p of points) {
        const x=p.x*c-p.z*s, z=p.x*s+p.z*c;
        const perspective=3.5/(3.5+z*.4);
        const alpha=Math.max(.35,Math.min(.9,.67-z*.16+p.light*.14));
        ctx.fillStyle=p.light>.65 ? `rgba(169,135,255,${alpha})` : `rgba(135,234,255,${alpha})`;
        ctx.fillRect(centerX+x*scale*perspective,centerY+p.y*scale*perspective,p.size,p.size);
      }
      const formation=reduced.matches ? 1 : Math.max(0,Math.min(1,(elapsed-1800)/2400));
      const blend=formation*formation*(3-2*formation);
      const inverse=-phase, ic=Math.cos(inverse), is=Math.sin(inverse);
      for (const p of initials) {
        const sx=(p.sx*ic-p.sz*is)*scale*.58, sy=p.sy*scale*.58;
        const tx=p.x*scale*1.55*ic, ty=p.y*scale*.78;
        ctx.fillStyle='rgba(255,43,76,.98)';
        ctx.fillRect(centerX+sx*(1-blend)+tx*blend,centerY+sy*(1-blend)+ty*blend,p.size,p.size);
      }
      frame.classList.add('is-particles-ready');
    }
    function tick(time:number) {
      raf=0;
      if (!visible || document.hidden || reduced.matches) return;
      if (!last || time-last>=33) { elapsed+=last ? Math.min(time-last,80) : 0; last=time; draw(); }
      raf=requestAnimationFrame(tick);
    }
    function update() {
      if (raf) cancelAnimationFrame(raf); raf=0; last=0;
      if (reduced.matches) { draw(); return; }
      if (visible && !document.hidden) raf=requestAnimationFrame(tick);
    }
    const observer=new IntersectionObserver(entries => {visible=entries[0]?.isIntersecting ?? true;update();});
    observer.observe(canvas); addEventListener('resize',resize,{passive:true});
    document.addEventListener('visibilitychange',update); reduced.addEventListener?.('change',update);
    resize(); update();
  }
}
