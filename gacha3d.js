// 3D 扭蛋機：舊式紅色鐵殼機台。投幣、轉把手、扭蛋翻滾、掉出來、打開。
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const GLOBE_CENTER = new THREE.Vector3(0,4.2,0);
const GLOBE_R = 1.46;
const CAP_R = .28;
const CAP_COUNT = 56;
const COLORS = ["#a8281f","#2f5d50","#d6a62e","#2c5f8a","#c4602a"];
const CHUTE = new THREE.Vector3(0,.74,1.34);
const TRAY = new THREE.Vector3(0,.66,1.8);
const FRONT = 1.46; // 機械面板的正面
const SLOT = new THREE.Vector3(.68,1.58,FRONT);
const CRANK = new THREE.Vector3(0,1.58,FRONT);
const COIN_HOME = new THREE.Vector3(2.15,.42,1.9);
const OUT = new THREE.Vector3(0,1.46,2.75); // 打開扭蛋的位置
const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
const ease = t => t*t*(3-2*t);
const smoother = t => t*t*t*(t*(t*6-15)+10);
const span = (t,a,b) => clamp((t-a)/(b-a));

function textPlane(w,h,draw,opts={}){
  const px = opts.px||220;
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
  r.fillStyle="#6e6e6e"; r.fillRect(0,0,size,size);
  const blot=(x,y,radius,color)=>{ const b=g.createRadialGradient(x,y,0,x,y,radius); b.addColorStop(0,color); b.addColorStop(1,color.replace(/[\d.]+\)$/,"0)")); g.fillStyle=b; g.fillRect(x-radius,y-radius,radius*2,radius*2); };
  for(let i=0;i<34;i++) blot(rnd()*size,rnd()*size,50+rnd()*170,`${fade}${.03+rnd()*.06})`);
  for(let i=0;i<20;i++) blot(rnd()*size,rnd()*size,30+rnd()*120,`rgba(30,16,8,${.03+rnd()*.06})`);
  if(seed===3) for(let i=0;i<150;i++){ // 木紋
    const y=rnd()*size; g.strokeStyle=`rgba(${rnd()<.6?"40,22,10":"170,120,76"},${.05+rnd()*.13})`; g.lineWidth=1+rnd()*2.4;
    g.beginPath(); g.moveTo(0,y); g.bezierCurveTo(size*.3,y+rnd()*16-8,size*.7,y+rnd()*16-8,size,y+rnd()*8-4); g.stroke();
  }
  // 手摸最多、東西碰最多的地方在下緣和邊角，鏽往下流
  for(let i=0;i<9;i++){
    const x=rnd()*size, y=rnd()<.7?size*(.86+rnd()*.14):rnd()*size;
    const w=2+rnd()*rnd()*12, h=2+rnd()*6;
    g.fillStyle=rnd()<.5?"#6b3d1e":"#41301f"; r.fillStyle="#ececec";
    g.beginPath(); r.beginPath();
    for(let k=0;k<7;k++){ const a=k/7*6.28, q=.6+rnd()*.7; g.lineTo(x+Math.cos(a)*w*q,y+Math.sin(a)*h*q); r.lineTo(x+Math.cos(a)*w*q,y+Math.sin(a)*h*q); }
    g.fill(); r.fill();
    if(rnd()<.12){ g.strokeStyle=`rgba(96,50,22,${.12+rnd()*.2})`; g.lineWidth=1+rnd()*3; g.beginPath(); g.moveTo(x,y); g.lineTo(x+rnd()*5-2,y+24+rnd()*100); g.stroke(); }
  }
  for(let i=0;i<120;i++){
    const x=rnd()*size, y=rnd()*size, a=rnd()*6.28, l=8+rnd()*rnd()*120;
    g.strokeStyle=`rgba(232,214,180,${.03+rnd()*.09})`; r.strokeStyle="#d8d8d8";
    g.lineWidth=r.lineWidth=.6+rnd();
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke();
    r.beginPath(); r.moveTo(x,y); r.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); r.stroke();
  }
  const tex=(canvas,srgb)=>{ const t=new THREE.CanvasTexture(canvas); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; if(srgb) t.colorSpace=THREE.SRGBColorSpace; return t; };
  return {map:tex(c,true),roughnessMap:tex(rough,false)};
}

