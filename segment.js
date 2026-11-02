"use strict";

// 自拍去背：在瀏覽器裡用 MediaPipe 把人切出來，疊到老照片上。照片不會為了去背上傳到任何地方。
const VISION_VERSION = "0.10.14";
const VISION_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}`;

const BgSwap = (() => {
  let segmenter=null, loading=null, lastTs=0, cpuOnly=false;
  const maskCanvas=document.createElement("canvas");
  const maskCtx=maskCanvas.getContext("2d",{willReadFrequently:true});
  const person=document.createElement("canvas");
  const personCtx=person.getContext("2d");

  // 模型有 16MB，自己抓才知道進度，換 CPU 重建時也不用再下載一次
  let model=null, progress=null;
  async function fetchModel(){
    if(model) return model;
    const response=await fetch("assets/selfie_multiclass.tflite");
    if(!response.ok) throw new Error(`模型下載失敗 ${response.status}`);
    const total=+response.headers.get("content-length")||0, chunks=[], reader=response.body.getReader();
    let got=0;
    for(;;){
      const {done,value}=await reader.read();
      if(done) break;
      chunks.push(value); got+=value.length;
      if(total) progress?.(Math.min(99,Math.round(got/total*100)));
    }
    const bytes=new Uint8Array(got);
    let at=0; chunks.forEach(chunk=>{ bytes.set(chunk,at); at+=chunk.length; });
    return model=bytes;
  }

  function load(onProgress){
    if(onProgress) progress=onProgress;
    if(!loading) loading=(async()=>{
      const [vision,bytes]=await Promise.all([import(`${VISION_CDN}/vision_bundle.mjs`),fetchModel()]);
      const fileset=await vision.FilesetResolver.forVisionTasks(`${VISION_CDN}/wasm`);
      const create=delegate=>vision.ImageSegmenter.createFromOptions(fileset,{
        baseOptions:{ modelAssetBuffer:bytes.slice(), delegate },
        runningMode:"VIDEO", outputConfidenceMasks:true, outputCategoryMask:false
      });
      // 多類別模型分得出頭髮、皮膚、衣服、配件，比單純的人形模型準；有顯示晶片就用，手機才跟得上。
      // 有些手機的顯示晶片會卡住不回應，等不到就換 CPU
      const stuck=new Promise((_,reject)=>setTimeout(()=>reject(new Error("GPU 沒有回應")),12000));
      segmenter=await (cpuOnly ? create("CPU") : Promise.race([create("GPU"),stuck]).catch(()=>create("CPU")));
      return true;
    })().catch(error=>{ console.warn("去背載入失敗",error); loading=null; return false; });
    return loading;
  }

  // 更新人物遮罩：第一層是背景，其餘都算人。時間上做平滑，邊緣才不會一直抖
  let previous=null, lastRun=0, gap=70;
  function updateMask(video,force=false){
    if(!segmenter || video.readyState<2) return false;
    const now=performance.now();
    if(!force && now-lastRun<gap && previous) return true;
    lastRun=now;
    const ts=Math.max(now,lastTs+1); lastTs=ts;
    let masks;
    try{ masks=segmenter.segmentForVideo(video,ts).confidenceMasks; }
    catch(error){
      // 手機切到背景回來，顯示晶片可能被收走了：改用 CPU 重建
      console.warn("去背中斷",error); segmenter=null; loading=null; cpuOnly=true; load();
      return false;
    }
    const {width,height}=masks[0], background=masks[0].getAsFloat32Array();
    if(maskCanvas.width!==width||!previous){ maskCanvas.width=width; maskCanvas.height=height; previous=new Float32Array(background.length); }
    const image=maskCtx.createImageData(width,height);
    for(let i=0;i<background.length;i++){
      const value=1-background[i];
      // 動得大的地方直接跟上，幾乎沒動的地方才平均
      const follow=Math.min(1,.45+Math.abs(value-previous[i])*2);
      const mixed=previous[i]+(value-previous[i])*follow;
      previous[i]=mixed;
      const t=Math.min(1,Math.max(0,(mixed-.42)/.3));
      image.data[i*4+3]=255*t*t*(3-2*t);
    }
    maskCtx.putImageData(image,0,0);
    bounds=personBounds(width,height);
    masks.forEach(m=>m.close());
    gap=Math.max(70,(performance.now()-now)*2.5); // 慢的手機少算幾次，畫面才不會卡
    return true;
  }

  // 人在鏡頭畫面裡的範圍（0–1）。幾個雜點不算，要整排有人才算
  function personBounds(width,height){
    const rows=new Uint16Array(height), cols=new Uint16Array(width);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(previous[y*width+x]>.6){ rows[y]++; cols[x]++; }
    const top=rows.findIndex(n=>n>2), left=cols.findIndex(n=>n>2), right=width-1-[...cols].reverse().findIndex(n=>n>2);
    return top<0 ? null : {top:top/height, left:left/width, right:(right+1)/width};
  }

  function coverCrop(sourceW,sourceH,W,H){
    const ratio=W/H;
    let sw=sourceW, sh=sourceH;
    if(sourceW/sourceH>ratio) sw=sourceH*ratio; else sh=sourceW/ratio;
    return {sx:(sourceW-sw)/2, sy:(sourceH-sh)/2, sw, sh};
  }

  // 量這張場景：地面的色溫、天空的顏色、光從哪邊來、哪一側比較空
  const tones=new WeakMap(), probe=document.createElement("canvas"), probeCtx=probe.getContext("2d",{willReadFrequently:true});
  probe.width=32; probe.height=24;
  const lumOf=(r,g,b)=>(r*.3+g*.59+b*.11)/255;
  function sceneTone(scene){
    if(tones.has(scene)) return tones.get(scene);
    probeCtx.drawImage(scene,0,0,32,24);
    const data=probeCtx.getImageData(0,0,32,24).data, ground=[0,0,0], sky=[0,0,0], lums=[];
    let groundN=0, skyN=0, left=0, right=0, busyL=0, busyR=0;
    for(let y=0;y<24;y++) for(let x=0;x<32;x++){
      const i=(y*32+x)*4, r=data[i], g=data[i+1], b=data[i+2], lum=lumOf(r,g,b);
      lums.push(lum);
      if(y>=8){ ground[0]+=r; ground[1]+=g; ground[2]+=b; groundN++; }
      if(y<6){ sky[0]+=r; sky[1]+=g; sky[2]+=b; skyN++; }
      if(x<16) left+=lum; else right+=lum;
      if(x>0 && y>5 && y<20){ const edge=Math.abs(lum-lumOf(data[i-4],data[i-3],data[i-2])); if(x<16) busyL+=edge; else busyR+=edge; }
    }
    lums.sort((x,y)=>x-y);
    const dark=Math.round(lums[Math.floor(lums.length*.06)]*255);
    const rgb=ground.map(v=>v/groundN), tone={
      rgb, lum:lumOf(...rgb), sky:`rgb(${sky.map(v=>v/skyN|0).join(",")})`, floor:`rgb(${rgb.map(v=>v|0).join(",")})`,
      lift:`rgb(${dark},${dark*.93|0},${dark*.84|0})`, light:(right-left)/(right+left),
      side:busyL<busyR?-1:1 // 人站在比較空的那一側，景點留給畫面
    };
    tones.set(scene,tone);
    return tone;
  }

  // 把老照片糊成一片光：只留下光從哪邊來、不留下任何景物，人身上才不會透出背景
  const glow=new WeakMap();
  function ambient(scene){
    if(!glow.has(scene)){
      const small=document.createElement("canvas"); small.width=6; small.height=4;
      small.getContext("2d").drawImage(scene,0,0,6,4);
      glow.set(scene,small);
    }
    return glow.get(scene);
  }

  // 色溫回授：量人身上的顏色，每隔幾張慢慢推向現場的光色，人就會跟著照片的色調走
  let gains=[1,1,1], gainScene=null, frameCount=0;
  function followScene(tone){
    probeCtx.clearRect(0,0,32,24);
    probeCtx.drawImage(person,0,0,32,24);
    const data=probeCtx.getImageData(0,0,32,24).data, sum=[0,0,0]; let count=0;
    for(let i=0;i<data.length;i+=4) if(data[i+3]>200){ sum[0]+=data[i]; sum[1]+=data[i+1]; sum[2]+=data[i+2]; count++; }
    if(count<8) return;
    const mean=sum.map(v=>Math.max(4,v/count)), level=Math.min(.56,Math.max(.36,tone.lum));
    const sceneLum=Math.max(.05,tone.lum*255);
    gains=gains.map((gain,c)=>{
      const target=level*255*(.45+.55*tone.rgb[c]/sceneLum);
      return Math.min(1.3,Math.max(.68,gain*Math.pow(target/mean[c],.4)));
    });
  }

  // 舊底片的顆粒，整張一起蓋上去，人和背景才像同一次曝光
  const grain=document.createElement("canvas"); grain.width=grain.height=220;
  {
    const g=grain.getContext("2d"), image=g.createImageData(220,220);
    for(let i=0;i<image.data.length;i+=4){ const v=128+(Math.random()-.5)*150; image.data[i]=image.data[i+1]=image.data[i+2]=v; image.data[i+3]=255; }
    g.putImageData(image,0,0);
  }
  const soft=document.createElement("canvas"), softCtx=soft.getContext("2d");
  const cast=document.createElement("canvas"), castCtx=cast.getContext("2d");
  // 出遊照的人不會佔滿畫面：站在側邊三分之一、半身入鏡，眼睛差不多在地平線上
  const PERSON_SCALE=.72, PERSON_SHIFT=.17;
  let bounds=null, size=PERSON_SCALE, offset=(1-PERSON_SCALE)/2;

  const roomFrom=(gap,start,span)=>Math.min(1,Math.max(0,(gap-start)/span));

  // 鏡頭畫面縮小後，它的邊就落在照片中間，人一碰到就像被刀切：
  // 所以人靠近鏡頭哪一邊，那一邊就貼回照片邊緣；頭頂碰到鏡頭上緣就放回原尺寸
  function frameFor(crop,video,side){
    const view=bounds && {
      top:(bounds.top*video.videoHeight-crop.sy)/crop.sh,
      left:1-(bounds.right*video.videoWidth-crop.sx)/crop.sw,
      right:1-(bounds.left*video.videoWidth-crop.sx)/crop.sw
    };
    const top=view?roomFrom(view.top,.03,.1):1, left=view?roomFrom(view.left,.02,.08):1, right=view?roomFrom(1-view.right,.02,.08):1;
    const scale=1-(1-PERSON_SCALE)*Math.min(top,left+right,1);
    const spare=1-scale, center=view?(view.left+view.right)/2:.5;
    const wanted=.5+side*PERSON_SHIFT-scale*center;
    return {scale,x:Math.min(spare*left,Math.max(spare*(1-right),Math.min(spare,Math.max(0,wanted))))};
  }

  function placed(c,W,H){
    c.translate(W*(offset+size),H*(1-size));
    c.scale(-size,size);
  }

  // 手機人像模式的背景：縮小再放大，只糊一點，景還認得出來
  const depth=new WeakMap();
  function portraitBackground(scene,bg,W,H){
    if(!depth.has(scene)){
      const small=document.createElement("canvas"); small.width=W>>2; small.height=H>>2;
      const c=small.getContext("2d"); c.imageSmoothingQuality="high";
      c.drawImage(scene,bg.sx,bg.sy,bg.sw,bg.sh,0,0,small.width,small.height);
      depth.set(scene,small);
    }
    return depth.get(scene);
  }

  function fill(mode,color,W,H,alpha=1){
    personCtx.globalCompositeOperation=mode; personCtx.globalAlpha=alpha;
    personCtx.fillStyle=color; personCtx.fillRect(0,0,W,H);
    personCtx.globalAlpha=1;
  }

  // iPhone 的 canvas 沒有 ctx.filter，調色全部用混合模式做
  function paint(ctx,video,scene,W,H){
    const tone=sceneTone(scene);
    const bg=coverCrop(scene.naturalWidth,scene.naturalHeight,W,H);
    ctx.drawImage(scene,bg.sx,bg.sy,bg.sw,bg.sh,0,0,W,H);
    ctx.save(); ctx.globalAlpha=.55; ctx.imageSmoothingQuality="high";
    ctx.drawImage(portraitBackground(scene,bg,W,H),0,0,W,H);
    ctx.restore();
    if(gainScene!==scene){ gainScene=scene; gains=[1,1,1]; }
    const vw=video.videoWidth, vh=video.videoHeight;
    const {sx,sy,sw,sh}=coverCrop(vw,vh,W,H);
    // 預覽慢慢跟，人才不會看到畫面在跳；拍下去那張直接到位
    const frame=frameFor({sx,sy,sw,sh},video,tone.side), stage=ctx.canvas.closest?.(".camera-stage"), follow=stage?.2:1;
    size+=(frame.scale-size)*follow; offset+=(frame.x-offset)*follow;
    if(stage){
      stage.style.setProperty("--person-x",`${((offset+size/2-.5)*100).toFixed(1)}%`);
      stage.style.setProperty("--person-size",size.toFixed(3));
    }
    const kx=maskCanvas.width/vw, ky=maskCanvas.height/vh;
    if(person.width!==W||person.height!==H){ person.width=W; person.height=H; }
    personCtx.save();
    personCtx.globalCompositeOperation="copy";
    personCtx.clearRect(0,0,W,H);
    personCtx.save(); placed(personCtx,W,H);
    personCtx.drawImage(video,sx,sy,sw,sh,0,0,W,H);
    personCtx.restore();
    // 老鏡頭沒那麼銳利：縮小再放大，蓋掉手機相機的銳利感
    const sw2=W>>1, sh2=H>>1;
    if(soft.width!==sw2){ soft.width=sw2; soft.height=sh2; }
    softCtx.drawImage(person,0,0,sw2,sh2);
    personCtx.globalCompositeOperation="source-atop"; personCtx.globalAlpha=.35;
    personCtx.drawImage(soft,0,0,W,H);
    personCtx.globalAlpha=1;
    // 留住人的顏色，但白平衡和亮度跟著場景走
    const peak=Math.max(...gains), shade=gains.map(v=>Math.round(v/peak*255));
    fill("multiply",`rgb(${shade.join(",")})`,W,H);
    if(peak>1){ const v=Math.round((peak-1)*255); fill("screen",`rgb(${v},${v},${v})`,W,H); }
    fill("lighten",tone.lift,W,H,.2);
    personCtx.globalCompositeOperation="destination-in";
    personCtx.save(); placed(personCtx,W,H);
    personCtx.drawImage(maskCanvas,sx*kx,sy*ky,sw*kx,sh*ky,0,0,W,H);
    personCtx.restore();
    // 現場的光落在人身上：頭頂有天光、腳邊有地面反光、背光那側暗一點
    const air=personCtx.createLinearGradient(0,H*.3,0,H);
    air.addColorStop(0,tone.sky); air.addColorStop(.55,"rgba(128,128,128,0)"); air.addColorStop(1,tone.floor);
    personCtx.globalCompositeOperation="source-atop"; personCtx.globalAlpha=.16;
    personCtx.fillStyle=air; personCtx.fillRect(0,0,W,H);
    const dim=Math.min(.34,Math.abs(tone.light)*2.4);
    if(dim>.02){
      const from=tone.light>0?0:W, across=personCtx.createLinearGradient(from,0,W-from,0);
      across.addColorStop(0,`rgba(24,14,8,${dim})`); across.addColorStop(.6,"rgba(24,14,8,0)");
      personCtx.globalAlpha=1; personCtx.fillStyle=across; personCtx.fillRect(0,0,W,H);
    }
    personCtx.restore();
    if(frameCount++%6===0) followScene(tone);
    ctx.save();
    // 人在地上的影子，落在背景上
    const sw4=W>>3, sh4=H>>3;
    if(cast.width!==sw4){ cast.width=sw4; cast.height=sh4; }
    castCtx.globalCompositeOperation="copy"; castCtx.drawImage(person,0,0,sw4,sh4);
    castCtx.globalCompositeOperation="source-in"; castCtx.fillStyle="#2a1b10"; castCtx.fillRect(0,0,sw4,sh4);
    ctx.globalAlpha=.34; ctx.imageSmoothingQuality="high";
    ctx.drawImage(cast,-W*.014,H*.016,W,H);
    ctx.globalAlpha=1;
    ctx.drawImage(person,0,0);
    // 整張一起老：顆粒、四角暗角、幾點灰塵
    ctx.globalCompositeOperation="overlay"; ctx.globalAlpha=.12;
    ctx.fillStyle=ctx.createPattern(grain,"repeat");
    const ox=Math.random()*220, oy=Math.random()*220;
    ctx.translate(ox,oy); ctx.fillRect(-ox,-oy,W,H); ctx.translate(-ox,-oy);
    ctx.globalCompositeOperation="source-over"; ctx.globalAlpha=1;
    const edge=ctx.createRadialGradient(W/2,H*.46,H*.42,W/2,H*.46,W*.72);
    edge.addColorStop(0,"rgba(30,18,8,0)"); edge.addColorStop(1,"rgba(30,18,8,.3)");
    ctx.fillStyle=edge; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(250,240,220,.3)";
    for(let i=0;i<3;i++) ctx.fillRect(Math.random()*W,Math.random()*H,1+Math.random()*2,1+Math.random()*2);
    ctx.restore();
  }

  return { load, updateMask, paint, isReady:()=>!!segmenter };
})();
