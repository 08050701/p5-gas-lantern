"use strict";

const GAS_URL = "https://script.google.com/macros/s/AKfycby8mJZ1G2s4XTW0xiTznLSxSBp7n1jXhQnU9QoMmvzhUzW7Hol-3eryjZgvIMPZslikMQ/exec";
const SCENES = [
  { key:"garden", title:"晨光花園", icon:"✿", image:"assets/scene-garden.jpg", poem:"讓剛萌芽的念頭，在今天被溫柔看見。" },
  { key:"day", title:"晴日遠方", icon:"☀", image:"assets/scene-day.jpg", poem:"風很清楚，路也正在你腳下慢慢展開。" },
  { key:"sunset", title:"金色黃昏", icon:"◒", image:"assets/scene-sunset.jpg", poem:"把還沒說完的期待，交給晚霞替你收藏。" },
  { key:"night", title:"星夜湖畔", icon:"✦", image:"assets/scene-night.jpg", poem:"在最安靜的時候，你也一直被世界聽見。" },
  { key:"beach", title:"暮色海邊", icon:"≈", image:"assets/scene-beach.jpg", poem:"浪會帶走猶豫，也把新的勇氣送回來。" }
];
const FRAME_STYLES = {
  pearl:{ background:"#fff8ed", ink:"#6e4050", accent:"#e4ba75", name:"PEARL WISH" },
  coral:{ background:"#ee756b", ink:"#fffaf0", accent:"#ffd6ae", name:"CORAL WISH" },
  night:{ background:"#202044", ink:"#fff7e8", accent:"#d9b5ff", name:"STARRY WISH" }
};

const state = { screen:"gacha", scene:SCENES[0], wish:"", frame:"pearl", shots:[], collage:"", blessing:"", stream:null, listening:false, busy:false, bgFront:"a" };
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const screens = $$(".screen");
const progressDots = $$(".progress span");
const layerA = $(".scene-a");
const layerB = $(".scene-b");
const video = $("#cameraVideo");
const canvas = $("#captureCanvas");
const ctx = canvas.getContext("2d");

function init(){
  setScene(state.scene, false);
  bindEvents();
  preloadScenes();
}

function bindEvents(){
  $("#spinBtn").addEventListener("click", spinGacha);
  $("#spinAction").addEventListener("click", spinGacha);
  $("#rerollBtn").addEventListener("click", spinGacha);
  $("#wishBtn").addEventListener("click", () => showScreen("wish"));
  $("#typeBtn").addEventListener("click", openWishDialog);
  $("#micBtn").addEventListener("click", startSpeech);
  $("#toCameraBtn").addEventListener("click", enterCamera);
  $("#startShotsBtn").addEventListener("click", shootSequence);
  $("#retakeBtn").addEventListener("click", retake);
  $("#saveBtn").addEventListener("click", preparePickup);
  $("#downloadBtn").addEventListener("click", downloadCollage);
  $("#finishBtn").addEventListener("click", showFinale);
  $("#againBtn").addEventListener("click", resetExperience);
  $("#homeBtn").addEventListener("click", resetExperience);
  $$(".frame-chip").forEach(button => button.addEventListener("click", () => selectFrame(button)));
  $("#wishInput").addEventListener("input", updateCharCount);
  $("#wishForm").addEventListener("submit", submitTypedWish);
  window.addEventListener("pagehide", stopCamera);
}

function preloadScenes(){
  SCENES.forEach(scene => { const img = new Image(); img.src = scene.image; });
}

function showScreen(name){
  state.screen = name;
  screens.forEach(screen => screen.classList.toggle("is-active", screen.dataset.screen === name));
  const step = ({gacha:0,reveal:0,wish:1,camera:2,review:3,pickup:3,finale:3})[name] ?? 0;
  progressDots.forEach((dot,index) => dot.classList.toggle("is-active", index === step));
  if(name !== "camera") stopCamera();
  window.scrollTo({top:0,behavior:"smooth"});
}