// 車床做出來的零件：給一串 [半徑, 高度]，轉一圈
const lathe = (points,segments=96) => new THREE.LatheGeometry(new THREE.SplineCurve(points.map(([r,y])=>new THREE.Vector2(r,y))).getPoints(points.length*6),segments);

// 把手中心的滾花鈕：一圈細齒，手才抓得住
function knurled(radius,depth,teeth=32){
  const shape=new THREE.Shape();
  for(let i=0;i<teeth*2;i++){
    const a=i/(teeth*2)*Math.PI*2, r=i%2?radius:radius*.955;
    i?shape.lineTo(Math.cos(a)*r,Math.sin(a)*r):shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,curveSegments:1});
}

// 蝶形把手：中間細、兩端圓，像老機器上的翼形螺絲
function butterfly(length,waist,lobe,depth){
  const L=length/2, shape=new THREE.Shape();
  shape.moveTo(-waist,0);
  shape.bezierCurveTo(-waist,L*.42,-lobe,L*.52,-lobe,L*.8);
  shape.bezierCurveTo(-lobe,L*1.06,lobe,L*1.06,lobe,L*.8);
  shape.bezierCurveTo(lobe,L*.52,waist,L*.42,waist,0);
  shape.bezierCurveTo(waist,-L*.42,lobe,-L*.52,lobe,-L*.8);
  shape.bezierCurveTo(lobe,-L*1.06,-lobe,-L*1.06,-lobe,-L*.8);
  shape.bezierCurveTo(-lobe,-L*.52,-waist,-L*.42,-waist,0);
  return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:4,curveSegments:24});
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
    const enamel = new THREE.MeshPhysicalMaterial({...wornPaint("#8e2318","rgba(150,84,60,",1),roughness:.62,metalness:.05,clearcoat:.5,clearcoatRoughness:.34});
    const chrome = new THREE.MeshStandardMaterial({...wornPaint("#d8d2c2","rgba(90,72,50,",2),metalness:1,roughness:.62});
    const polished = new THREE.MeshStandardMaterial({color:0xd6d0c0,metalness:1,roughness:.22});
    const brass = new THREE.MeshStandardMaterial({color:0xb8934a,metalness:1,roughness:.34});
    const dark = new THREE.MeshStandardMaterial({color:0x120c08,roughness:.85});
    const wood = new THREE.MeshStandardMaterial({...wornPaint("#6e4322","rgba(120,80,46,",3),roughness:.8});
    wood.map.repeat.set(5,1.4); wood.roughnessMap.repeat.set(5,1.4); wood.envMapIntensity=.3;
    const add = (geo,mat,x=0,y=0,z=0,parent=m) => { const o=new THREE.Mesh(geo,mat); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; parent.add(o); return o; };

    // 柑仔店的木櫃台，一路延伸到畫面外，機台才有地方站
    const counter = add(new RoundedBoxGeometry(44,8,5.6,4,.05),wood,0,-4,.7,this.scene);
    counter.castShadow = false;
    add(new RoundedBoxGeometry(44,.1,.1,3,.04),wood,0,-.42,3.52,this.scene);

    // 鑄造機身：底盤、收腰、肩、托住玻璃球的杯座，一體成形
    add(lathe([[1.58,.04],[1.6,.12],[1.56,.2],[1.44,.26],[1.34,.42],[1.25,.8],[1.22,1.3],[1.24,1.8],[1.34,2.25],[1.42,2.5],[1.4,2.66],[1.26,2.84],[1.12,3.02],[1.05,3.12]]),enamel);
    add(new THREE.TorusGeometry(1.59,.025,12,96).rotateX(Math.PI/2),brass,0,.12,0);
    add(new THREE.TorusGeometry(1.42,.018,12,96).rotateX(Math.PI/2),brass,0,2.5,0);
    add(lathe([[.94,3.08],[1,3.09],[1.07,3.12],[1.09,3.17],[1.05,3.22],[.98,3.2]]),polished);
    [0,1,2,3,4,5,6,7].forEach(i=>{
      const a=(i+.5)/8*Math.PI*2;
      add(new THREE.CylinderGeometry(.05,.06,.04,6),chrome,Math.cos(a)*1.46,.25,Math.sin(a)*1.46).rotation.x=Math.cos(a+1)*.3;
    });

    // 機械面板：一塊厚鑄件鎖在機身正面
    add(new RoundedBoxGeometry(2.04,2.16,.56,8,.1),enamel,0,1.4,1.18);
    // 手描的金線框
    [[0,2.38,1.82,.014],[0,.42,1.82,.014],[-.91,1.4,.014,1.97],[.91,1.4,.014,1.97]].forEach(([x,y,w,h])=>add(new THREE.BoxGeometry(w,h,.006),brass,x,y,FRONT+.002).castShadow=false);

    const sign = textPlane(1.4,.3,(c,W,H)=>{
      c.fillStyle="#efe2c4"; c.fillRect(0,0,W,H);
      c.strokeStyle="#7c1c14"; c.lineWidth=9; c.strokeRect(11,11,W-22,H-22);
      c.fillStyle="#8e2318"; c.font="700 84px 'Noto Serif TC', serif"; c.textAlign="center"; c.textBaseline="middle";
      c.fillText("轉 來 坐",W/2,H/2+6);
    },{px:440});
    sign.position.set(0,2.17,FRONT+.012); m.add(sign);
    const price = textPlane(.22,.66,(c,W,H)=>{
      c.fillStyle="#efe2c4"; c.fillRect(0,0,W,H);
      c.fillStyle="#3a2a1c"; c.font="700 68px 'Noto Serif TC', serif"; c.textAlign="center"; c.textBaseline="middle";
      [..."每次壹圓"].forEach((ch,i)=>c.fillText(ch,W/2,H*(.14+i*.24)));
    },{px:440});
    price.position.set(-.68,1.58,FRONT+.012); m.add(price);

    const screw=(x,y,z=FRONT+.03)=>{ const head=add(new THREE.CylinderGeometry(.038,.042,.024,14).rotateX(Math.PI/2),polished,x,y,z); head.castShadow=false; const cut=add(new THREE.BoxGeometry(.06,.009,.006),dark,x,y,z+.013); cut.rotation.z=Math.random()*3; cut.castShadow=false; };
    [[-.82,2.3],[.82,2.3],[-.82,.5],[.82,.5]].forEach(([x,y])=>screw(x,y));

    // 投幣孔：黃銅小蓋板
    add(new RoundedBoxGeometry(.26,.6,.05,4,.02),brass,SLOT.x,SLOT.y,FRONT+.02);
    add(new THREE.BoxGeometry(.05,.34,.02),dark,SLOT.x,SLOT.y,FRONT+.045);
    const gold = new THREE.MeshStandardMaterial({color:0xc9a24c,metalness:1,roughness:.35});
    const face = textPlane(.4,.4,(c,W,H)=>{
      c.fillStyle="#c9a24c"; c.fillRect(0,0,W,H);
      c.strokeStyle="#7e5f1e"; c.lineWidth=7; c.beginPath(); c.arc(W/2,H/2,W*.42,0,7); c.stroke();
      c.fillStyle="#6d5019"; c.font=`700 ${W*.56}px 'Noto Serif TC', serif`; c.textAlign="center"; c.textBaseline="middle";
      c.translate(W/2,H/2); c.rotate(Math.PI/2); c.fillText("壹",0,4);
    }).material;
    face.metalness=.75;
    this.coin = add(new THREE.CylinderGeometry(.2,.2,.04,40).rotateZ(Math.PI/2),[gold,face,face],COIN_HOME.x,COIN_HOME.y,COIN_HOME.z);
    this.slotRing = add(new THREE.TorusGeometry(.46,.05,10,48),new THREE.MeshBasicMaterial({color:0xffd86a,transparent:true,depthWrite:false}),SLOT.x,SLOT.y,FRONT+.08);
    this.slotRing.scale.set(.5,.86,1); this.slotRing.castShadow=false;
    this.crankRing = add(new THREE.TorusGeometry(.46,.04,10,56),this.slotRing.material,CRANK.x,CRANK.y,FRONT+.1);
    this.crankRing.castShadow=false;
    // 看不見的感應區：手指比零件粗，範圍放大一點
    const hitMat = new THREE.MeshBasicMaterial({visible:false});
    const hit = (geo,x,y,z,part) => { const o=new THREE.Mesh(geo,hitMat); o.position.set(x,y,z); o.userData.part=part; m.add(o); return o; };
    this.hits = [hit(new THREE.BoxGeometry(.6,1.1,.3),SLOT.x,SLOT.y,FRONT+.1,"slot"),hit(new THREE.SphereGeometry(.5,12,10),COIN_HOME.x,COIN_HOME.y,COIN_HOME.z,"slot"),hit(new THREE.CylinderGeometry(.5,.5,.6,24).rotateX(Math.PI/2),CRANK.x,CRANK.y,FRONT+.2,"crank")];

    // 轉把手：滾花圓座加蝶形把手
    add(new THREE.CylinderGeometry(.4,.42,.04,64).rotateX(Math.PI/2),polished,CRANK.x,CRANK.y,FRONT+.03).castShadow=false;
    this.crank = new THREE.Group(); this.crank.position.copy(CRANK); m.add(this.crank);
    add(knurled(.33,.1),chrome,0,0,.05,this.crank);
    add(butterfly(.6,.065,.115,.09),polished,0,0,.18,this.crank);
    add(lathe([[.085,0],[.085,.03],[.06,.055],[0,.065]],32).rotateX(Math.PI/2),polished,0,0,.3,this.crank);

    // 出口：拱形開口、掀蓋、一個弧形的鐵皮接球斗
    const mouth = new THREE.Shape();
    mouth.moveTo(-.36,-.2); mouth.lineTo(-.36,.02); mouth.absarc(0,.02,.36,Math.PI,0,true); mouth.lineTo(.36,-.2); mouth.closePath();
    add(new THREE.ShapeGeometry(mouth,32),dark,0,.76,FRONT+.008).castShadow=false;
    const arch = new THREE.Path().absarc(0,.02,.4,Math.PI,0,true);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arch.getPoints(24).map(p=>new THREE.Vector3(p.x,p.y,0))),48,.026,10),polished,0,.76,FRONT+.012);
    const bowl = new THREE.SphereGeometry(.46,48,24,0,Math.PI,Math.PI/2,Math.PI/2);
    bowl.scale(1,.66,1.2);
    const scoop = new THREE.MeshStandardMaterial({...wornPaint("#d8d2c2","rgba(90,72,50,",4),metalness:1,roughness:.55,side:THREE.DoubleSide});
    add(bowl,scoop,0,.66,FRONT+.01);
    add(new THREE.TorusGeometry(.46,.024,12,64,Math.PI).rotateX(Math.PI/2).scale(1,1,1.2),polished,0,.66,FRONT+.01);

    // 玻璃球與鐵蓋
    const glass = new THREE.MeshPhysicalMaterial({color:0xfaf3e2,transparent:true,opacity:.16,roughness:.06,metalness:0,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.8,depthWrite:false,side:THREE.FrontSide});
    const globe = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R,64,48),glass);
    globe.position.copy(GLOBE_CENTER); globe.renderOrder = 5; m.add(globe);
    // 玻璃的反光與厚度感
    const back = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R+.01,48,32),new THREE.MeshBasicMaterial({color:0xd8e4dc,transparent:true,opacity:.08,side:THREE.BackSide,depthWrite:false}));
    back.position.copy(GLOBE_CENTER); m.add(back);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R+.015,32,24,3.7,.5,.75,.85),new THREE.MeshBasicMaterial({color:0xfff4dc,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    shine.position.copy(GLOBE_CENTER); shine.renderOrder=6; m.add(shine);
    // 蓋子壓在玻璃開口上：一圈唇邊、低低的圓頂、頂上帶鎖的銅頭
    add(new THREE.CircleGeometry(.96,64).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0x4a1a12,roughness:.7}),0,5.3,0).castShadow=false;
    add(lathe([[.9,5.3],[.96,5.3],[1,5.35],[.98,5.42],[.9,5.5],[.72,5.6],[.46,5.67],[.32,5.71],[.28,5.76],[.2,5.8],[0,5.81]]),enamel);
    add(new THREE.TorusGeometry(.985,.025,12,96).rotateX(Math.PI/2),polished,0,5.36,0);
    add(lathe([[.17,5.78],[.15,5.84],[.1,5.88],[.14,5.93],[.15,6],[.11,6.05],[.05,6.08],[0,6.085]],48),brass);
  }

  makeCapsule(color){
    const g = new THREE.Group();
    const top = new THREE.MeshPhysicalMaterial({color,roughness:.36,clearcoat:.5,clearcoatRoughness:.3});
    const bottom = new THREE.MeshPhysicalMaterial({color:0xeee2c8,roughness:.4,clearcoat:.35});
    const half = new THREE.SphereGeometry(CAP_R,28,14,0,Math.PI*2,0,Math.PI/2);
    const a = new THREE.Mesh(half,top); const b = new THREE.Mesh(half,bottom); b.rotation.x = Math.PI;
    a.castShadow = b.castShadow = true;
    // 上下殼交接的那圈扣環，扭蛋才像扭蛋
    a.add(new THREE.Mesh(new THREE.TorusGeometry(CAP_R,.012,8,40).rotateX(Math.PI/2),bottom));
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
    this.coin.position.set(THREE.MathUtils.lerp(COIN_HOME.x,SLOT.x,k),THREE.MathUtils.lerp(COIN_HOME.y,SLOT.y,k)+Math.sin(k*Math.PI)*.35,THREE.MathUtils.lerp(COIN_HOME.z,FRONT+.2,k)-near*.3);
    this.coin.rotation.y=(1-k)*Math.PI/2;
    this.coin.scale.setScalar(1+(1-k)*.7);
    if(F.t>=.95){
      window.RetroSfx?.coin();
      this.coin.visible=false; this.coined=true; this.coinFlight=null; F.resolve();
    }
  }

  restoreCoin(){
    this.coined=false; this.coin.visible=true;
    this.coin.position.copy(COIN_HOME); this.coin.rotation.set(0,Math.PI/2,0); this.coin.scale.setScalar(1.7);
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
    this.fit = Math.max(1,.74/this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  spin(title){
    return new Promise(resolve=>{
      const picked = this.caps.filter(c=>c.live).sort((a,b)=>(a.p.y+a.p.x*a.p.x*.2+a.p.z*a.p.z*.2)-(b.p.y+b.p.x*b.p.x*.2+b.p.z*b.p.z*.2))[0];
      this.note = this.makeNote(title); this.note.visible=false; this.rig.add(this.note);
      this.timeline = {t:.5,picked,resolve,stage:{},from:null};
      this.yawTarget = 0;
      // 鏡頭走一條連續的曲線：轉把手時就開始慢慢靠近，中途不停、不急轉
      const home=this.homePose(), near=new THREE.Vector3(0,1.55,7.7);
      this.camPath=new THREE.CatmullRomCurve3([home,home.clone().lerp(near,.3).add(new THREE.Vector3(-1.1,.1,0)),home.clone().lerp(near,.68).add(new THREE.Vector3(.7,-.5,0)),near]);
      this.lookPath=new THREE.CatmullRomCurve3([this.homeLook.clone(),new THREE.Vector3(0,2.5,.3),new THREE.Vector3(0,1.5,1.2),OUT.clone()]);
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
      cap.mesh.position.lerpVectors(TRAY,OUT,k);
      cap.mesh.position.y+=Math.sin(k*Math.PI)*.18;
      cap.mesh.quaternion.slerp(new THREE.Quaternion(),.1);
    }
    if(t>=5.1){
      this.once("pop",()=>window.RetroSfx?.pop());
      const k=smoother(span(t,5.1,5.7));
      cap.mesh.userData.a.position.y=k*.46; cap.mesh.userData.a.rotation.x=-k*.4;
      cap.mesh.userData.b.position.y=-k*.46; cap.mesh.userData.b.rotation.x=Math.PI+k*.4;
      this.flash.position.set(0,OUT.y,OUT.z+.4); this.flash.intensity=Math.sin(span(t,5.1,6.6)*Math.PI)*12;
      this.note.visible=true;
      this.note.position.set(0,OUT.y,OUT.z+.05);
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
    if(waiting&&!this.coined) this.coin.position.y=COIN_HOME.y+Math.sin(this.idle*2)*.05;
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
