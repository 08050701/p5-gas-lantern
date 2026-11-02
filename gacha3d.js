// 3D 扭蛋機：舊式紅色鐵殼機台。投幣、轉把手、扭蛋翻滾、掉出來、打開。
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const GLOBE_CENTER = new THREE.Vector3(0,4.2,0);
const GLOBE_R = 1.46;
const CAP_R = .32;
const CAP_COUNT = 36;
const COLORS = ["#a8281f","#2f5d50","#d6a62e","#2c5f8a","#c4602a"];
const CHUTE = new THREE.Vector3(0,.66,.8);
const TRAY = new THREE.Vector3(0,.52,1.5);
const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
const ease = t => t*t*(3-2*t);
const smoother = t => t*t*t*(t*(t*6-15)+10);
const span = (t,a,b) => clamp((t-a)/(b-a));

function textPlane(w,h,draw,opts={}){
  const px = 220;
  const c = document.createElement("canvas"); c.width = w*px; c.height = h*px;
  draw(c.getContext("2d"),c.width,c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({map:tex,roughness:.55,metalness:0,transparent:!!opts.transparent});
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
}

// 用了幾十年的烤漆：褪色、刮痕、掉漆露出底下的鐵和鏽
function wornPaint(base,fade,seed=1){
  const size=1024, c=document.createElement("canvas"), rough=document.createElement("canvas");
  c.width=c.height=rough.width=rough.height=size;
  const g=c.getContext("2d"), r=rough.getContext("2d");
  let s=seed*9301; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  g.fillStyle=base; g.fillRect(0,0,size,size);
  r.fillStyle="#9a9a9a"; r.fillRect(0,0,size,size);
  const blot=(x,y,radius,color)=>{ const b=g.createRadialGradient(x,y,0,x,y,radius); b.addColorStop(0,color); b.addColorStop(1,color.replace(/[\d.]+\)$/,"0)")); g.fillStyle=b; g.fillRect(x-radius,y-radius,radius*2,radius*2); };
  for(let i=0;i<70;i++) blot(rnd()*size,rnd()*size,40+rnd()*170,`${fade}${.05+rnd()*.12})`);
  for(let i=0;i<40;i++) blot(rnd()*size,rnd()*size,30+rnd()*120,`rgba(30,16,8,${.05+rnd()*.14})`);
  // 手摸最多、東西碰最多的地方在下緣和邊角，鏽往下流
  for(let i=0;i<46;i++){
    const x=rnd()*size, y=rnd()<.55?size*(.72+rnd()*.28):rnd()*size;
    const w=4+rnd()*rnd()*34, h=3+rnd()*18;
    g.fillStyle=rnd()<.5?"#6b3d1e":"#41301f"; r.fillStyle="#ececec";
    g.beginPath(); r.beginPath();
    for(let k=0;k<7;k++){ const a=k/7*6.28, q=.6+rnd()*.7; g.lineTo(x+Math.cos(a)*w*q,y+Math.sin(a)*h*q); r.lineTo(x+Math.cos(a)*w*q,y+Math.sin(a)*h*q); }
    g.fill(); r.fill();
    if(rnd()<.45){ g.strokeStyle=`rgba(96,50,22,${.12+rnd()*.2})`; g.lineWidth=1+rnd()*3; g.beginPath(); g.moveTo(x,y); g.lineTo(x+rnd()*5-2,y+24+rnd()*100); g.stroke(); }
  }
  for(let i=0;i<190;i++){
    const x=rnd()*size, y=rnd()*size, a=rnd()*6.28, l=8+rnd()*rnd()*120;
    g.strokeStyle=`rgba(232,214,180,${.05+rnd()*.17})`; r.strokeStyle="#d8d8d8";
    g.lineWidth=r.lineWidth=.6+rnd();
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke();
    r.beginPath(); r.moveTo(x,y); r.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); r.stroke();
  }
  const tex=(canvas,srgb)=>{ const t=new THREE.CanvasTexture(canvas); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; if(srgb) t.colorSpace=THREE.SRGBColorSpace; return t; };
  return {map:tex(c,true),roughnessMap:tex(rough,false)};
}

