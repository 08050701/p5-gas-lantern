// 扭蛋機、天燈、相冊共用的材質：同一間店、同一種光、同一種舊。
import * as THREE from "three";

// 用了幾十年的烤漆：褪色、刮痕、掉漆露出底下的鐵和鏽
export function wornPaint(base,fade,seed=1){
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

// 烤漆的橘皮、鑄鐵的砂面、木頭的纖維：表面細微的高低，反光才會碎，不像塑膠
export function surfaceNormal(size,cellX,cellY,strength,seed=1){
  let s=seed*7919; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const lattice=Array.from({length:4},(_,o)=>{ const w=cellX<<o, h=cellY<<o; return {w,h,v:Float32Array.from({length:w*h},rnd)}; });
  const smooth=t=>t*t*(3-2*t), height=new Float32Array(size*size);
  lattice.forEach(({w,h,v},o)=>{
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const fx=x/size*w, fy=y/size*h, x0=fx|0, y0=fy|0, tx=smooth(fx-x0), ty=smooth(fy-y0), x1=(x0+1)%w, y1=(y0+1)%h;
      const top=v[y0*w+x0]*(1-tx)+v[y0*w+x1]*tx, low=v[y1*w+x0]*(1-tx)+v[y1*w+x1]*tx;
      height[y*size+x]+=(top*(1-ty)+low*ty)/(1<<o);
    }
  });
  const c=document.createElement("canvas"); c.width=c.height=size;
  const g=c.getContext("2d"), image=g.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size], dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
    const i=(y*size+x)*4;
    image.data[i]=128-dx*strength*127; image.data[i+1]=128-dy*strength*127; image.data[i+2]=255; image.data[i+3]=255;
  }
  g.putImageData(image,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8;
  return t;
}

// 柑仔店裡的光：暗暗的室內，左邊一扇有窗櫺的大窗、頭上一盞燈。金屬和玻璃反射的就是這些
export function shopLight(renderer){
  const room=new THREE.Scene(), glow=(w,h,r,g,b,x,y,z)=>{
    const light=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    light.material.color.setRGB(r,g,b); light.position.set(x,y,z); light.lookAt(0,0,0); room.add(light);
  };
  const walls=new THREE.Mesh(new THREE.BoxGeometry(20,12,20),new THREE.MeshBasicMaterial({side:THREE.BackSide}));
  walls.material.color.setRGB(.12,.08,.055); room.add(walls);
  [[-1.1,1.35],[1.1,1.35],[-1.1,-1.35],[1.1,-1.35]].forEach(([u,v])=>glow(2,2.5,8,7.1,5.8,-8.5,2.4+v,4.6+u*.9));
  glow(7,4,1.1,.85,.55,1,5.6,1);
  glow(1.2,6,1.5,1.25,1,8.5,1,3);
  glow(16,16,.32,.2,.11,0,-5.8,0);
  const pm=new THREE.PMREMGenerator(renderer), map=pm.fromScene(room,.012).texture;
  pm.dispose();
  return map;
}

// 零件交接的凹處光進不去：把這層暗部直接畫在頂點上
export function shadeVertices(geometry,amount){
  const p=geometry.attributes.position, colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) colors.fill(amount(p.getX(i),p.getY(i),p.getZ(i)),i*3,i*3+3);
  geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
  return geometry;
}
export const dent=(v,center,width)=>Math.exp(-(((v-center)/width)**2));

// 泛黃的紙：邊角比較深，有水漬和小斑點
export function agedPaper(c,W,H,seed=1){
  let s=seed*4801; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  c.fillStyle="#e4d4ae"; c.fillRect(0,0,W,H);
  for(let i=0;i<26;i++){
    const x=rnd()*W,y=rnd()*H,r=(.1+rnd()*.4)*Math.max(W,H),b=c.createRadialGradient(x,y,0,x,y,r);
    b.addColorStop(0,`rgba(150,106,54,${.03+rnd()*.07})`); b.addColorStop(1,"rgba(150,106,54,0)");
    c.fillStyle=b; c.fillRect(0,0,W,H);
  }
  c.fillStyle="rgba(92,60,28,.32)";
  for(let i=0;i<70;i++) c.fillRect(rnd()*W,rnd()*H,1+rnd()*3,1+rnd()*2);
  const edge=c.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.68);
  edge.addColorStop(0,"rgba(96,58,24,0)"); edge.addColorStop(1,"rgba(96,58,24,.34)");
  c.fillStyle=edge; c.fillRect(0,0,W,H);
}
