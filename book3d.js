// 大家的相冊：一本放在桌上的 3D 書。紙會沿著弧線彎起來，手指拖到哪、紙就跟到哪。
import * as THREE from "three";

const W = 3, H = 4.2;
const COLS = 48, ROWS = 12;
const PAGE_PX = [768,1075];
const HAND = "'LXGW WenKai TC','Noto Serif TC',serif";
const SERIF = "'Noto Serif TC',serif";
const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
const hump = s => .13*Math.exp(-s/.42); // 靠書脊的紙會微微拱起

function wrapLines(c,text,width,maxLines){
  const lines=[]; let line="";
  for(const ch of text){
    const next=line+ch;
    if(c.measureText(next).width>width && line && !"」，。！？、…".includes(ch)){ lines.push(line); line=ch; } else line=next;
  }
  if(line) lines.push(line);
  if(lines.length>maxLines){ lines.length=maxLines; lines[maxLines-1]=lines[maxLines-1].slice(0,-1)+"…"; }
  return lines;
}

function paperBase(c,w,h){
  const g=c.createLinearGradient(0,0,0,h);
  g.addColorStop(0,"#f8efdb"); g.addColorStop(1,"#efe2c6");
  c.fillStyle=g; c.fillRect(0,0,w,h);
  for(let i=0;i<1400;i++){ c.fillStyle=`rgba(${Math.random()<.5?"255,255,255":"110,80,40"},${Math.random()*.05})`; c.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*22,1); }
}

function drawCover(c,w,h){
  c.fillStyle="#1f3450"; c.fillRect(0,0,w,h);
  for(let i=0;i<9000;i++){ c.fillStyle=`rgba(${Math.random()<.6?"255,255,255":"0,0,0"},${Math.random()*.06})`; c.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*7,1); }
  c.strokeStyle="#d8b65e"; c.lineWidth=7; c.strokeRect(36,36,w-72,h-72);
  c.lineWidth=2; c.strokeRect(52,52,w-104,h-104);
  c.fillStyle="#f0d68f"; c.textAlign="center"; c.textBaseline="middle";
  c.font=`700 92px ${SERIF}`; c.fillText("大家的相冊",w/2,h*.42);
  c.font=`700 44px ${SERIF}`; c.fillText("轉 來 坐",w/2,h*.54);
  c.font=`600 30px ${SERIF}`; c.fillText("按右邊，或用手把書翻開",w/2,h*.86);
}

function drawInside(c,w,h){
  paperBase(c,w,h);
  c.fillStyle="#3a2a1c"; c.textAlign="center"; c.textBaseline="middle";
  c.font=`700 52px ${HAND}`; c.fillText("翻翻看，",w/2,h*.44);
  c.fillText("大家許了什麼願",w/2,h*.44+84);
}

function drawEnd(c,w,h,note){
  paperBase(c,w,h);
  c.fillStyle="#3a2a1c"; c.textAlign="center"; c.textBaseline="middle";
  c.font=`700 46px ${HAND}`; c.fillText("下一頁，留給下一位",w/2,h*.47);
  if(note){ c.font=`600 30px ${SERIF}`; c.fillText(note,w/2,h*.47+78); }
}

function drawEntry(c,w,h,page,img){
  paperBase(c,w,h);
  const maxW=w-120, maxH=h-290;
  if(img){
    const r=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight), iw=img.naturalWidth*r, ih=img.naturalHeight*r;
    const x=(w-iw)/2, y=44;
    c.save(); c.shadowColor="rgba(60,35,10,.5)"; c.shadowBlur=20; c.shadowOffsetY=7;
    c.fillStyle="#fbf5e6"; c.fillRect(x-10,y-10,iw+20,ih+20); c.restore();
    c.drawImage(img,x,y,iw,ih);
  }else{
    c.fillStyle="#6b5238"; c.font=`600 34px ${SERIF}`; c.textAlign="center"; c.textBaseline="middle"; c.fillText("翻開中…",w/2,maxH/2);
  }
  c.fillStyle="#3a2a1c"; c.textAlign="center"; c.textBaseline="alphabetic"; c.font=`700 36px ${HAND}`;
  const lines=wrapLines(c,`「${page.wish}」`,w-110,3);
  const top=h-212;
  lines.forEach((line,i)=>c.fillText(line,w/2,top+i*62));
  c.fillStyle="#6b5238"; c.font=`600 25px ${SERIF}`; c.fillText(`${page.scene}　${page.date}`,w/2,h-30);
}