// 掉漆、鏽斑貼在機身上：舊鐵殼的味道都在這層
function agedDecal(w,h){
  return textPlane(w,h,(c,W,H)=>{
    c.clearRect(0,0,W,H);
    for(let i=0;i<34;i++){
      const x=Math.random()*W, edge=Math.random()<.65, y=edge?H*(.72+Math.random()*.28):Math.random()*H, r=4+Math.random()*(edge?38:15);
      c.fillStyle = Math.random()<.6 ? `rgba(92,52,24,${.35+Math.random()*.45})` : `rgba(112,92,70,${.5+Math.random()*.4})`;
      c.beginPath();
      for(let a=0;a<6.3;a+=.7){ const q=r*(.6+Math.random()*.7); c.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q*.7); }
      c.closePath(); c.fill();
    }
    for(let i=0;i<70;i++){ c.strokeStyle=`rgba(40,14,8,${Math.random()*.16})`; c.lineWidth=1; const x=Math.random()*W,y=Math.random()*H; c.beginPath(); c.moveTo(x,y); c.lineTo(x+Math.random()*60-30,y+Math.random()*12); c.stroke(); }
  },{transparent:true});
}

class Machine {
  constructor(wrap){
    this.wrap = wrap;
    this.renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .86;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "machine3d";
    wrap.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(this.renderer),.03).texture;
    this.camera = new THREE.PerspectiveCamera(27,1,.1,100);
    this.homeCam = new THREE.Vector3(0,3.2,16.4);
    this.homeLook = new THREE.Vector3(0,2.9,0);
    this.look = this.homeLook.clone();
    this.camera.position.copy(this.homeCam);

