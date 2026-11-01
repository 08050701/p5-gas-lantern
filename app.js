"use strict";

const GAS_URL = "https://script.google.com/macros/s/AKfycby8mJZ1G2s4XTW0xiTznLSxSBp7n1jXhQnU9QoMmvzhUzW7Hol-3eryjZgvIMPZslikMQ/exec";
const SCENES = [
  { key:"alishan", title:"阿里山小火車", icon:"阿里山", image:"assets/taiwan-alishan.jpg", poem:"蒸汽火車，載著木頭下山。" },
  { key:"tamsui", title:"淡水河渡船", icon:"淡水", image:"assets/taiwan-tamsui.jpg", poem:"帆船慢慢過河，遠遠就是大橋。" },
  { key:"beach", title:"淡水海水浴場", icon:"淡水", image:"assets/taiwan-beach.jpg", poem:"對面就是觀音山。" },
  { key:"xiluo", title:"西螺大橋", icon:"西螺", image:"assets/taiwan-xiluo.jpg", poem:"大橋通車那一天，大家都來看。" },
  { key:"village", title:"山村吊橋", icon:"山村", image:"assets/taiwan-village.jpg", poem:"牽著豬過吊橋的日子。" },
  { key:"sunmoon", title:"日月潭", icon:"日月潭", image:"assets/taiwan-sunmoon.jpg", poem:"小舟划過湖面。" },
  { key:"qingshui", title:"清水斷崖", icon:"東海岸", image:"assets/taiwan-qingshui.jpg", poem:"山壁直直落進海裡。" },
  { key:"puli", title:"烏牛欄吊橋", icon:"埔里", image:"assets/taiwan-puli.jpg", poem:"車子慢慢開過吊橋。" },
  { key:"keelungbeach", title:"基隆海水浴場", icon:"基隆", image:"assets/taiwan-keelungbeach.jpg", poem:"夏天，大家都來玩水。" },
  { key:"keelung", title:"基隆港", icon:"基隆", image:"assets/taiwan-keelung.jpg", poem:"大船進港的地方。" },
  { key:"chihkan", title:"赤崁樓", icon:"臺南", image:"assets/taiwan-chihkan.jpg", poem:"府城的老樓閣。" },
  { key:"gaoping", title:"下淡水溪鐵橋", icon:"高屏", image:"assets/taiwan-gaoping.jpg", poem:"長長的鐵橋跨過大溪。" },
  { key:"harvest", title:"農村割稻", icon:"農村", image:"assets/taiwan-harvest.jpg", poem:"稻子熟了，全家都下田。" },
  { key:"lvchuan", title:"臺中綠川", icon:"臺中", image:"assets/taiwan-lvchuan.jpg", poem:"柳樹沿著河邊垂下來。" },
  { key:"longshan", title:"艋舺龍山寺", icon:"艋舺", image:"assets/taiwan-longshan.jpg", poem:"來這裡拜拜，求個平安。" },
  { key:"guanziling", title:"關子嶺溫泉", icon:"關子嶺", image:"assets/taiwan-guanziling.jpg", poem:"山裡的溫泉旅社。" },
  { key:"mtali", title:"阿里山村落", icon:"阿里山", image:"assets/taiwan-mtali.jpg", poem:"山腰上的小村子，炊煙慢慢升起。" },
  { key:"yushan", title:"阿里山望玉山", icon:"阿里山", image:"assets/taiwan-yushan.jpg", poem:"沿著鐵道走，遠遠看得到玉山。" },
  { key:"xiziwan", title:"西子灣海水浴場", icon:"高雄", image:"assets/taiwan-xiziwan.jpg", poem:"彩旗飄飄，沙灘上好熱鬧。" },
  { key:"cijin", title:"旗後海水浴場", icon:"旗後", image:"assets/taiwan-cijin.jpg", poem:"浪打過來，大家笑成一團。" },
  { key:"yancheng", title:"高雄銀座", icon:"鹽埕", image:"assets/taiwan-yancheng.jpg", poem:"穿得漂漂亮亮，來逛街。" },
  { key:"fengshan", title:"鳳山街景", icon:"鳳山", image:"assets/taiwan-fengshan.jpg", poem:"從高處看，整條街都在眼前。" },
  { key:"shimen", title:"牡丹石門", icon:"屏東", image:"assets/taiwan-shimen.jpg", poem:"兩邊山壁夾著一條溪。" },
  { key:"jiaoban", title:"角板山台車", icon:"桃園", image:"assets/taiwan-jiaoban.jpg", poem:"推著小台車，過山邊的木橋。" }
];