function setScene(scene, animate=true){
  state.scene = scene;
  const incoming = state.bgFront === "a" ? layerB : layerA;
  const outgoing = state.bgFront === "a" ? layerA : layerB;
  incoming.style.backgroundImage = `url("${scene.image}")`;
  if(!animate){
    layerA.style.backgroundImage = `url("${scene.image}")`;
    layerA.style.opacity = "1";
    layerB.style.opacity = "0";
    state.bgFront = "a";
    return;
  }
  incoming.style.opacity = "1";
  incoming.classList.toggle("is-zoomed");
  outgoing.style.opacity = "0";
  state.bgFront = state.bgFront === "a" ? "b" : "a";
}

async function spinGacha(){
  if(state.busy) return;
  state.busy = true;
  const machine = $("#machineWrap");
  const capsule = $("#capsulePop");
  machine.classList.add("is-spinning");
  capsule.classList.remove("is-visible");
  const choices = SCENES.filter(scene => scene.key !== state.scene.key);
  const chosen = choices[Math.floor(Math.random()*choices.length)];
  for(let i=0;i<5;i++){
    await sleep(145);
    setScene(SCENES[(SCENES.indexOf(state.scene)+1)%SCENES.length]);
  }
  setScene(chosen);
  capsule.classList.add("is-visible");
  await sleep(780);
  machine.classList.remove("is-spinning");
  $("#sceneIcon").textContent = chosen.icon;
  $("#sceneTitle").textContent = chosen.title;
  $("#scenePoem").textContent = chosen.poem;
  showScreen("reveal");
  state.busy = false;
}

function openWishDialog(){
  const dialog = $("#wishDialog");
  $("#wishInput").value = state.wish;
  updateCharCount();
  dialog.showModal();
  setTimeout(() => $("#wishInput").focus(), 80);
}

function updateCharCount(){
  $("#charCount").textContent = `${$("#wishInput").value.length} / 160`;
}

function submitTypedWish(event){
  const submitter = event.submitter;
  if(submitter && submitter.value === "cancel") return;
  event.preventDefault();
  const wish = $("#wishInput").value.trim();
  if(!wish){ showToast("先寫下一句願望吧"); return; }
  acceptWish(wish);
  $("#wishDialog").close();
}

function acceptWish(wish){
  state.wish = wish.slice(0,160);
  $("#wishText").textContent = `「${state.wish}」`;
  $("#wishPreview").hidden = false;
  $("#micStatus").textContent = "已經好好收下你的願望";
  requestBlessing();
}

function startSpeech(){
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Recognition){
    $("#micStatus").textContent = "這個瀏覽器無法使用語音，已切換成打字";
    openWishDialog();
    return;
  }
  if(state.listening) return;
  const recognition = new Recognition();
  recognition.lang = "zh-TW";
  recognition.interimResults = true;
  recognition.continuous = false;
  state.listening = true;
  $("#micBtn").classList.add("is-listening");
  $("#micStatus").textContent = "正在聽…說完後停一下";
  let transcript = "";
  recognition.onresult = event => {
    transcript = [...event.results].map(result => result[0].transcript).join("");
    $("#micStatus").textContent = transcript || "正在聽…";
  };
  recognition.onerror = () => {
    finishListening();
    $("#micStatus").textContent = "沒有收到聲音，改用打字也可以";
    openWishDialog();
  };
  recognition.onend = () => {
    finishListening();
    if(transcript.trim()) acceptWish(transcript.trim());
    else $("#micStatus").textContent = "沒有聽清楚，再試一次或改用打字";
  };
  try{ recognition.start(); }catch(_){ finishListening(); openWishDialog(); }
}

function finishListening(){
  state.listening = false;
  $("#micBtn").classList.remove("is-listening");
}

async function requestBlessing(){
  state.blessing = "";
  $("#blessingText").textContent = "正在替你準備一句祝福…";
  try{
    const response = await fetch(GAS_URL,{method:"POST",body:JSON.stringify({wish:state.wish})});
    const data = await response.json();
    if(!data.ok) throw new Error(data.error || "祝福暫時沒有送達");
    state.blessing = String(data.reply || "願你慢慢靠近心裡真正想去的地方。").trim();
  }catch(_){
    state.blessing = "願你帶著今天的勇氣，慢慢靠近心裡真正想去的地方。";
  }
  $("#blessingText").textContent = state.blessing;
}

async function enterCamera(){
  if(!state.wish){ openWishDialog(); return; }
  showScreen("camera");
  await startCamera();
}