    const key = new THREE.DirectionalLight(0xffe6c0,2.1);
    key.position.set(-5,9,8); key.castShadow = true;
    key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-6,right:6,top:8,bottom:-3,near:1,far:30});
    key.shadow.radius = 6;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd4d0,.5); fill.position.set(6,3,5); this.scene.add(fill);

    this.rig = new THREE.Group(); this.scene.add(this.rig);
    this.buildMachine();
    this.buildCapsules();
    this.flash = new THREE.PointLight(0xffe2a0,0,8); this.rig.add(this.flash);

    this.yaw = -.2; this.yawTarget = -.2; this.stir = 0; this.settle = 0;
    this.timeline = null; this.clock = new THREE.Clock(); this.idle = 0;
    this.bindPointer();
    new ResizeObserver(()=>this.resize()).observe(wrap);
    this.resize();
    this.restoreCoin();
    for(let i=0;i<260;i++) this.physics(1/60); // 開場前先讓扭蛋沉到底
    this.settle = 0;
    this.renderer.setAnimationLoop(()=>this.frame());
  }

  buildMachine(){
    const m = this.rig;
    const enamel = new THREE.MeshStandardMaterial({...wornPaint("#6f2017","rgba(120,74,50,",1),roughness:.92,metalness:.05});
    const chrome = new THREE.MeshStandardMaterial({...wornPaint("#a39a84","rgba(70,52,34,",2),metalness:.82,roughness:.85});
    const dark = new THREE.MeshStandardMaterial({color:0x17100b,roughness:.9});
    const wood = new THREE.MeshStandardMaterial({...wornPaint("#5e3a1d","rgba(150,104,62,",3),roughness:.95});
    const add = (geo,mat,x=0,y=0,z=0,parent=m) => { const o=new THREE.Mesh(geo,mat); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; parent.add(o); return o; };

    // 柑仔店木櫃台
    const counter = add(new RoundedBoxGeometry(5,.32,3.5,4,.05),wood,0,-.16,.45);
    counter.castShadow = false;
    [[-1.1,-.9],[1.1,-.9],[-1.1,.9],[1.1,.9]].forEach(([x,z])=>add(new THREE.CylinderGeometry(.13,.16,.14,20),chrome,x,.07,z));

    add(new RoundedBoxGeometry(2.7,2.56,2.3,6,.14),enamel,0,1.42,0);
    const skirt = add(new RoundedBoxGeometry(2.86,.16,2.46,4,.06),chrome,0,.2,0);
    skirt.castShadow = false;
    add(new THREE.CylinderGeometry(1.36,1.42,.16,48),chrome,0,2.76,0);
    add(new THREE.CylinderGeometry(1.08,1.3,.22,48),enamel,0,2.92,0);
    add(new THREE.TorusGeometry(1.02,.06,16,60).rotateX(Math.PI/2),chrome,0,3.05,0);

    const aged = agedDecal(2.6,2.45); aged.position.set(0,1.42,1.153); aged.castShadow=false; m.add(aged);

    const sign = textPlane(2.14,.56,(c,W,H)=>{
      c.fillStyle="#f1e3c6"; c.fillRect(0,0,W,H);
      c.strokeStyle="#3a2a1c"; c.lineWidth=8; c.strokeRect(9,9,W-18,H-18);
      c.fillStyle="#a8281f"; c.font="700 88px 'Noto Serif TC', serif"; c.textAlign="center"; c.textBaseline="middle";
      c.fillText("轉 來 坐",W/2,H/2+5);
    });
    sign.position.set(0,2.28,1.158); m.add(sign);
    const price = textPlane(.34,1.08,(c,W,H)=>{
      c.fillStyle="#f1e3c6"; c.font="700 58px 'Noto Serif TC', serif"; c.textAlign="center"; c.textBaseline="middle";
      [..."每次壹圓"].forEach((ch,i)=>c.fillText(ch,W/2,H*(.14+i*.24)));
    },{transparent:true});
    price.position.set(-1.05,1.45,1.158); m.add(price);

    // 投幣孔
    add(new RoundedBoxGeometry(.4,.62,.06,3,.02),chrome,1.05,1.45,1.17);
    add(new THREE.BoxGeometry(.05,.34,.02),dark,1.05,1.45,1.2);
    const gold = new THREE.MeshStandardMaterial({color:0xc9a24c,metalness:1,roughness:.35});
    const face = textPlane(.4,.4,(c,W,H)=>{
      c.fillStyle="#c9a24c"; c.fillRect(0,0,W,H);
      c.strokeStyle="#7e5f1e"; c.lineWidth=7; c.beginPath(); c.arc(W/2,H/2,W*.42,0,7); c.stroke();
      c.fillStyle="#6d5019"; c.font=`700 ${W*.56}px 'Noto Serif TC', serif`; c.textAlign="center"; c.textBaseline="middle";
      c.translate(W/2,H/2); c.rotate(Math.PI/2); c.fillText("壹",0,4);
    }).material;
    face.metalness=.75;
    this.coin = add(new THREE.CylinderGeometry(.2,.2,.04,40).rotateZ(Math.PI/2),[gold,face,face],1.8,.5,1.5);
    this.slotRing = add(new THREE.TorusGeometry(.46,.055,10,48),new THREE.MeshBasicMaterial({color:0xffd86a,transparent:true,depthWrite:false}),1.05,1.45,1.22);
    this.slotRing.scale.set(.62,.9,1); this.slotRing.castShadow=false;
    this.crankRing = add(new THREE.TorusGeometry(.6,.05,10,56),this.slotRing.material,0,1.45,1.24);
    this.crankRing.castShadow=false;
    // 看不見的感應區：手指比零件粗，範圍放大一點
    const hitMat = new THREE.MeshBasicMaterial({visible:false});
    const hit = (geo,x,y,z,part) => { const o=new THREE.Mesh(geo,hitMat); o.position.set(x,y,z); o.userData.part=part; m.add(o); return o; };
    this.hits = [hit(new THREE.BoxGeometry(.78,1.1,.3),1.05,1.45,1.25,"slot"),hit(new THREE.SphereGeometry(.5,12,10),1.8,.5,1.5,"slot"),hit(new THREE.CylinderGeometry(.66,.66,.6,24).rotateX(Math.PI/2),0,1.45,1.3,"crank")];

    // 轉把手
    this.crank = new THREE.Group(); this.crank.position.set(0,1.45,1.16); m.add(this.crank);
    const plate = add(new THREE.CylinderGeometry(.5,.53,.08,56).rotateX(Math.PI/2),chrome,0,1.45,1.17);
    plate.castShadow = false;
    add(new THREE.CylinderGeometry(.4,.4,.1,48).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0xb9b2a0,metalness:.9,roughness:.42}),0,0,.08,this.crank);
    add(new RoundedBoxGeometry(.24,.88,.22,4,.08),chrome,0,0,.22,this.crank);
    add(new THREE.SphereGeometry(.14,24,16),chrome,0,0,.36,this.crank);

    // 出口與接球盤
    add(new THREE.BoxGeometry(1.1,.62,.04),dark,0,.6,1.15);
    const flap = add(new RoundedBoxGeometry(1.14,.1,.07,3,.02),chrome,0,.92,1.18); flap.castShadow=false;
    add(new RoundedBoxGeometry(1.24,.07,.86,3,.03),chrome,0,.36,1.56);
    add(new RoundedBoxGeometry(.07,.28,.86,3,.03),chrome,-.61,.47,1.56);
    add(new RoundedBoxGeometry(.07,.28,.86,3,.03),chrome,.61,.47,1.56);
    add(new RoundedBoxGeometry(1.24,.26,.07,3,.03),chrome,0,.46,1.98);

    // 玻璃球與鐵蓋
    const glass = new THREE.MeshPhysicalMaterial({color:0xf0e2c4,transparent:true,opacity:.24,roughness:.2,metalness:0,clearcoat:.5,clearcoatRoughness:.3,envMapIntensity:1.1,depthWrite:false,side:THREE.FrontSide});
    const globe = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R,64,48),glass);
    globe.position.copy(GLOBE_CENTER); globe.renderOrder = 5; m.add(globe);
    // 玻璃的反光與厚度感
    const back = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R+.01,48,32),new THREE.MeshBasicMaterial({color:0xd8e4dc,transparent:true,opacity:.1,side:THREE.BackSide,depthWrite:false}));
    back.position.copy(GLOBE_CENTER); m.add(back);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R+.015,32,24,3.7,.5,.75,.85),new THREE.MeshBasicMaterial({color:0xfff0d0,transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    shine.position.copy(GLOBE_CENTER); shine.renderOrder=6; m.add(shine);
    add(new THREE.CylinderGeometry(.74,.94,.14,56),enamel,0,5.36,0);
    add(new THREE.TorusGeometry(.94,.055,16,60).rotateX(Math.PI/2),chrome,0,5.3,0);
    add(new THREE.SphereGeometry(.74,48,20,0,Math.PI*2,0,Math.PI/2).scale(1,.5,1),enamel,0,5.43,0);
    add(new THREE.CylinderGeometry(.11,.17,.14,24),chrome,0,5.85,0);
    add(new THREE.SphereGeometry(.14,24,18),chrome,0,5.97,0);
  }

  makeCapsule(color){
    const g = new THREE.Group();
    const top = new THREE.MeshPhysicalMaterial({color,roughness:.5,clearcoat:.25,clearcoatRoughness:.5});
    const bottom = new THREE.MeshPhysicalMaterial({color:0xe6d8bb,roughness:.5,clearcoat:.2});
    const half = new THREE.SphereGeometry(CAP_R,28,14,0,Math.PI*2,0,Math.PI/2);
    const a = new THREE.Mesh(half,top); const b = new THREE.Mesh(half,bottom); b.rotation.x = Math.PI;
    a.castShadow = b.castShadow = true;
    g.add(a,b); g.userData = {a,b};
    return g;
  }

  buildCapsules(){
    this.caps = [];
    for(let i=0;i<CAP_COUNT;i++){
      const mesh = this.makeCapsule(COLORS[i%COLORS.length]);
      mesh.quaternion.setFromEuler(new THREE.Euler(Math.random()*6,Math.random()*6,Math.random()*6));
      const a=Math.random()*6.3, r=Math.random()*.8;
      const p = new THREE.Vector3(Math.cos(a)*r,-.6+i*.13,Math.sin(a)*r).add(GLOBE_CENTER);
      this.rig.add(mesh);
      this.caps.push({mesh,p,prev:p.clone(),live:true});
    }
  }

  // 球殼內的簡易物理：重力、互撞、貼著玻璃；轉把手時底下的攪拌片把球捲起來
  physics(dt){
    const live = this.caps.filter(c=>c.live);
    const gravity = -14*dt*dt;
    const v = new THREE.Vector3(), d = new THREE.Vector3();
    live.forEach(c=>{
      v.copy(c.p).sub(c.prev).multiplyScalar(.985);
      c.prev.copy(c.p);
      if(this.stir>0){
        const rx=c.p.x, rz=c.p.z, h=c.p.y-GLOBE_CENTER.y;
        v.x += -rz*this.stir*.0034*(1+Math.random()); v.z += rx*this.stir*.0034*(1+Math.random());
        if(h<-.35) v.y += .0075*this.stir*(.5+Math.random());
      }
      c.p.add(v); c.p.y += gravity;
    });
    const limit = GLOBE_R-CAP_R-.03;
    for(let it=0;it<4;it++){
      for(let i=0;i<live.length;i++){
        for(let j=i+1;j<live.length;j++){
          d.copy(live[j].p).sub(live[i].p);
          const dist=d.length(), min=CAP_R*2;
          if(dist>0 && dist<min){ d.multiplyScalar(.5*(min-dist)/dist); live[i].p.sub(d); live[j].p.add(d); }
        }
      }
      live.forEach(c=>{
        d.copy(c.p).sub(GLOBE_CENTER);
        const dist=d.length();
        if(dist>limit) c.p.copy(GLOBE_CENTER).addScaledVector(d,limit/dist);
      });
    }
    const axis = new THREE.Vector3(), q = new THREE.Quaternion(), step = new THREE.Vector3();
    live.forEach(c=>{
      c.mesh.position.copy(c.p);
      step.copy(c.p).sub(c.prev); step.y*=.3;
      const len=step.length();
      if(len>1e-4){ axis.set(step.z,0,-step.x).normalize(); q.setFromAxisAngle(axis,len/CAP_R); c.mesh.quaternion.premultiply(q); }
    });
  }

  bindPointer(){
    const el = this.renderer.domElement;
    let down=null, startYaw=0, moved=false;
    el.addEventListener("pointerdown",e=>{ down=e.clientX; startYaw=this.yawTarget; moved=false; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove",e=>{
      if(down===null) return;
      const dx=e.clientX-down;
      if(Math.abs(dx)>6) moved=true;
      this.yawTarget = clamp(startYaw+dx*.008,-.75,.75);
    });
    el.addEventListener("pointerup",e=>{ if(down!==null && !moved) this.pressAt(e); down=null; });
    el.addEventListener("pointercancel",()=>{ down=null; });
  }

  // 要按對地方：先投幣孔、再把手。按到機台別處就讓該按的地方閃一下
  pressAt(e){
    if(this.timeline||this.coinFlight) return;
    const box=this.renderer.domElement.getBoundingClientRect();
    const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-box.left)/box.width*2-1,1-(e.clientY-box.top)/box.height*2),this.camera);
    const part=ray.intersectObjects(this.hits,false)[0]?.object.userData.part;
    if(part===(this.coined?"crank":"slot")) document.getElementById("spinBtn").click();
    else if(part||ray.intersectObject(this.rig,true).length) this.nudge=1;
  }

  insertCoin(){
    if(this.coined) return Promise.resolve();
    return new Promise(resolve=>{ this.coinFlight={t:0,resolve}; });
  }

  flyCoin(dt){
    const F=this.coinFlight; F.t+=dt;
    const k=smoother(span(F.t,0,.75)), near=span(F.t,.75,.95);
    this.coin.position.set(THREE.MathUtils.lerp(1.8,1.05,k),THREE.MathUtils.lerp(.5,1.45,k)+Math.sin(k*Math.PI)*.35,THREE.MathUtils.lerp(1.5,1.32,k)-near*.3);
    this.coin.rotation.y=(1-k)*Math.PI/2;
    this.coin.scale.setScalar(1+(1-k)*.7);
    if(F.t>=.95){
      window.RetroSfx?.coin();
      this.coin.visible=false; this.coined=true; this.coinFlight=null; F.resolve();
    }
  }

  restoreCoin(){
    this.coined=false; this.coin.visible=true;
    this.coin.position.set(1.8,.5,1.5); this.coin.rotation.set(0,Math.PI/2,0); this.coin.scale.setScalar(1.7);
  }

  homePose(){
    return this.homeCam.clone().sub(this.homeLook).multiplyScalar(this.fit||1).add(this.homeLook);
  }

  resize(){
    const w=this.wrap.clientWidth, h=this.wrap.clientHeight;
    if(!w||!h) return;
    this.renderer.setSize(w,h);
    this.camera.aspect = w/h;
    // 窄畫面把鏡頭拉遠，機台才不會被切掉
    this.fit = Math.max(1,.66/this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  spin(title){
    return new Promise(resolve=>{
      const picked = this.caps.filter(c=>c.live).sort((a,b)=>(a.p.y+a.p.x*a.p.x*.2+a.p.z*a.p.z*.2)-(b.p.y+b.p.x*b.p.x*.2+b.p.z*b.p.z*.2))[0];
      this.note = this.makeNote(title); this.note.visible=false; this.rig.add(this.note);
      this.timeline = {t:.5,picked,resolve,stage:{},from:null};
      this.yawTarget = 0;
      // 鏡頭走一條連續的曲線：轉把手時就開始慢慢靠近，中途不停、不急轉
      const home=this.homePose(), near=new THREE.Vector3(0,1.55,7.4);
      this.camPath=new THREE.CatmullRomCurve3([home,home.clone().lerp(near,.3).add(new THREE.Vector3(-1.1,.1,0)),home.clone().lerp(near,.68).add(new THREE.Vector3(.7,-.5,0)),near]);
      this.lookPath=new THREE.CatmullRomCurve3([this.homeLook.clone(),new THREE.Vector3(0,2.5,.3),new THREE.Vector3(0,1.5,1.2),new THREE.Vector3(0,1.46,2.5)]);
    });
  }

  makeNote(title){
    const chars = [...title];
    const note = textPlane(.5,1.5,(c,W,H)=>{
      c.fillStyle="#f6ecd6"; c.fillRect(0,0,W,H);
      c.strokeStyle="#a8281f"; c.lineWidth=6; c.strokeRect(10,10,W-20,H-20);
      // 字多就縮小，七個字也放得下
      const gap=Math.min(84,(H-44)/chars.length), size=Math.min(76,gap*.92);
      c.fillStyle="#3a2a1c"; c.font=`700 ${size}px 'Noto Serif TC', serif`; c.textAlign="center"; c.textBaseline="middle";
      chars.forEach((ch,i)=>c.fillText(ch,W/2,H/2+(i-(chars.length-1)/2)*gap));
    });
    note.material.side = THREE.DoubleSide;
    return note;
  }

  once(key,fn){ const s=this.timeline.stage; if(!s[key]){ s[key]=true; fn(); } }

  // 劇本（投幣在按下投幣孔時就做完了）：.5 轉把手 → 2.5 掉進出口 → 3.1 滾到接球盤 → 4 拿起來 → 5.1 打開 → 6.7 結束
  runTimeline(dt){
    const T=this.timeline; T.t+=dt; const t=T.t, cap=T.picked;
    if(t>=.5 && t<2.6){
      const k=span(t,.5,2.5);
      const angle=ease(k)*Math.PI*4;
      const clicks=Math.floor(angle/(Math.PI/3));
      if(clicks!==T.clicks){ T.clicks=clicks; window.RetroSfx?.tick(); }
      this.crank.rotation.z=-angle;
      this.stir=Math.sin(k*Math.PI)*2.2;
      this.rig.position.x=Math.sin(t*38)*.012*Math.sin(k*Math.PI);
    }else{ this.stir=0; this.rig.position.x=0; }
    if(t>=2.5 && t<3.1){
      this.once("fall",()=>{ cap.live=false; T.from=cap.mesh.position.clone(); window.RetroSfx?.clunk(); });
      const hole=new THREE.Vector3(0,2.9,0);
      cap.mesh.position.lerpVectors(T.from,hole,ease(span(t,2.5,2.95)));
      if(t>2.95) cap.mesh.visible=false;
    }
    if(t>=3.1 && t<3.95){
      this.once("roll",()=>{ cap.mesh.visible=true; window.RetroSfx?.roll(); });
      const k=span(t,3.1,3.75);
      cap.mesh.position.lerpVectors(CHUTE,TRAY,k*k);
      cap.mesh.position.y += Math.abs(Math.sin(k*Math.PI*3))*(1-k)*.16;
      cap.mesh.rotation.x += dt*9*(1-k);
    }
    if(t>=4){
      const k=smoother(span(t,4,5.05));
      const to=new THREE.Vector3(0,1.46,2.5);
      cap.mesh.position.lerpVectors(TRAY,to,k);
      cap.mesh.position.y+=Math.sin(k*Math.PI)*.18;
      cap.mesh.quaternion.slerp(new THREE.Quaternion(),.1);
    }
    if(t>=5.1){
      this.once("pop",()=>window.RetroSfx?.pop());
      const k=smoother(span(t,5.1,5.7));
      cap.mesh.userData.a.position.y=k*.46; cap.mesh.userData.a.rotation.x=-k*.4;
      cap.mesh.userData.b.position.y=-k*.46; cap.mesh.userData.b.rotation.x=Math.PI+k*.4;
      this.flash.position.set(0,1.46,2.9); this.flash.intensity=Math.sin(span(t,5.1,6.6)*Math.PI)*34;
      this.note.visible=true;
      this.note.position.set(0,1.46,2.55);
      this.note.scale.setScalar(.12+k*.5);
      this.note.rotation.set(0,0,0);
    }
    if(t>=6.7){ this.timeline=null; T.resolve(); this.recycle(cap); }
  }

  // 用過的扭蛋放回球裡，鏡頭歸位
  recycle(cap){
    this.pendingReset = ()=>{
      const ud=cap.mesh.userData;
      ud.a.position.y=0; ud.a.rotation.x=0; ud.b.position.y=0; ud.b.rotation.x=Math.PI;
      cap.p.set(0,5,0); cap.prev.copy(cap.p); cap.mesh.visible=true; cap.live=true;
      this.rig.remove(this.note); this.flash.intensity=0;
      this.camPath=null; this.yawTarget=-.2; this.settle=2; this.restoreCoin();
      // 回來時畫面已換過，直接歸位，不要看到鏡頭飛回去
      this.camera.position.copy(this.homePose()); this.look.copy(this.homeLook);
    };
  }

  reset(){
    // 裝置太慢、動畫沒跑完就揭曉時，直接收尾
    if(this.timeline){
      const {picked,resolve}=this.timeline;
      this.timeline=null; this.stir=0; this.rig.position.x=0; this.coin.visible=false; picked.live=false;
      resolve(); this.recycle(picked);
    }
    if(this.pendingReset){ this.pendingReset(); this.pendingReset=null; }
  }

  step(dt){
    if(this.coinFlight) this.flyCoin(dt);
    if(this.timeline) this.runTimeline(dt);
    // 提示下一步要按哪裡；按錯時閃快一點
    const waiting=!this.timeline&&!this.coinFlight;
    this.nudge=Math.max(0,(this.nudge||0)-dt*.8);
    this.slotRing.visible=waiting&&!this.coined;
    this.crankRing.visible=waiting&&!!this.coined;
    this.slotRing.material.opacity=.45+.5*Math.sin(this.idle*(this.nudge?14:3.4))**2;
    if(waiting&&!this.coined) this.coin.position.y=.5+Math.sin(this.idle*2)*.05;
    if(this.timeline || this.settle>0 || this.stir>0){
      this.physics(Math.min(dt,1/30));
      this.settle=Math.max(0,this.settle-dt);
    }
    this.idle+=dt;
    this.yaw+=(this.yawTarget-this.yaw)*.08;
    this.sway=(this.sway??1)+((this.timeline?0:1)-(this.sway??1))*.05;
    this.rig.rotation.y=this.yaw+Math.sin(this.idle*.5)*.05*this.sway;
    if(this.camPath && this.timeline){
      const u=smoother(span(this.timeline.t,.35,5.3));
      this.camPath.getPoint(u,this.camera.position);
      this.lookPath.getPoint(u,this.look);
    }else if(!this.camPath){
      this.camera.position.lerp(this.homePose(),.09);
      this.look.lerp(this.homeLook,.09);
    }
    this.camera.lookAt(this.look);
  }

  frame(){
    if(!document.querySelector(".hero.is-active")) return;
    this.step(Math.min(this.clock.getDelta(),.12));
    this.renderer.render(this.scene,this.camera);
  }
}

const wrap = document.getElementById("machineWrap");
try{
  const machine = new Machine(wrap);
  wrap.classList.add("has3d");
  window.Gacha3D = machine;
  window.renderGachaAction?.();
}catch(error){
  console.warn("3D 扭蛋機無法啟動，改用平面版",error);
}