class Book {
  constructor(mount){
    this.mount=mount;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.className="book3d";
    mount.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(30,1,.1,80);
    this.camX=0; this.focus=1;
    const hemi=new THREE.HemisphereLight(0xfff4e0,0x8a7458,1.75); this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffeccb,1.5);
    sun.position.set(-4,10,3); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.radius=7; sun.shadow.bias=-.0006; sun.shadow.normalBias=.02;
    Object.assign(sun.shadow.camera,{left:-7,right:7,top:6,bottom:-6,near:1,far:24});
    this.scene.add(sun);
    this.group=new THREE.Group(); this.scene.add(this.group);
    this.build();
    this.bindPointer();
    new ResizeObserver(()=>this.resize()).observe(mount);
    this.resize();
    this.clock=new THREE.Clock();
  }

  build(){
    const table=new THREE.Mesh(new THREE.PlaneGeometry(60,60).rotateX(-Math.PI/2),new THREE.ShadowMaterial({opacity:.26}));
    table.position.y=-.02; table.receiveShadow=true; this.scene.add(table);
    const cloth=new THREE.MeshStandardMaterial({color:0x1f3450,roughness:.85});
    const edge=new THREE.MeshStandardMaterial({color:0xe7dcc4,roughness:.9});
    this.coverL=this.box(cloth,-W/2-.02); this.coverR=this.box(cloth,W/2+.02);
    this.coverL.scale.set((W+.08)/W,.05,(H+.14)/H); this.coverR.scale.copy(this.coverL.scale);
    this.spine=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,H+.14),cloth); this.spine.position.y=.03; this.spine.receiveShadow=true; this.group.add(this.spine);
    this.blockL=this.box(edge,-W/2); this.blockR=this.box(edge,W/2);
    this.pageL=this.restPage(-1); this.pageR=this.restPage(1);
    const geo=new THREE.PlaneGeometry(W,H,COLS,ROWS).rotateX(-Math.PI/2);
    this.leafGeo=geo;
    this.front=new THREE.MeshStandardMaterial({roughness:.9,side:THREE.FrontSide});
    this.back=new THREE.MeshStandardMaterial({roughness:.9,side:THREE.BackSide});
    const front=new THREE.Mesh(geo,this.front), back=new THREE.Mesh(geo,this.back);
    front.castShadow=back.castShadow=true; front.receiveShadow=back.receiveShadow=true;
    this.leaf=new THREE.Group(); this.leaf.add(front,back); this.leaf.visible=false; this.group.add(this.leaf);
    // 翻頁時紙在桌上的影子看得到；把 UV 改成從書脊算起
    const uv=geo.attributes.uv;
    for(let r=0,i=0;r<=ROWS;r++) for(let c=0;c<=COLS;c++,i++) uv.setXY(i,c/COLS,1-r/ROWS);
  }

  box(material,x){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(W,1,H),material);
    mesh.position.x=x; mesh.castShadow=true; mesh.receiveShadow=true; this.group.add(mesh);
    return mesh;
  }

  // 攤平的那一頁：靠書脊處微微拱起
  restPage(side){
    const geo=new THREE.PlaneGeometry(W,H,24,1).rotateX(-Math.PI/2);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){ const s=pos.getX(i)+W/2; pos.setX(i,side>0?s:-W+s); pos.setY(i,hump(side>0?s:W-s)); }
    geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({roughness:.9}));
    mesh.receiveShadow=true; this.group.add(mesh);
    return mesh;
  }

  texture(index){
    const page=this.pages[index];
    if(!page) return null;
    if(page.tex) return page.tex;
    const canvas=document.createElement("canvas"); [canvas.width,canvas.height]=PAGE_PX;
    page.canvas=canvas;
    const tex=page.tex=new THREE.CanvasTexture(canvas);
    tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=this.renderer.capabilities.getMaxAnisotropy();
    this.paint(page);
    this.load(page);
    return tex;
  }

  paint(page){
    const c=page.canvas.getContext("2d"), [w,h]=PAGE_PX;
    if(page.kind==="cover") drawCover(c,w,h);
    else if(page.kind==="inside") drawInside(c,w,h);
    else if(page.kind==="end") drawEnd(c,w,h,page.note);
    else if(page.kind==="blank") paperBase(c,w,h);
    else drawEntry(c,w,h,page,page.img);
    page.tex.needsUpdate=true;
  }

  async load(page){
    if(page.img||page.kind||page.loading) return;
    page.loading=true;
    try{
      const src=page.src||(page.id&&this.loader?await this.loader(page.id):"");
      if(src){
        const img=new Image(); img.src=src; await img.decode();
        page.img=img; this.paint(page);
      }
    }catch(_){}
    page.loading=false;
  }

  setPage(mesh,block,cover,index){
    const tex=this.texture(index);
    mesh.visible=block.visible=cover.visible=!!tex;
    if(tex){ mesh.material.map=tex; mesh.material.needsUpdate=true; }
  }

  // 右邊是 at+1，左邊是 at；at=-1 是書還闔著
  layout(left=this.at,right=this.at+1){
    this.setPage(this.pageL,this.blockL,this.coverL,left);
    this.setPage(this.pageR,this.blockR,this.coverR,right);
    const total=Math.max(this.pages.length,2);
    const stack=(n)=>.03+.16*clamp(n/total);
    this.blockL.scale.y=stack(Math.max(0,left)); this.blockR.scale.y=stack(total-right);
    this.coverL.position.y=this.coverR.position.y=-.01;
    const base=.015; // 紙疊放在封面板上
    this.blockL.position.y=base+this.blockL.scale.y/2; this.blockR.position.y=base+this.blockR.scale.y/2;
    this.pageL.position.y=base+this.blockL.scale.y+.002; this.pageR.position.y=base+this.blockR.scale.y+.002;
    [index=>this.texture(index)].forEach(fn=>{ fn(this.at+2); fn(this.at+3); fn(this.at-1); });
  }

  startTurn(dir,grabbed=false){
    if(this.turn) return false;
    const a=this.at;
    if(dir>0 ? a+2>=this.pages.length : a<0) return false;
    const frontIndex=dir>0?a+1:a-1, backIndex=dir>0?a+2:a;
    const back=this.texture(backIndex).clone();
    back.wrapS=THREE.RepeatWrapping; back.repeat.x=-1; back.offset.x=1; back.needsUpdate=true;
    this.front.map=this.texture(frontIndex); this.back.map=back;
    this.front.needsUpdate=this.back.needsUpdate=true;
    this.turn={dir,p:dir>0?0:1,v:0,target:grabbed?null:(dir>0?1:0),stiff:frontIndex===0,backClone:back};
    if(dir>0) this.layout(a,a+3); else this.layout(a-2,a+1);
    this.leaf.visible=true;
    this.leaf.position.y=dir>0?this.pageR.position.y:this.pageL.position.y;
    this.bend(this.turn.p);
    window.RetroSfx?.page?.();
    return true;
  }

  // 紙不是整片轉：每一欄的角度沿著紙一路累加，紙邊晚一點跟上，再讓下角領先，就軟了
  bend(p){
    const T=this.turn, pos=this.leafGeo.attributes.position;
    const soft=T.stiff?.05:.95, ds=W/COLS, dz=H/ROWS;
    for(let r=0,i=0;r<=ROWS;r++){
      const n=r/ROWS;
      const pr=clamp(p+.1*Math.sin(Math.PI*p)*(2*n-1));
      const theta=Math.PI*pr, lag=soft*Math.sin(Math.PI*pr);
      let x=0,y=0;
      for(let c=0;c<=COLS;c++,i++){
        const s=c/COLS;
        const a=clamp(theta-T.dir*lag*Math.pow(s,1.3),0,Math.PI);
        pos.setXYZ(i,x,y+hump(c*ds)*Math.abs(Math.cos(theta))+.012,-H/2+r*dz);
        x+=Math.cos(a)*ds; y+=Math.sin(a)*ds;
      }
    }
    pos.needsUpdate=true;
    this.leafGeo.computeVertexNormals();
    this.leafGeo.computeBoundingSphere();
  }

  finishTurn(){
    const T=this.turn; this.turn=null;
    const landed=T.dir>0?T.p>=.5:T.p<.5;
    if(landed) this.at+=2*T.dir;
    this.leaf.visible=false;
    T.backClone.dispose();
    this.layout();
    this.report();
  }

  // 手機一次看一頁：先看左頁、再看右頁，翻到新的一張時鏡頭順著滑過去
  step(dir){
    if(this.turn) return;
    if(this.narrow && this.at>=0){
      if(dir>0 && this.focus<0){ this.focus=1; this.report(); return; }
      if(dir<0 && this.focus>0 && this.at>=1){ this.focus=-1; this.report(); return; }
    }
    if(this.startTurn(dir)) this.focus=dir>0?-1:1;
  }

  report(){
    const last=this.pages.length-1;
    document.getElementById("albumCount").textContent=`${(this.at+1)/2+1} / ${Math.floor(this.pages.length/2)+1}`;
    document.getElementById("albumPrev").disabled=this.at<0;
    document.getElementById("albumNext").disabled=this.at+2>last&&(!this.narrow||this.focus>0);
  }

  bindPointer(){
    const el=this.renderer.domElement;
    let down=null;
    const scale=()=>{ const v=this.toScreen(1)-this.toScreen(0); return Math.max(v*W*2,60); };
    el.addEventListener("pointerdown",e=>{ if(this.turn&&this.turn.target===null) return; down={x:e.clientX,t:performance.now(),moved:false}; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove",e=>{
      if(!down) return;
      const dx=e.clientX-down.x;
      if(!down.moved && Math.abs(dx)>10 && !this.turn){
        if(this.startTurn(dx<0?1:-1,true)){ down.moved=true; down.span=scale(); if(this.turn.dir>0) this.focus=-1; else this.focus=1; }
      }
      if(down.moved && this.turn){
        const T=this.turn, k=clamp(Math.abs(dx)/down.span);
        T.grab=T.dir>0?k:1-k;
      }
    });
    const up=e=>{
      if(!down) return;
      const {moved,t}=down, dx=e.clientX-down.x; down=null;
      if(moved && this.turn){
        const T=this.turn, quick=performance.now()-t<300, go=quick||(T.dir>0?T.p>.3:T.p<.7);
        T.target=T.dir>0?(go?1:0):(go?0:1); T.grab=undefined;
        return;
      }
      if(Math.abs(dx)<10) this.step(e.clientX<el.getBoundingClientRect().width/2&&this.at>=0?-1:1);
    };
    el.addEventListener("pointerup",up);
    el.addEventListener("pointercancel",up);
  }

  toScreen(x){
    const v=new THREE.Vector3(x,0,0).project(this.camera);
    return (v.x+1)/2*this.mount.clientWidth;
  }

  resize(){
    const w=this.mount.clientWidth, h=this.mount.clientHeight;
    if(!w||!h) return;
    this.renderer.setSize(w,h);
    this.camera.aspect=w/h;
    this.narrow=w/h<1;
    const need=this.narrow?W+.5:W*2+.9;
    const visW=6.3*this.camera.aspect;
    this.fit=Math.max(1,need/visW);
    this.camera.updateProjectionMatrix();
    if(this.pages) this.report();
  }

  open(list,loader,keep){
    this.loader=loader;
    if(keep&&this.pages){ this.pages.splice(0,this.pages.length,...list); }
    else{ this.pages=list; this.at=-1; this.focus=1; this.turn=null; this.leaf.visible=false; this.groupX=-W/2; }
    if(!keep||!this.turn) this.layout();
    this.report();
    this.clock.getDelta();
    this.renderer.setAnimationLoop(()=>this.frame());
  }

  close(){ this.renderer.setAnimationLoop(null); }

  frame(){
    const dt=Math.min(this.clock.getDelta(),.05), T=this.turn;
    if(T){
      if(T.grab!==undefined){
        T.p+=(T.grab-T.p)*.3; T.v=0;
      }else if(T.target!==null){
        // 彈簧帶動：起步慢、中間順、落下輕，不會機械式等速
        for(let i=0;i<3;i++){
          const h=dt/3;
          T.v+=(11*(T.target-T.p)-6.4*T.v)*h;
          T.p+=T.v*h;
        }
      }
      T.p=clamp(T.p);
      this.bend(T.p);
      if(T.target!==null && T.grab===undefined && Math.abs(T.target-T.p)<.004 && Math.abs(T.v)<.06){ T.p=T.target; this.finishTurn(); }
    }
    const closed=this.at<0&&!(T&&T.dir>0);
    const ended=!T&&this.at+1>=this.pages.length; // 翻到底，書也闔回正中間
    this.groupX+=((closed?-W/2:ended?W/2:0)-this.groupX)*.08;
    this.group.position.x=this.groupX;
    const goal=this.narrow&&!closed&&!ended?this.focus*W/2:0;
    this.camX+=(goal-this.camX)*.09;
    const d=this.fit||1;
    this.camera.position.set(this.camX,10.4*d,5.4*d);
    this.camera.lookAt(this.camX,0,.42*d);
    this.renderer.render(this.scene,this.camera);
  }
}

let book=null;
window.Book3D={
  open(list,loader,keep){
    try{
      if(!book) book=new Book(document.getElementById("bookStage"));
      book.open(list,loader,keep);
      window.Book3D.active=true;
      return true;
    }catch(error){
      console.warn("3D 相冊無法啟動，改用平面版",error);
      window.Book3D.active=false;
      return false;
    }
  },
  step(dir){ book?.step(dir); },
  close(){ book?.close(); },
  active:false
};
