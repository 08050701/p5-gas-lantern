"use strict";

// 自拍去背：在瀏覽器裡用 MediaPipe 把人切出來，疊到老照片上。照片不會為了去背上傳到任何地方。
const VISION_VERSION = "0.10.14";
const VISION_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}`;

const BgSwap = (() => {
  let segmenter=null, loading=null, lastTs=0;
  const maskCanvas=document.createElement("canvas");
  const maskCtx=maskCanvas.getContext("2d",{willReadFrequently:true});
  const person=document.createElement("canvas");
  const personCtx=person.getContext("2d");

  function load(){
    if(!loading) loading=(async()=>{
      const vision=await import(`${VISION_CDN}/vision_bundle.mjs`);
      const fileset=await vision.FilesetResolver.forVisionTasks(`${VISION_CDN}/wasm`);
      const options=delegate=>({
        baseOptions:{ modelAssetPath:"assets/selfie_multiclass.tflite", delegate },
        runningMode:"VIDEO", outputConfidenceMasks:true, outputCategoryMask:false
      });
      // 多類別模型分得出頭髮、皮膚、衣服、配件，比單純的人形模型準；有顯示晶片就用，手機才跟得上
      segmenter=await vision.ImageSegmenter.createFromOptions(fileset,options("GPU"))
        .catch(()=>vision.ImageSegmenter.createFromOptions(fileset,options("CPU")));
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
    const result=segmenter.segmentForVideo(video,ts);
    const masks=result.confidenceMasks;
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
    masks.forEach(m=>m.close());
    gap=Math.max(70,(performance.now()-now)*2.5); // 慢的手機少算幾次，畫面才不會卡
    return true;
  }

  function coverCrop(sourceW,sourceH,W,H){
    const ratio=W/H;
    let sw=sourceW, sh=sourceH;
    if(sourceW/sourceH>ratio) sw=sourceH*ratio; else sh=sourceW/ratio;
    return {sx:(sourceW-sw)/2, sy:(sourceH-sh)/2, sw, sh};
  }

  // 量出這張老照片的底色：平均色、最暗的黑，人才染得進同一卷底片
  const tones=new WeakMap(), probe=document.createElement("canvas"), probeCtx=probe.getContext("2d",{willReadFrequently:true});
  probe.width=32; probe.height=24;
  function sceneTone(scene){
    if(tones.has(scene)) return tones.get(scene);
    probeCtx.drawImage(scene,0,0,32,24);
    const data=probeCtx.getImageData(0,0,32,24).data, lums=[]; let r=0,g=0,b=0;
    for(let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; lums.push((data[i]*.3+data[i+1]*.59+data[i+2]*.11)/255); }
    const n=lums.length; r/=n; g/=n; b/=n;
    lums.sort((x,y)=>x-y);
    const dark=Math.round(lums[Math.floor(n*.06)]*255);
    const tone={color:`rgb(${r|0},${g|0},${b|0})`,lift:`rgb(${dark},${dark*.93|0},${dark*.84|0})`,lum:lums[n>>1]};
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

  let exposure=1, frameCount=0;
  function meterPerson(){
    probeCtx.clearRect(0,0,32,24);
    probeCtx.drawImage(person,0,0,32,24);
    const data=probeCtx.getImageData(0,0,32,24).data; let sum=0,count=0;
    for(let i=0;i<data.length;i+=4) if(data[i+3]>200){ sum+=data[i]*.3+data[i+1]*.59+data[i+2]*.11; count++; }
    return count ? sum/count/255 : 0;
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
  const PERSON_SCALE=.9; // 人往後退一點，站在景裡，不是貼在鏡頭前

  function placed(c,W,H){
    c.translate(W,0); c.scale(-1,1);
    c.translate(W*(1-PERSON_SCALE)/2,H*(1-PERSON_SCALE));
    c.scale(PERSON_SCALE,PERSON_SCALE);
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
    const vw=video.videoWidth, vh=video.videoHeight;
    const {sx,sy,sw,sh}=coverCrop(vw,vh,W,H);
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
    // 人的衣服、膚色都留著，只收一點飽和、靠一點現場的光色，像老照片手工上色
    fill("saturation","#808080",W,H,.2);
    if(exposure<1){ const v=Math.round(exposure*255); fill("multiply",`rgb(${v},${v},${v})`,W,H); }
    else{ const v=Math.round((exposure-1)*255); fill("screen",`rgb(${v},${v},${v})`,W,H); }
    fill("color",tone.color,W,H,.12);
    fill("lighten",tone.lift,W,H,.45);
    personCtx.globalCompositeOperation="destination-in";
    personCtx.save(); placed(personCtx,W,H);
    personCtx.drawImage(maskCanvas,sx*kx,sy*ky,sw*kx,sh*ky,0,0,W,H);
    personCtx.restore();
    // 現場的光落在人身上
    personCtx.globalCompositeOperation="source-atop"; personCtx.globalAlpha=.14;
    personCtx.imageSmoothingQuality="high";
    personCtx.drawImage(ambient(scene),0,0,W,H);
    personCtx.restore();
    if(frameCount++%20===0){
      const lum=meterPerson();
      if(lum>.02) exposure=Math.min(1.18,Math.max(.72,exposure*Math.pow(Math.min(.55,Math.max(.36,tone.lum))/lum,.5)));
    }
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
