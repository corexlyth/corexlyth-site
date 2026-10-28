import * as THREE from 'three';

// The city is decorative: a still, lightweight version is used when motion is reduced.
const canvas = document.querySelector<HTMLCanvasElement>('[data-depth-city]');
if (canvas) {
  try {
    const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: false, powerPreference: 'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setClearColor(0x040715, 0);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x071024, 0.023);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 120);
    camera.position.set(0, 3.6, 11);
    camera.lookAt(0, 5, -38);
    const city = new THREE.Group();
    scene.add(city);

    const body = new THREE.MeshBasicMaterial({color: 0x081726});
    const side = new THREE.MeshBasicMaterial({color: 0x0b2638});
    const roof = new THREE.MeshBasicMaterial({color: 0x113a50});
    const cyan = new THREE.MeshBasicMaterial({color: 0x26d8f5});
    const blue = new THREE.MeshBasicMaterial({color: 0x136eae});
    const violet = new THREE.MeshBasicMaterial({color: 0xa44cf2});
    const dim = new THREE.MeshBasicMaterial({color: 0x16445a});
    const materials = [cyan, blue, violet, dim];
    const box = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(1, 1);
    const matrix = new THREE.Matrix4();
    const makeInstances = (geometry: THREE.BufferGeometry, material: THREE.Material, transforms: {x:number;y:number;z:number;w:number;h:number;d:number;rot?:number}[]) => {
      const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
      transforms.forEach((t, i) => {
        matrix.compose(new THREE.Vector3(t.x,t.y,t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),t.rot||0), new THREE.Vector3(t.w,t.h,t.d));
        mesh.setMatrixAt(i,matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      city.add(mesh);
    };
    type Shape = {x:number;y:number;z:number;w:number;h:number;d:number;rot?:number};
    const towers: Shape[] = [], trims: Shape[][] = [[],[],[],[]], tops: Shape[] = [];
    // Deterministic variation keeps the architecture stable between frames.
    const rand = (n:number) => { const v = Math.sin(n*127.1+78.233)*43758.5453; return v-Math.floor(v); };
    for (let row=0; row<17; row++) for (const sign of [-1,1]) for (let lane=0; lane<2; lane++) {
      const id = row*4+lane*2+(sign+1)/2, z = 5-row*5.2-rand(id+3)*2;
      const width = 3.1+rand(id+8)*2.8, depth = 3+rand(id+2)*2.2;
      const x = sign*(4.5+lane*5.1+rand(id+9)*1.3), height = 9+rand(id+7)*18;
      towers.push({x,y:height/2,z,w:width,h:height,d:depth});
      tops.push({x,y:height+.15,z,w:width*.58,h:.3+rand(id+22)*1.3,d:depth*.56});
      // Lit bands and window slits on the street-facing and front façades.
      for (let f=1; f<Math.floor(height/1.15); f++) {
        const y=f*1.15, mat=(f+id)%11===0?2:((f+id)%4===0?0:3);
        trims[mat].push({x:x-sign*(width/2+.012),y,z,w:depth*.85,h:.035,d:1,rot:Math.PI/2});
        if (f%2===0) for (let k=-1;k<=1;k++) trims[(id+f+k+30)%9===0?2:1].push({x:x+k*width*.27,y:y+.32,z:z+depth/2+.014,w:width*.12,h:.36,d:1});
      }
      trims[id%3===0?2:0].push({x:x-sign*(width/2+.018),y:height*.5,z:z+depth*.34,w:.045,h:height*.91,d:1,rot:Math.PI/2});
      trims[0].push({x,y:height+.02,z:z+depth/2+.025,w:width,h:.045,d:1});
    }
    const buildingMaterials = [side,side,roof,body,body,body];
    makeInstances(box, buildingMaterials as unknown as THREE.Material, towers);
    makeInstances(box, roof, tops);
    trims.forEach((list,i)=>makeInstances(plane,materials[i],list));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80,120),new THREE.MeshBasicMaterial({color:0x06111f}));
    ground.rotation.x=-Math.PI/2; ground.position.set(0,-.04,-42); scene.add(ground);
    const groundLines: Shape[][]=[[],[],[]];
    for(let i=-10;i<=10;i++) groundLines[Math.abs(i)%6===0?2:i%3===0?0:1].push({x:i*.75,y:.01,z:-42,w:.025,h:110,d:1,rot:0});
    // Horizontal planes for road traces and softened reflections.
    groundLines.forEach((list,i)=>{
      const mesh=new THREE.InstancedMesh(plane,materials[i],list.length);
      list.forEach((t,j)=>{matrix.compose(new THREE.Vector3(t.x,t.y,t.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)),new THREE.Vector3(t.w,t.h,1));mesh.setMatrixAt(j,matrix);});
      scene.add(mesh);
    });
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0, last=0, elapsed=0, scroll=0, w=0, h=0;
    function resize(){ if(!canvas)return; const r=canvas.getBoundingClientRect(); w=r.width;h=r.height;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<600?55:48;camera.updateProjectionMatrix();render(); }
    function render(){camera.position.x=Math.sin(elapsed*.00012)*.18;camera.position.z=11-Math.min(scroll*.0015,3);camera.lookAt(0,5,-38);renderer.render(scene,camera);}
    function tick(t:number){raf=0;if(document.hidden||reduce.matches)return;elapsed+=last?Math.min(t-last,50):0;last=t;render();raf=requestAnimationFrame(tick);}
    function update(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;render();if(!document.hidden&&!reduce.matches)raf=requestAnimationFrame(tick);}
    addEventListener('resize',resize,{passive:true});addEventListener('scroll',()=>{scroll=window.scrollY;if(reduce.matches)render();},{passive:true});document.addEventListener('visibilitychange',update);reduce.addEventListener('change',update);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(raf)cancelAnimationFrame(raf);canvas.parentElement?.classList.remove('has-depth-city');});
    canvas.addEventListener('webglcontextrestored',()=>{canvas.parentElement?.classList.add('has-depth-city');resize();update();});
    resize();canvas.parentElement?.classList.add('has-depth-city');update();
  } catch (error) {
    console.warn('WebGL city unavailable; using the canvas city.',error);
    import('./depth-city-fallback');
  }
}