const WISH_MAX = 300;
const sceneImages = {};
const state = { liveRun:0, screen:"gacha", scene:SCENES[0], wish:"", frame:"album", shots:[], collage:"", blessing:"", blessingPromise:null, stream:null, listening:false, busy:false, bgFront:"a" };
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
  $("#musicBtn").addEventListener("click", toggleMusic);
  document.addEventListener("pointerdown", autoStartMusic, {once:true});
  $("#spinBtn").addEventListener("click", spinGacha);
  $("#spinAction").addEventListener("click", spinGacha);
  $("#rerollBtn").addEventListener("click", rerollGacha);
  $("#wishBtn").addEventListener("click", () => showScreen("wish"));
  $("#typeBtn").addEventListener("click", openWishDialog);
  $("#micBtn").addEventListener("click", startSpeech);
  $("#toCameraBtn").addEventListener("click", enterCamera);
  $("#startShotsBtn").addEventListener("click", shootSequence);
  $("#poseRollBtn").addEventListener("click", rollPoses);
  $("#lightBtn").addEventListener("click", lightLantern);
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

// 瀏覽器規定要先按一下才能出聲，所以第一次點畫面就開始放
function autoStartMusic(event){
  if(event.target.closest("#musicBtn")) return;
  RetroMusic.start().then(renderMusicButton);
}

function toggleMusic(){
  RetroMusic.toggle();
  renderMusicButton();
}

function renderMusicButton(){
  const on = RetroMusic.isPlaying();
  $("#musicBtn").textContent = `♪ 雨夜花：${on ? "開" : "關"}`;
  $("#musicBtn").setAttribute("aria-pressed", String(on));
}

function preloadScenes(){
  SCENES.forEach(scene => { const img = new Image(); img.src = scene.image; sceneImages[scene.key] = img; });
}

function showScreen(name){
  state.screen = name;
  screens.forEach(screen => screen.classList.toggle("is-active", screen.dataset.screen === name));
  const step = ({gacha:0,reveal:0,wish:1,camera:2,review:3,pickup:3,finale:3})[name] ?? 0;
  progressDots.forEach((dot,index) => dot.classList.toggle("is-active", index === step));
  if(name !== "camera") stopCamera();
  if(name !== "finale") window.LanternSky?.close();
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
  const choices = SCENES.filter(scene => scene.key !== state.scene.key);
  const chosen = choices[Math.floor(Math.random()*choices.length)];
  $(".hero").classList.add("is-spinning");
  if(window.Gacha3D){
    // 背景隱藏時動畫會停，等太久就直接揭曉
    await Promise.race([window.Gacha3D.spin(chosen.title),sleep(16000)]);
  }else{
    const machine = $("#machineWrap");
    machine.classList.add("is-spinning");
    await sleep(1500);
    machine.classList.remove("is-spinning");
  }
  // 開蛋的光慢慢鋪滿，再換到揭曉畫面，不要硬切
  const wipe = $("#sceneWipe");
  wipe.classList.add("is-on");
  await sleep(520);
  setScene(chosen);
  $("#sceneIcon").textContent = chosen.icon;
  $("#sceneTitle").textContent = chosen.title;
  $("#scenePoem").textContent = chosen.poem;
  showScreen("reveal");
  $(".hero").classList.remove("is-spinning");
  window.Gacha3D?.reset();
  await sleep(80);
  wipe.classList.remove("is-on");
  state.busy = false;
}

async function rerollGacha(){
  if(state.busy) return;
  showScreen("gacha");
  await sleep(420);
  spinGacha();
}

function openWishDialog(){
  const dialog = $("#wishDialog");
  $("#wishInput").value = state.wish;
  updateCharCount();
  dialog.showModal();
  setTimeout(() => $("#wishInput").focus(), 80);
}

function updateCharCount(){
  $("#charCount").textContent = `${$("#wishInput").value.length} / ${WISH_MAX}`;
}

function submitTypedWish(event){
  const submitter = event.submitter;
  if(submitter && submitter.value === "cancel") return;
  event.preventDefault();
  const wish = $("#wishInput").value.trim();
  if(!wish){ showToast("請先寫下願望"); return; }
  acceptWish(wish);
  $("#wishDialog").close();
}

function acceptWish(wish){
  state.wish = wish.slice(0,WISH_MAX);
  $("#wishText").textContent = `「${state.wish}」`;
  $("#wishPreview").hidden = false;
  $("#micBtn").hidden = true;
  $("#typeBtn").hidden = true;
  $("#micStatus").textContent = "收到了";
  state.blessingPromise = requestBlessing();
  BgSwap.load();
}

// 長輩講話會停頓：講到一半停下來不算講完。
// 一直聽到按「說完了」，或安靜夠久、或到時間上限才結束。
const LISTEN_MAX = 120000, SILENCE_AFTER_SPEECH = 9000, SILENCE_NO_SPEECH = 20000;

