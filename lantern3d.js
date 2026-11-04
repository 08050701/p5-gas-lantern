// 放天燈：夜空、山影、滿天天燈。紙上寫著自己的願望，點了火才飛上去。
import * as THREE from "three";
import { surfaceNormal } from "./surface.js?v=20261104-2";

const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
const smooth = t => t*t*t*(t*(t*6-15)+10);
const span = (t,a,b) => clamp((t-a)/(b-a));
const INK = "#1d120b";
const HAND = "'LXGW WenKai TC','Noto Serif TC',serif";
const PANELS = ["#f7dc92","#ec8e3f","#cf3a24","#f2b348"]; // 正面、右、背、左
const UNLIT = .34; // 沒點火時紙也要看得清楚字
const RIDGES = [
  {z:-170,height:60,base:-8,color:"#2b2f55",seed:2.1},
  {z:-110,height:38,base:-10,color:"#1b2140",seed:5.3,lights:30},
  {z:-62,height:17,base:-9,color:"#0e1226",seed:8.7,lights:42}
];

function canvasOf(w,h,draw){
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  draw(c.getContext("2d"),w,h);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

// 把一段話排成直行：逗號、句號是換行的好地方，不把一句話從中間切開，也不留單字孤行
function columnsOf(text,rows){
  const phrases=text.split(/[，。！？、；：,.!?;:\s]+/).filter(Boolean).map(p=>[...p]);
  const columns=[]; let current=[];
  for(let phrase of phrases){
    if(current.length && current.length+1+phrase.length>rows){ columns.push(current); current=[]; }
    while(phrase.length>rows){
      const cut=phrase.length===rows+1 ? rows-1 : rows;
      columns.push(phrase.slice(0,cut)); phrase=phrase.slice(cut);
    }
    current=current.length ? [...current," ",...phrase] : phrase;
  }
  if(current.length) columns.push(current);
  return columns;
}

// 直書，由右到左；挑放得下的最大字
function writeColumns(c,text,x,y,w,h){
  let size=150, columns=[];
  const gapX=1.42, gapY=1.2;
  for(;size>=30;size-=2){
    const rows=Math.floor(h/(size*gapY));
    if(rows<1) continue;
    columns=columnsOf(text,rows);
    if(columns.length*size*gapX<=w) break;
  }
  const blockW=columns.length*size*gapX, tallest=Math.max(...columns.map(col=>col.length));
  const top=y+(h-tallest*size*gapY)/2;
  c.font=`700 ${size}px ${HAND}`; c.textAlign="center"; c.textBaseline="middle"; c.fillStyle=INK;
  columns.forEach((col,i)=>{
    const left=x+(w+blockW)/2-(i+.5)*size*gapX;
    col.forEach((ch,row)=>c.fillText(ch,left,top+(row+.5)*size*gapY));
  });
}

// 英文橫著寫，一樣挑放得下的最大字
function writeLines(c,text,x,y,w,h){
  const leading=1.25;
  let size=130, lines=[];
  for(;size>=26;size-=2){
    c.font=`700 ${size}px ${HAND}`;
    lines=I18N.wrap(c,text,w);
    if(lines.length*size*leading<=h && lines.every(line=>c.measureText(line).width<=w)) break;
  }
  const top=y+(h-lines.length*size*leading)/2;
  c.textAlign="center"; c.textBaseline="middle"; c.fillStyle=INK;
  lines.forEach((line,i)=>c.fillText(line,x+w/2,top+(i+.5)*size*leading));
}
const writeText=(c,text,...box)=>(I18N.latin(text)?writeLines:writeColumns)(c,text,...box);

// 紙面攤平：四面紙接成一張，由左到右是 右、背、左、正。手工紙有纖維、有壓痕，接縫是兩層紙疊著糊起來的
function paperTexture({wish,photo,title}){
  const W=512, H=1024, order=[1,2,3,0];
  const map=canvasOf(W*4,H,c=>{
    order.forEach((panel,i)=>{
      const x=i*W;
      c.fillStyle=PANELS[panel]; c.fillRect(x,0,W,H);
      for(let n=0;n<900;n++){ c.fillStyle=`rgba(${Math.random()<.5?"255,255,255":"90,40,10"},${Math.random()*.07})`; c.fillRect(x+Math.random()*W,Math.random()*H,1+Math.random()*26,1); }
      // 雲龍紙的長纖維
      for(let n=0;n<70;n++){
        const fx=x+Math.random()*W, fy=Math.random()*H;
        c.strokeStyle=`rgba(255,246,220,${.05+Math.random()*.14})`; c.lineWidth=.6+Math.random()*1.2;
        c.beginPath(); c.moveTo(fx,fy); c.bezierCurveTo(fx+Math.random()*70-35,fy+Math.random()*70-35,fx+Math.random()*90-45,fy+Math.random()*90-45,fx+Math.random()*120-60,fy+Math.random()*120-60); c.stroke();
      }
      // 摺過、撐開留下的壓痕
      for(let n=0;n<26;n++){
        let cx=x+Math.random()*W, cy=Math.random()*H, angle=Math.random()*6.3;
        c.strokeStyle=`rgba(${Math.random()<.5?"70,30,10":"255,236,196"},${.05+Math.random()*.08})`; c.lineWidth=1+Math.random();
        c.beginPath(); c.moveTo(cx,cy);
        for(let k=0;k<4;k++){ angle+=Math.random()-.5; cx+=Math.cos(angle)*(20+Math.random()*60); cy+=Math.sin(angle)*(20+Math.random()*60); c.lineTo(cx,cy); }
        c.stroke();
      }
      const seam=c.createLinearGradient(x,0,x+W,0);
      seam.addColorStop(0,"rgba(80,34,10,.42)"); seam.addColorStop(.035,"rgba(80,34,10,.2)"); seam.addColorStop(.04,"rgba(80,34,10,0)"); seam.addColorStop(.96,"rgba(80,34,10,0)"); seam.addColorStop(.965,"rgba(80,34,10,.2)"); seam.addColorStop(1,"rgba(80,34,10,.42)");
      c.fillStyle=seam; c.fillRect(x,0,W,H);
    });
    writeText(c,wish,3*W+110,Math.round(H*.3),W-220,Math.round(H*.56));
    const fu=I18N.t("lanternFu");
    c.fillStyle=INK; c.font=`700 ${I18N.latin(fu)?200:300}px ${HAND}`; c.textAlign="center"; c.textBaseline="middle";
    c.fillText(fu,W*1.5,H*.5,W*.8);
    writeText(c,title,2*W+120,170,W-240,H-300);
    if(photo){
      const pw=W-120, ph=pw*.75, px=60, py=(H-ph)/2-30;
      c.save(); c.translate(px+pw/2,py+ph/2); c.rotate(-.03);
      c.fillStyle="#fbf5e6"; c.fillRect(-pw/2-14,-ph/2-14,pw+28,ph+70);
      c.drawImage(photo,-pw/2,-ph/2,pw,ph);
      c.restore();
    }
  });
  // 點火後紙本身在發光：下面離火近最亮，往上慢慢暗成橘紅；墨字和纖維透光時還在
  const emissive=canvasOf(W*2,H/2,(c,w,h)=>{
    c.drawImage(map.image,0,0,w,h);
    c.globalCompositeOperation="multiply";
    const heat=c.createLinearGradient(0,h,0,0);
    heat.addColorStop(0,"#fff4cc"); heat.addColorStop(.32,"#ffcf7c"); heat.addColorStop(.72,"#e8803a"); heat.addColorStop(1,"#a2441c");
    c.fillStyle=heat; c.fillRect(0,0,w,h);
    c.globalCompositeOperation="source-over";
  });
  return {map,emissive};
}

// 四角略方的天燈：上寬下窄，底部開口
function lanternGeometry(){
  const profile=[[.6,0],[.72,.3],[.84,.8],[.93,1.4],[.97,1.95],[.93,2.32],[.76,2.55],[.42,2.68],[.001,2.72]];
  const curve=new THREE.CatmullRomCurve3(profile.map(([r,y])=>new THREE.Vector3(r,y,0)));
  const geo=new THREE.LatheGeometry(curve.getPoints(40).map(p=>new THREE.Vector2(Math.max(p.x,.001),p.y)),96,Math.PI/4);
  const pos=geo.attributes.position, p=3.4;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), a=Math.atan2(x,z);
    const k=1/Math.pow(Math.abs(Math.cos(a))**p+Math.abs(Math.sin(a))**p,1/p)*.9;
    // 紙不是撐得平平的：四條接縫吃進去一點，面上有鬆鬆的皺摺
    const y=pos.getY(i), fold=1+.016*Math.sin(a*14+y*2.6)+.01*Math.sin(y*8+a*5)-.022*Math.pow(Math.abs(Math.sin(a*2)),12);
    pos.setX(i,x*k*fold); pos.setZ(i,z*k*fold);
  }
  geo.computeVertexNormals();
  return geo;
}