async function startCamera(){
  stopCamera();
  $("#startShotsBtn").disabled = true;
  $("#cameraPlaceholder").style.display = "grid";
  $("#cameraPlaceholder").innerHTML = "<span>正在開啟相機…</span>";
  try{
    state.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:960}},audio:false});
    video.srcObject = state.stream;
    await video.play();
    $("#cameraPlaceholder").style.display = "none";
    $("#startShotsBtn").disabled = false;
  }catch(_){
    $("#cameraPlaceholder").innerHTML = "<span>無法開啟相機<br><small>請允許相機權限後重新整理</small></span>";
    $("#startShotsBtn").disabled = true;
    $("#cameraNote").textContent = "需要相機權限才能真正拍照";
  }
}

function stopCamera(){
  if(state.stream){ state.stream.getTracks().forEach(track => track.stop()); state.stream = null; }
  video.srcObject = null;
}

function selectFrame(button){
  if(state.busy) return;
  state.frame = button.dataset.frame;
  $$(".frame-chip").forEach(chip => chip.classList.toggle("is-active", chip === button));
  $("#cameraStage").dataset.frame = state.frame;
}

async function shootSequence(){
  if(state.busy || !state.stream || video.readyState < 2) return;
  state.busy = true;
  state.shots = [];
  renderShotSlots();
  $("#startShotsBtn").disabled = true;
  for(let shot=0;shot<3;shot++){
    $("#cameraNote").textContent = `第 ${shot+1} 張，準備看鏡頭`;
    for(let n=3;n>=1;n--){
      $("#countdown").textContent = n;
      await sleep(720);
    }
    $("#countdown").textContent = "";
    state.shots.push(captureFrame());
    $("#shotCount").textContent = String(state.shots.length);
    $("#flash").classList.remove("fire");
    void $("#flash").offsetWidth;
    $("#flash").classList.add("fire");
    renderShotSlots();
    await sleep(850);
  }
  $("#cameraNote").textContent = "三張完成！正在排版…";
  state.collage = await buildCollage();
  $("#collagePreview").src = state.collage;
  $("#pickupPreview").src = state.collage;
  state.busy = false;
  stopCamera();
  showScreen("review");
}

function captureFrame(){
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 960;
  const out = document.createElement("canvas");
  out.width = 1200; out.height = 900;
  const c = out.getContext("2d");
  const sourceRatio = w/h;
  const targetRatio = out.width/out.height;
  let sx=0,sy=0,sw=w,sh=h;
  if(sourceRatio>targetRatio){ sw=h*targetRatio; sx=(w-sw)/2; }
  else{ sh=w/targetRatio; sy=(h-sh)/2; }
  c.translate(out.width,0); c.scale(-1,1);
  c.drawImage(video,sx,sy,sw,sh,0,0,out.width,out.height);
  return out.toDataURL("image/jpeg",.92);
}

function renderShotSlots(){
  $$("#shots span").forEach((slot,index) => {
    slot.style.backgroundImage = state.shots[index] ? `url(${state.shots[index]})` : "none";
  });
}

async function buildCollage(){
  canvas.width = 900; canvas.height = 1500;
  const style = FRAME_STYLES[state.frame];
  ctx.fillStyle = style.background; ctx.fillRect(0,0,900,1500);
  ctx.fillStyle = style.accent; ctx.fillRect(0,0,900,16);
  const images = await Promise.all(state.shots.map(loadImage));
  images.forEach((img,index) => drawCover(img,54,90+index*390,792,350));
  ctx.fillStyle = style.ink;
  ctx.textAlign = "left";
  ctx.font = "700 31px 'Noto Sans TC', sans-serif";
  ctx.fillText(style.name,54,1300);
  ctx.textAlign = "right";
  ctx.font = "600 27px 'Noto Sans TC', sans-serif";
  ctx.fillText(state.scene.title,846,1300);
  ctx.textAlign = "left";
  ctx.font = "600 25px 'Noto Serif TC', serif";
  drawWrappedText(`「${state.wish}」`,54,1352,792,38,3,style.ink);
  ctx.textAlign = "right";
  ctx.font = "500 17px 'Noto Sans TC', sans-serif";
  ctx.fillText(formatDate(new Date()),846,1460);
  drawSparkle(ctx,807,54,style.accent);
  return canvas.toDataURL("image/jpeg",.9);
}

