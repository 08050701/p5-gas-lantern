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
      segmenter=await vision.ImageSegmenter.createFromOptions(fileset,{
        baseOptions:{ modelAssetPath:"assets/selfie_segmenter.tflite", delegate:"CPU" },
        runningMode:"VIDEO", outputConfidenceMasks:true, outputCategoryMask:false
      });
      return true;
    })().catch(error=>{ console.warn("去背載入失敗",error); loading=null; return false; });
    return loading;
  }

  // 更新人物遮罩；邊緣用 smoothstep 收軟，頭髮比較不會有鋸齒
  function updateMask(video){
    if(!segmenter || video.readyState<2) return false;
    const ts=Math.max(performance.now(),lastTs+1); lastTs=ts;
    const result=segmenter.segmentForVideo(video,ts);
    const masks=result.confidenceMasks;
    const mask=masks[masks.length-1];
    const {width,height}=mask, data=mask.getAsFloat32Array();
    if(maskCanvas.width!==width){ maskCanvas.width=width; maskCanvas.height=height; }
    const image=maskCtx.createImageData(width,height);
    for(let i=0;i<data.length;i++){
      const t=Math.min(1,Math.max(0,(data[i]-.35)/.4));
      image.data[i*4+3]=255*t*t*(3-2*t);
    }
    maskCtx.putImageData(image,0,0);
    masks.forEach(m=>m.close());
    return true;
  }

  function coverCrop(sourceW,sourceH,W,H){
    const ratio=W/H;
    let sw=sourceW, sh=sourceH;
    if(sourceW/sourceH>ratio) sw=sourceH*ratio; else sh=sourceW/ratio;
    return {sx:(sourceW-sw)/2, sy:(sourceH-sh)/2, sw, sh};
  }

  // 背景放老照片，人鏡像後疊上去，並帶一點舊照片的色調才融得進去
  function paint(ctx,video,scene,W,H){
    const bg=coverCrop(scene.naturalWidth,scene.naturalHeight,W,H);
    ctx.drawImage(scene,bg.sx,bg.sy,bg.sw,bg.sh,0,0,W,H);
    const vw=video.videoWidth, vh=video.videoHeight;
    const {sx,sy,sw,sh}=coverCrop(vw,vh,W,H);
    const kx=maskCanvas.width/vw, ky=maskCanvas.height/vh;
    if(person.width!==W||person.height!==H){ person.width=W; person.height=H; }
    personCtx.save();
    personCtx.clearRect(0,0,W,H);
    personCtx.translate(W,0); personCtx.scale(-1,1);
    personCtx.globalCompositeOperation="source-over";
    personCtx.drawImage(video,sx,sy,sw,sh,0,0,W,H);
    personCtx.globalCompositeOperation="destination-in";
    personCtx.drawImage(maskCanvas,sx*kx,sy*ky,sw*kx,sh*ky,0,0,W,H);
    personCtx.restore();
    ctx.save();
    ctx.filter="sepia(.32) saturate(.88) contrast(1.03)";
    ctx.drawImage(person,0,0);
    ctx.restore();
  }

  return { load, updateMask, paint, isReady:()=>!!segmenter };
})();