function startSpeech(){
  if(state.listening){ state.stopListening?.(); return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Recognition){
    $("#micStatus").textContent = "這個瀏覽器無法使用語音，已切換成打字";
    openWishDialog();
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "zh-TW";
  recognition.interimResults = true;
  recognition.continuous = true;
  const parts = [];
  let interim = "", silenceTimer = 0, maxTimer = 0, stopping = false;
  const heard = () => (parts.join("")+interim).trim();
  const keepWaiting = () => { clearTimeout(silenceTimer); silenceTimer = setTimeout(stop, heard() ? SILENCE_AFTER_SPEECH : SILENCE_NO_SPEECH); };
  const stop = () => { stopping = true; clearTimeout(silenceTimer); clearTimeout(maxTimer); try{ recognition.stop(); }catch(_){ finish(); } };
  const finish = () => {
    clearTimeout(silenceTimer); clearTimeout(maxTimer);
    state.stopListening = null;
    finishListening();
    if(heard()) acceptWish(heard());
    else $("#micStatus").textContent = "沒有聽清楚，再試一次或改用打字";
  };
  state.stopListening = stop;
  state.listening = true;
  $("#micBtn").classList.add("is-listening");
  $(".mic-icon").textContent = "說完了";
  $("#micStatus").textContent = "慢慢說，說完按一下";
  recognition.onresult = event => {
    interim = "";
    for(let i=event.resultIndex;i<event.results.length;i++){
      const text = event.results[i][0].transcript;
      if(!event.results[i].isFinal){ interim += text; continue; }
      // 有些手機會把同一句連續回報，只留最長的那次
      const last = parts[parts.length-1];
      if(last && text.startsWith(last)) parts[parts.length-1] = text;
      else if(!last || !last.endsWith(text)) parts.push(text);
    }
    $("#micStatus").textContent = heard() || "正在聽…";
    keepWaiting();
  };
  recognition.onerror = event => {
    if(event.error === "no-speech" || event.error === "aborted") return;
    stopping = true;
    clearTimeout(silenceTimer); clearTimeout(maxTimer);
    state.stopListening = null;
    finishListening();
    if(heard()){ acceptWish(heard()); return; }
    $("#micStatus").textContent = "沒有收到聲音，改用打字也可以";
    openWishDialog();
  };
  // 瀏覽器自己斷線時接回去，繼續聽
  recognition.onend = () => {
    if(!state.listening) return;
    interim && parts.push(interim);
    interim = "";
    if(stopping) finish();
    else try{ recognition.start(); }catch(_){ finish(); }
  };
  maxTimer = setTimeout(stop,LISTEN_MAX);
  keepWaiting();
  try{ recognition.start(); }catch(_){ finishListening(); openWishDialog(); }
}

function finishListening(){
  state.listening = false;
  $("#micBtn").classList.remove("is-listening");
  $(".mic-icon").textContent = "說話";
}

async function requestBlessing(){
  state.blessing = "";
  $("#blessingText").textContent = "正在寫祝福…";
  $("#inlineBlessing").textContent = "請稍等…";
  $(".inline-blessing span").textContent = "正在寫祝福";
  try{
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action:"bless",wish:state.wish}),signal:controller.signal});
    clearTimeout(timer);
    const data = await response.json();
    if(!data.ok) throw new Error(data.error || "祝福暫時沒有送達");
    state.blessing = String(data.reply || "願您平安健康，天天歡喜。").trim();
    $(".inline-blessing span").textContent = "給您的祝福";
  }catch(error){
    state.blessing = "願您平安健康，天天歡喜。";
    $(".inline-blessing span").textContent = "給您的祝福";
  }
  $("#blessingText").textContent = state.blessing;
  $("#inlineBlessing").textContent = state.blessing;
  return state.blessing;
}

async function enterCamera(){
  if(!state.wish){ openWishDialog(); return; }
  showScreen("camera");
  rollPoses();
  await startCamera();
}

function rollPoses(){
  if(state.busy) return;
  const set = PoseGuide.next();
  $("#poseTitle").textContent = `${set.title}`;
  $("#poseList").innerHTML = PoseGuide.labels(set.poses).map((label,i)=>`<li>${i+1}. ${label}</li>`).join("");
  highlightPose(0);
}

function highlightPose(shot){
  const set = PoseGuide.current();
  $$("#poseList li").forEach((item,i) => item.classList.toggle("is-now",i===shot));
  PoseGuide.show($("#poseGuide"),set.poses[shot]);
}

function sceneImage(){
  const img = sceneImages[state.scene.key];
  return img && img.complete && img.naturalWidth ? img : null;
}