function glowTexture(inner="255,226,150",outer="255,120,40"){
  return canvasOf(256,256,(c,w)=>{
    const g=c.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);
    g.addColorStop(0,`rgba(${inner},1)`); g.addColorStop(.25,`rgba(${outer},.45)`); g.addColorStop(1,`rgba(${outer},0)`);
    c.fillStyle=g; c.fillRect(0,0,w,w);
  });
}

function flameTexture(){
  return canvasOf(128,256,(c,w,h)=>{
    const g=c.createRadialGradient(w/2,h*.72,2,w/2,h*.62,h*.5);
    g.addColorStop(0,"rgba(255,255,235,1)"); g.addColorStop(.3,"rgba(255,200,80,.95)"); g.addColorStop(.7,"rgba(240,90,20,.5)"); g.addColorStop(1,"rgba(200,40,0,0)");
    c.fillStyle=g; c.beginPath(); c.moveTo(w/2,4); c.quadraticCurveTo(w*.98,h*.62,w/2,h-4); c.quadraticCurveTo(w*.02,h*.62,w/2,4); c.fill();
  });
}

// 遠方別人的天燈：一張貼圖就夠，亮著比細節重要
function farLanternTexture(word){
  return canvasOf(128,160,(c,w,h)=>{
    const halo=c.createRadialGradient(w/2,h*.6,6,w/2,h*.6,w*.62);
    halo.addColorStop(0,"rgba(255,170,70,.62)"); halo.addColorStop(1,"rgba(255,120,40,0)");
    c.fillStyle=halo; c.fillRect(0,0,w,h);
    const body=c.createLinearGradient(0,h*.2,0,h*.8);
    body.addColorStop(0,"#b8481f"); body.addColorStop(.5,"#f0913c"); body.addColorStop(.85,"#ffd98a"); body.addColorStop(1,"#fff4cc");
    c.shadowColor="rgba(255,150,60,.9)"; c.shadowBlur=7;
    c.fillStyle=body; c.beginPath(); c.moveTo(w*.3,h*.2); c.quadraticCurveTo(w/2,h*.13,w*.7,h*.2); c.quadraticCurveTo(w*.8,h*.42,w*.63,h*.8); c.lineTo(w*.37,h*.8); c.quadraticCurveTo(w*.2,h*.42,w*.3,h*.2); c.fill();
    c.shadowBlur=0;
    c.strokeStyle="rgba(120,44,12,.3)"; c.lineWidth=1.5;
    [.41,.59].forEach(k=>{ c.beginPath(); c.moveTo(w*(k+(k-.5)*.5),h*.17); c.quadraticCurveTo(w*(k+(k-.5)*1.1),h*.45,w*(k+(k-.5)*.1),h*.8); c.stroke(); });
    c.fillStyle="rgba(60,20,8,.42)"; c.textAlign="center"; c.textBaseline="middle";
    if(I18N.latin(word)){ c.font=`700 ${word.length>6?13:17}px ${HAND}`; c.fillText(word,w/2,h*.5,w*.44); return; }
    c.font=`700 ${word.length>1?24:36}px ${HAND}`;
    [...word].forEach((ch,i)=>c.fillText(ch,w/2,h*.48+(i-(word.length-1)/2)*26));
  });
}