function loadImage(src){
  return new Promise((resolve,reject) => { const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=src; });
}

function drawCover(img,x,y,w,h){
  const ratio=Math.max(w/img.width,h/img.height); const sw=w/ratio; const sh=h/ratio;
  ctx.save();
  roundedRect(ctx,x,y,w,h,22); ctx.clip();
  ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);
  ctx.restore();
}

function roundedRect(c,x,y,w,h,r){
  c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}

function drawWrappedText(text,x,y,maxWidth,lineHeight,maxLines,color){
  const chars=[...text]; let line=""; const lines=[];
  chars.forEach(char => { const test=line+char; if(ctx.measureText(test).width>maxWidth && line){lines.push(line);line=char;} else line=test; });
  if(line) lines.push(line);
  ctx.fillStyle=color;
  lines.slice(0,maxLines).forEach((value,index)=>ctx.fillText(value,x,y+index*lineHeight));
}

function drawSparkle(c,x,y,color){
  c.fillStyle=color; c.beginPath(); c.moveTo(x,y-20); c.lineTo(x+6,y-6); c.lineTo(x+20,y); c.lineTo(x+6,y+6); c.lineTo(x,y+20); c.lineTo(x-6,y+6); c.lineTo(x-20,y); c.lineTo(x-6,y-6); c.closePath(); c.fill();
}

function formatDate(date){
  return new Intl.DateTimeFormat("zh-TW",{year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}

async function retake(){
  state.shots=[]; state.collage=""; $("#shotCount").textContent="0"; renderShotSlots(); showScreen("camera"); await startCamera();
}

async function preparePickup(){
  if(state.busy || !state.collage) return;
  state.busy=true;
  showScreen("pickup");
  const mount=$("#qrMount");
  mount.innerHTML='<div class="qr-loading">照片上傳中…</div>';
  try{
    const response=await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action:"savePhoto",imageData:state.collage,wish:state.wish.slice(0,160),scene:state.scene.key})});
    const data=await response.json();
    if(!data.ok || !data.claimUrl) throw new Error(data.error || "沒有取得領取網址");
    renderQR(String(data.claimUrl),mount);
  }catch(error){
    mount.innerHTML='<div class="qr-loading">QR Code 暫時沒有送達<br>仍可按下方按鈕直接下載</div>';
    showToast(error.message || "照片上傳失敗");
  }
  state.busy=false;
}

function renderQR(text,mount){
  mount.innerHTML="";
  new QRCode(mount,{text,width:202,height:202,colorDark:"#281c31",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
}

function downloadCollage(){
  if(!state.collage) return;
  const link=document.createElement("a");
  link.download=`wish-strip-${Date.now()}.jpg`; link.href=state.collage; link.click();
}

function showFinale(){
  showScreen("finale");
  const sky=$("#lanternSky"); sky.innerHTML="";
  for(let i=0;i<18;i++){
    const lantern=document.createElement("i"); lantern.className="lantern";
    lantern.style.left=`${5+Math.random()*90}%`;
    lantern.style.setProperty("--dur",`${4+Math.random()*4}s`);
    lantern.style.setProperty("--drift",`${-80+Math.random()*160}px`);
    lantern.style.animationDelay=`${Math.random()*2}s`;
    lantern.style.transform=`scale(${.5+Math.random()*.8})`;
    sky.appendChild(lantern);
  }
}

function resetExperience(){
  stopCamera();
  Object.assign(state,{screen:"gacha",scene:SCENES[0],wish:"",frame:"pearl",shots:[],collage:"",blessing:"",stream:null,listening:false,busy:false});
  $("#wishPreview").hidden=true; $("#wishText").textContent=""; $("#wishInput").value="";
  $("#shotCount").textContent="0"; $("#blessingText").textContent="正在替你準備一句祝福…";
  $$(".frame-chip").forEach((chip,index)=>chip.classList.toggle("is-active",index===0));
  renderShotSlots(); setScene(SCENES[0]); showScreen("gacha");
}

let toastTimer;
function showToast(message){
  const toast=$("#toast"); toast.textContent=message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),3200);
}

init();