// 相機畫面一進來就換背景，看到的就是拍出來的樣子
function startLivePreview(){
  const live = $("#liveCanvas");
  const liveCtx = live.getContext("2d");
  const stage = $("#cameraStage");
  const run = ++state.liveRun;
  let last = 0;
  const loop = now => {
    if(run !== state.liveRun || !state.stream) return;
    requestAnimationFrame(loop);
    if(now-last < 70) return;
    last = now;
    const scene = sceneImage();
    if(!scene || !BgSwap.updateMask(video)) return;
    BgSwap.paint(liveCtx,video,scene,live.width,live.height);
    stage.classList.add("has-live");
  };
  requestAnimationFrame(loop);
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
    $("#cameraPlaceholder").innerHTML = "<span>正在換背景…</span>";
    const swapped = await Promise.race([BgSwap.load(),sleep(15000).then(()=>false)]);
    $("#cameraPlaceholder").style.display = "none";
    $("#startShotsBtn").disabled = false;
    if(swapped) startLivePreview();
    else $("#cameraNote").textContent = "背景換不了，先用原本的畫面拍";
  }catch(_){
    $("#cameraPlaceholder").innerHTML = "<span>無法開啟相機<br><small>請允許相機權限後重新整理</small></span>";
    $("#startShotsBtn").disabled = true;
    $("#cameraNote").textContent = "需要相機權限才能真正拍照";
  }
}

function stopCamera(){
  if(state.stream){ state.stream.getTracks().forEach(track => track.stop()); state.stream = null; }
  video.srcObject = null;
  state.liveRun++;
  $("#cameraStage").classList.remove("has-live");
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
    highlightPose(shot);
    const label = PoseGuide.labels([PoseGuide.current().poses[shot]])[0];
    $("#cameraNote").textContent = `第 ${shot+1} 張：${label}`;
    $("#countdown").textContent = "";
    await sleep(1700);
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
  $("#cameraNote").textContent = "拍好了，正在沖洗…";
  if(state.blessingPromise) await Promise.race([state.blessingPromise,sleep(8000)]);
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
  const scene = sceneImage();
  if(scene && BgSwap.updateMask(video)){
    BgSwap.paint(c,video,scene,out.width,out.height);
    return out.toDataURL("image/jpeg",.92);
  }
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
  const images = await Promise.all(state.shots.map(loadImage));
  await renderCollage(ctx,{images,frame:state.frame,scene:state.scene,sceneImage:sceneImage(),blessingText:state.blessing});
  return canvas.toDataURL("image/jpeg",.9);
}

function loadImage(src){
  return new Promise((resolve,reject) => { const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=src; });
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
    const response=await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action:"savePhoto",imageData:state.collage,wish:state.wish.slice(0,WISH_MAX),scene:state.scene.key})});
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
  link.download=`轉來坐-${Date.now()}.jpg`; link.href=state.collage; link.click();
}

async function showFinale(){
  showScreen("finale");
  $("#finaleIntro").hidden=false; $("#lightBtn").hidden=false; $("#finaleEnd").hidden=true;
  $("#finaleWish").textContent=`「${state.wish}」`;
  const photo=state.shots[0] ? await loadImage(state.shots[0]).catch(()=>null) : null;
  await Promise.allSettled([document.fonts.load(`700 80px 'LXGW WenKai TC'`,state.wish+state.scene.title+"福平安健康團圓壽好運如意發財")]);
  state.lantern3d=!!window.LanternSky?.open({wish:lanternWish(),photo,title:state.scene.title});
}

// 天燈寫得下的長度
function lanternWish(){
  const chars=[...state.wish];
  return chars.length>150 ? chars.slice(0,150).join("")+"…" : state.wish;
}

function lightLantern(){
  $("#lightBtn").hidden=true; $("#finaleIntro").hidden=true;
  const done=()=>{ $("#finaleEnd").hidden=false; };
  if(state.lantern3d) window.LanternSky.ignite(done);
  else{ releaseFallbackLanterns(); done(); }
}

// 3D 開不起來的裝置，退回平面的天燈
function releaseFallbackLanterns(){
  const sky=$("#lanternSky"); sky.querySelectorAll(".lantern").forEach(item=>item.remove());
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
  Object.assign(state,{screen:"gacha",scene:SCENES[0],wish:"",frame:"album",shots:[],collage:"",blessing:"",blessingPromise:null,stream:null,listening:false,busy:false});
  $("#wishPreview").hidden=true; $("#wishText").textContent=""; $("#wishInput").value="";
  $("#micBtn").hidden=false; $("#typeBtn").hidden=false; $("#micStatus").textContent="按一下，開始說";
  $("#shotCount").textContent="0"; $("#blessingText").textContent="正在寫祝福…";
  $$(".frame-chip").forEach((chip,index)=>chip.classList.toggle("is-active",index===0));
  $("#cameraStage").dataset.frame="album";
  renderShotSlots(); setScene(SCENES[0]); showScreen("gacha");
}

let toastTimer;
function showToast(message){
  const toast=$("#toast"); toast.textContent=message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),3200);
}

init();