function ridgeTexture({color,seed,lights=0}){
  return canvasOf(2048,256,(c,w,h)=>{
    const top=x=>h*.5-Math.sin(x*.004+seed)*h*.17-Math.sin(x*.013+seed*2)*h*.1-Math.sin(x*.041+seed*3)*h*.05-Math.sin(x*.11+seed*5)*h*.02-Math.sin(x*.27+seed)*h*.008;
    c.fillStyle=color; c.beginPath(); c.moveTo(0,h);
    for(let x=0;x<=w;x+=4) c.lineTo(x,top(x));
    c.lineTo(w,h); c.fill();
    for(let i=0;i<lights;i++){
      const x=Math.random()*w, y=top(x)+18+Math.random()*(h-top(x)-30);
      c.fillStyle=`rgba(255,${190+Math.random()*40},110,${.5+Math.random()*.5})`;
      c.fillRect(x,y,2+Math.random()*2,2+Math.random()*2);
    }
  });
}

class Sky {
  constructor(mount){
    this.mount=mount;
    this.renderer=new THREE.WebGLRenderer({antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.domElement.className="lantern3d";
    mount.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(38,1,.1,900);
    this.clock=new THREE.Clock();
    this.buildBackdrop();
    this.buildLantern();
    this.buildCrowd();
    new ResizeObserver(()=>this.resize()).observe(mount);
    this.resize();
  }

  buildBackdrop(){
    const dome=new THREE.Mesh(new THREE.SphereGeometry(700,32,24),new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,map:canvasOf(4,1024,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,0,h);
      g.addColorStop(0,"#050817"); g.addColorStop(.38,"#0b1433"); g.addColorStop(.47,"#2a2650"); g.addColorStop(.5,"#6b3b52"); g.addColorStop(.53,"#23193a"); g.addColorStop(1,"#0a0a16");
      c.fillStyle=g; c.fillRect(0,0,w,h);
    })}));
    this.dome=dome; this.scene.add(dome);

    const stars=new Float32Array(1400*3);
    for(let i=0;i<1400;i++){
      const a=Math.random()*6.3, e=Math.random()*1.5+.05, r=640;
      stars.set([Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r],i*3);
    }
    const geo=new THREE.BufferGeometry(); geo.setAttribute("position",new THREE.BufferAttribute(stars,3));
    this.stars=new THREE.Points(geo,new THREE.PointsMaterial({color:0xfff3d6,size:1.5,sizeAttenuation:false,transparent:true,opacity:.85}));
    this.scene.add(this.stars);

    RIDGES.forEach(ridge=>{
      const width=Math.abs(ridge.z)*5.6;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,ridge.height*2),new THREE.MeshBasicMaterial({map:ridgeTexture(ridge),transparent:true,depthWrite:false}));
      mesh.position.set(0,ridge.base+ridge.height*.75,ridge.z);
      this.scene.add(mesh);
    });
    this.scene.add(new THREE.HemisphereLight(0x46558c,0x14101e,1.5));
    const moon=new THREE.DirectionalLight(0x9fb2de,.55); moon.position.set(-6,8,7); this.scene.add(moon);
    const gravel=surfaceNormal(512,40,40,2,4); gravel.repeat.set(30,30);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(90,48).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x1a1a26,roughness:.92,normalMap:gravel}));
    ground.position.set(0,-.02,-20); this.scene.add(ground);
    this.groundGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture("255,190,110","255,120,40"),blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false}));
    this.groundGlow.scale.set(9,3,1); this.groundGlow.position.set(0,.08,.4); this.scene.add(this.groundGlow);
  }

  buildLantern(){
    const g=this.lantern=new THREE.Group();
    const creases=surfaceNormal(512,8,20,2.6,5); creases.repeat.set(4,1);
    this.paperMat=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.82,normalMap:creases,normalScale:new THREE.Vector2(.55,.55),emissive:0xffffff,emissiveIntensity:UNLIT});
    this.paper=new THREE.Mesh(lanternGeometry(),this.paperMat); g.add(this.paper);
    // 底下的竹圈、十字鐵絲，中間綁著浸過油的金紙
    const bamboo=new THREE.MeshStandardMaterial({color:0x8a6236,roughness:.6});
    const wire=new THREE.MeshStandardMaterial({color:0x2a2622,roughness:.5,metalness:.7});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.53,.03,8,4).rotateX(Math.PI/2).rotateY(Math.PI/4),bamboo); ring.position.y=.02; g.add(ring);
    [Math.PI/4,-Math.PI/4].forEach(a=>{ const bar=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,1.06,6).rotateZ(Math.PI/2).rotateY(a),wire); bar.position.y=.02; g.add(bar); });
    this.burner=new THREE.MeshStandardMaterial({color:0xb99a58,roughness:.75,emissive:0xff7a24,emissiveIntensity:0});
    for(let i=0;i<5;i++){ const leaf=new THREE.Mesh(new THREE.BoxGeometry(.24-i*.012,.012,.17),this.burner); leaf.position.y=.03+i*.014; leaf.rotation.y=(i-2)*.14; g.add(leaf); }
    this.fire=new THREE.PointLight(0xffa04a,0,14,1.6); this.fire.position.y=.34; g.add(this.fire);
    this.flame=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTexture(),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
    this.flame.position.y=.3; this.flame.scale.set(.001,.001,1); g.add(this.flame);
    this.halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false}));
    this.halo.position.y=1.25; this.halo.scale.set(9,9,1); g.add(this.halo);
    this.scene.add(g);
  }

  buildCrowd(){
    const maps=I18N.lanternWords().map(farLanternTexture);
    this.crowdLang=I18N.lang;
    this.crowd=[];
    for(let i=0;i<110;i++){
      const mat=new THREE.SpriteMaterial({map:maps[i%maps.length],transparent:true,depthWrite:false,opacity:0});
      const s=new THREE.Sprite(mat), depth=18+Math.random()*190;
      const size=(2+Math.random()*1.4)*(1+depth*.012);
      s.scale.set(size,size*1.25,1);
      this.scene.add(s);
      this.crowd.push({s,depth,x:(Math.random()-.5)*(30+depth*1.5),y:Math.random()*170,speed:.8+Math.random()*1.5,phase:Math.random()*6.3,early:i<26});
    }
  }

  resize(){
    const w=this.mount.clientWidth, h=this.mount.clientHeight;
    if(!w||!h) return;
    this.renderer.setSize(w,h);
    this.camera.aspect=w/h;
    this.distance=8.8*Math.max(1,.78/this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  // 換過語言，遠處天燈上的字也換
  relabelCrowd(){
    if(this.crowdLang===I18N.lang) return;
    const maps=I18N.lanternWords().map(farLanternTexture);
    this.crowd.forEach(({s},i)=>{ s.material.map=maps[i%maps.length]; s.material.needsUpdate=true; });
    this.crowdLang=I18N.lang;
  }

  open({wish,photo,title}){
    this.relabelCrowd();
    this.paperMat.map?.dispose(); this.paperMat.emissiveMap?.dispose();
    const {map,emissive}=paperTexture({wish,photo,title});
    this.paperMat.map=map; this.paperMat.emissiveMap=emissive; this.paperMat.needsUpdate=true;
    this.lit=null; this.onDone=null; this.time=0;
    this.lantern.position.set(0,0,0); this.lantern.rotation.set(0,0,0); this.lantern.scale.set(1,1,1);
    this.paperMat.emissiveIntensity=UNLIT; this.fire.intensity=0; this.burner.emissiveIntensity=0; this.lantern.visible=true;
    this.halo.material.opacity=0; this.groundGlow.material.opacity=0; this.flame.scale.set(.001,.001,1);
    this.crowd.forEach(c=>{ c.y=Math.random()*170; c.s.material.opacity=0; });
    this.clock.getDelta();
    this.renderer.setAnimationLoop(()=>this.frame());
  }

  ignite(onDone){
    if(this.lit!==null) return;
    this.lit=0; this.onDone=onDone;
    window.RetroSfx?.ignite?.();
  }

  close(){ this.renderer.setAnimationLoop(null); }

  frame(){
    const dt=Math.min(this.clock.getDelta(),.1);
    this.time+=dt;
    const t=this.time, lantern=this.lantern;
    let rise=0;
    if(this.lit!==null){
      this.lit+=dt;
      const L=this.lit, on=smooth(span(L,0,1.8)), lift=Math.max(0,L-2.4);
      const flicker=1+Math.sin(t*19)*.1+Math.sin(t*31)*.08;
      this.paperMat.emissiveIntensity=UNLIT+on*.86*(1+Math.sin(t*23)*.025);
      this.fire.intensity=on*16*flicker; this.burner.emissiveIntensity=on*1.6;
      this.flame.scale.set(.26*on*flicker,.5*on*flicker,1);
      this.halo.material.opacity=on*.55*flicker;
      this.groundGlow.material.opacity=on*.5*(1-span(lift,0,3));
      // 熱空氣把紙撐起來：先鼓起、再離地
      const puff=.9+.1*smooth(span(L,.4,2.4));
      lantern.scale.set(puff,.94+.06*smooth(span(L,.4,2.4)),puff);
      rise=lift<2.2 ? lift*lift*.42+lift*.15 : 2.36+(lift-2.2)*2;
      if(L>9.5 && this.onDone){ this.onDone(); this.onDone=null; }
    }else{
      lantern.rotation.z=Math.sin(t*.9)*.008;
    }
    const lift=this.lit===null?0:Math.max(0,this.lit-2.4);
    lantern.position.y=rise;
    lantern.position.x=Math.sin(lift*.42)*1.1*span(lift,0,6);
    lantern.position.z=-Math.max(0,lift-1.5)*5;
    lantern.rotation.y=lift*.3;
    lantern.rotation.z=Math.sin(lift*.8)*.05*span(lift,0,3);
    lantern.visible=rise<900;

    // 別人的天燈：等自己的飛起來才慢慢變多
    const crowdOn=this.lit===null?0:span(this.lit,2.6,8);
    this.crowd.forEach((item,i)=>{
      item.y+=item.speed*dt;
      if(item.y>190) item.y=-6;
      const x=item.x+Math.sin(t*.22+item.phase)*2.4, s=item.s;
      s.position.set(x,item.y+6,-item.depth);
      const fadeIn=clamp((item.y+6)/10);
      s.material.opacity=(item.early?1:crowdOn)*fadeIn*(.82+Math.sin(t*2.2+i)*.16);
    });

    // 鏡頭先平視，再抬頭盯著它；它往夜空深處飛，越來越小
    const follow=smooth(span(lift,.2,5));
    const camY=1+Math.min(rise*.72,58)*follow;
    const lookY=1.72+(lantern.position.y-.6)*follow;
    this.camera.position.set(Math.sin(t*.13)*.14,camY,this.distance+follow*2);
    this.camera.lookAt(lantern.position.x*follow,lookY,lantern.position.z*follow);
    this.dome.position.copy(this.camera.position); this.stars.position.copy(this.camera.position);
    this.renderer.render(this.scene,this.camera);
  }
}

let sky=null;
window.LanternSky = {
  open(data){
    try{
      if(!sky) sky=new Sky(document.getElementById("lanternSky"));
      sky.open(data);
      return true;
    }catch(error){
      console.warn("天燈畫面無法啟動",error);
      return false;
    }
  },
  ignite(onDone){ sky ? sky.ignite(onDone) : onDone(); },
  close(){ sky?.close(); }
};
