// A lightweight, decorative point cloud. The original orbit remains as a fallback.
const canvas = document.querySelector<HTMLCanvasElement>('[data-particle-core]');
if (canvas) {
  const context = canvas.getContext('2d');
  const frame = canvas.parentElement;
  if (context && frame) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const count = innerWidth < 700 ? 1450 : 2600;
    // A mixture of surface and interior points keeps the cube airy as it turns.
    const points = Array.from({length: count}, (_, index) => {
      const point = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
      if (index % 4 !== 0) point[index % 3] = (index % 2 ? 1 : -1) * (.9 + Math.random() * .1);
      return {x:point[0], y:point[1], z:point[2], size:.45 + Math.random() * .8, light:Math.random()};
    });
    // Keep the initials facing the reader while the surrounding cloud rotates.
    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = 100; glyphCanvas.height = 50;
    const glyph = glyphCanvas.getContext('2d');
    const initials:{x:number;y:number;size:number}[] = [];
    if (glyph) {
      glyph.fillStyle = '#fff'; glyph.font = '900 45px sans-serif';
      glyph.textAlign = 'center'; glyph.textBaseline = 'middle'; glyph.fillText('CX', 50, 25);
      const pixels = glyph.getImageData(0,0,100,50).data;
      for (let y=0;y<50;y+=2) for (let x=0;x<100;x+=2) {
        if (pixels[(y*100+x)*4+3]>100) initials.push({x:(x-50)/100,y:(y-25)/50,size:.8+Math.random()*.5});
      }
    }
    let width = 0, height = 0, visible = true, raf = 0, last = 0, phase = 0;
    function resize() {
      if (!canvas || !context) return;
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      context.setTransform(scale,0,0,scale,0,0);
      draw();
    }
    function draw() {
      if (!context || !canvas || !frame || !width || !height) return;
      context.clearRect(0,0,width,height);
      const yaw = .6 + phase, cy = Math.cos(yaw), sy = Math.sin(yaw), pitch = .46, cp = Math.cos(pitch), sp = Math.sin(pitch);
      const scale = Math.min(width,height) * .25;
      for (const point of points) {
        const x = point.x * cy - point.z * sy, z = point.x * sy + point.z * cy;
        const y = point.y * cp - z * sp, depth = point.y * sp + z * cp;
        const perspective = 3.4 / (3.4 + depth * .45);
        const px = width / 2 + x * scale * perspective, py = height * .47 + y * scale * perspective;
        const alpha = Math.max(.14, Math.min(.8, .4 - depth * .14 + point.light * .22));
        context.fillStyle = point.light > .62 ? `rgba(160,133,255,${alpha})` : `rgba(181,246,255,${alpha})`;
        context.fillRect(px,py,point.size,point.size);
      }
      for (const dot of initials) {
        const px=width/2+dot.x*scale*1.55, py=height*.47+dot.y*scale*.78;
        context.fillStyle='rgba(255,55,83,.95)';context.fillRect(px,py,dot.size,dot.size);
      }
      frame.classList.add('is-particles-ready');
    }
    function tick(time:number) {
      raf = 0;
      if (!visible || document.hidden || reduced.matches) return;
      if (!last || time - last >= 33) {phase += last ? Math.min(time-last,80) * .00026 : 0; last = time; draw();}
      raf = requestAnimationFrame(tick);
    }
    function update() {
      if (raf) cancelAnimationFrame(raf);
      raf=0;last=0;
      if (reduced.matches) {draw();return;}
      if (visible && !document.hidden) raf=requestAnimationFrame(tick);
    }
    const observer = new IntersectionObserver(entries => {visible=entries[0]?.isIntersecting ?? true;update();});
    observer.observe(canvas);
    addEventListener('resize',resize,{passive:true});
    document.addEventListener('visibilitychange',update);
    reduced.addEventListener?.('change',update);
    resize();update();
  }
}
