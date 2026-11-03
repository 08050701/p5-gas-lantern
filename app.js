"use strict";

const GAS_URL = "https://script.google.com/macros/s/AKfycby8mJZ1G2s4XTW0xiTznLSxSBp7n1jXhQnU9QoMmvzhUzW7Hol-3eryjZgvIMPZslikMQ/exec";
const SCENES = [
  { key:"alishan", title:"阿里山小火車", icon:"阿里山", image:"assets/taiwan-alishan.jpg", poem:"小火車靠站，山嵐慢慢飄過來。" },
  { key:"tamsui", title:"淡水河渡船", icon:"淡水", image:"assets/taiwan-tamsui.jpg", poem:"渡船靠岸，對面就是觀音山。" },
  { key:"beach", title:"淡水海水浴場", icon:"淡水", image:"assets/taiwan-beach.jpg", poem:"對面就是觀音山。" },
  { key:"xiluo", title:"西螺大橋", icon:"西螺", image:"assets/taiwan-xiluo.jpg", poem:"大橋通車那一天，大家都來看。" },
  { key:"village", title:"山村吊橋", icon:"山村", image:"assets/taiwan-village.jpg", poem:"過了吊橋，就是回家的路。" },
  { key:"sunmoon", title:"日月潭", icon:"日月潭", image:"assets/taiwan-sunmoon.jpg", poem:"小舟靠在湖邊，水很靜。" },
  { key:"qingshui", title:"清水斷崖", icon:"東海岸", image:"assets/taiwan-qingshui.jpg", poem:"山壁直直落進海裡。" },
  { key:"puli", title:"烏牛欄吊橋", icon:"埔里", image:"assets/taiwan-puli.jpg", poem:"站在橋頭，風從山谷吹上來。" },
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
  { key:"xiziwan", title:"西子灣海水浴場", icon:"高雄", image:"assets/taiwan-xiziwan.jpg", poem:"彩旗飄飄，海風吹著晚霞。" },
  { key:"cijin", title:"旗後海水浴場", icon:"旗後", image:"assets/taiwan-cijin.jpg", poem:"浪花一層一層打上岸。" },
  { key:"yancheng", title:"高雄銀座", icon:"鹽埕", image:"assets/taiwan-yancheng.jpg", poem:"穿得漂漂亮亮，來逛街。" },
  { key:"fengshan", title:"鳳山街景", icon:"鳳山", image:"assets/taiwan-fengshan.jpg", poem:"老榕樹下，整條街都涼涼的。" },
  { key:"shimen", title:"牡丹石門", icon:"屏東", image:"assets/taiwan-shimen.jpg", poem:"兩邊山壁夾著一條溪。" },
  { key:"jiaoban", title:"角板山台車", icon:"桃園", image:"assets/taiwan-jiaoban.jpg", poem:"小台車停在山邊，等人來推。" }
];

const WISH_MAX = 300;
const sceneImages = {};
const state = { variant:0, liveRun:0, screen:"gacha", scene:SCENES[0], wish:"", frame:"album", shots:[], collage:"", blessing:"", blessingPromise:null, stream:null, listening:false, busy:false, bgFront:"a" };
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

// LINE、Facebook 內建瀏覽器常常不能用相機和麥克風
function guardInAppBrowser(){
  const ua = navigator.userAgent;
  if(/\bLine\//i.test(ua) && !location.search.includes("openExternalBrowser")){
    location.replace(`${location.pathname}${location.search ? `${location.search}&` : "?"}openExternalBrowser=1`);
    return;
  }
  if(/\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger/i.test(ua)) $("#browserTip").hidden = false;
}

function init(){
  I18N.apply();
  guardInAppBrowser();
  setScene(state.scene, false);
  bindEvents();
  FlipAlbum.bind();
  renderGachaAction();
  renderMusicButton();
  window.addEventListener("load",renderGachaAction);
  preloadScenes();
}

function bindEvents(){
  $("#musicBtn").addEventListener("click", toggleMusic);
  $("#langBtn").addEventListener("click", toggleLangMenu);
  $$("[data-lang]").forEach(button => button.addEventListener("click", () => { closeLangMenu(); I18N.set(button.dataset.lang); }));
  document.addEventListener("click", event => { if(!event.target.closest("#langPick")) closeLangMenu(); });
  document.addEventListener("keydown", event => { if(event.key==="Escape") closeLangMenu(); });
  document.addEventListener("langchange", onLangChange);
  ["touchend","click","keydown"].forEach(type => document.addEventListener(type, autoStartMusic, {capture:true}));
  $("#spinBtn").addEventListener("click", gachaStep);
  $("#spinAction").addEventListener("click", gachaStep);
  $("#albumBtn").addEventListener("click", askAlbum);
  $("#albumYes").addEventListener("click", () => enterAlbum(true));
  $("#albumNo").addEventListener("click", () => enterAlbum(false));
  $("#albumAgainBtn").addEventListener("click", resetExperience);
  $("#rerollBtn").addEventListener("click", rerollGacha);
  $("#wishBtn").addEventListener("click", () => showScreen("wish"));
  $("#typeBtn").addEventListener("click", openWishDialog);
  $("#micBtn").addEventListener("click", startSpeech);
  $("#restartBtn").addEventListener("click", () => state.restartListening?.());
  $("#redoWishBtn").addEventListener("click", redoWish);
  $("#toCameraBtn").addEventListener("click", enterCamera);
  $("#startShotsBtn").addEventListener("click", shootSequence);
  $("#skipBgBtn").addEventListener("click", () => { $("#skipBgBtn").hidden = true; $("#startShotsBtn").hidden = false; shootSequence(); });
  $("#poseRollBtn").addEventListener("click", rollPoses);
  $("#lightBtn").addEventListener("click", lightLantern);
  $("#retakeBtn").addEventListener("click", retake);
  $("#saveBtn").addEventListener("click", preparePickup);
  $("#downloadBtn").addEventListener("click", downloadCollage);
  $("#finishBtn").addEventListener("click", showFinale);
  $("#againBtn").addEventListener("click", resetExperience);
  $("#homeBtn").addEventListener("click", () => { if(!state.busy) resetExperience(); });
  $("#browserTipClose").addEventListener("click", () => { $("#browserTip").hidden = true; });
  $$(".frame-chip").forEach(button => button.addEventListener("click", () => selectFrame(button)));
  $("#wishInput").addEventListener("input", updateCharCount);
  $("#wishForm").addEventListener("submit", submitTypedWish);
  window.addEventListener("pagehide", stopCamera);
}

// 瀏覽器規定要先按一下才能出聲，所以第一次點畫面就開始放；之後每次碰畫面都順手喚醒，
// 手機用過麥克風或切回來時，聲音才接得回來
function autoStartMusic(event){
  if(state.musicAsked || event.target.closest?.("#musicBtn")){ if(RetroMusic.isPlaying()) RetroMusic.unlock(); state.musicAsked=true; return; }
  state.musicAsked=true;
  // 音樂先，去背模型 16MB 排在後面，才不會搶走網路
  RetroMusic.start().finally(()=>BgSwap.load());
  renderMusicButton();
}

function toggleMusic(){
  RetroMusic.toggle();
  renderMusicButton();
}

function renderMusicButton(){
  const on = RetroMusic.isPlaying();
  // 手機上只留「♪ 開／關」，曲名藏起來
  $("#musicBtn").innerHTML = `♪ <span class="music-name">${I18N.t("musicName")}</span>${I18N.t(on ? "musicOn" : "musicOff")}`;
  $("#musicBtn").setAttribute("aria-pressed", String(on));
}

function toggleLangMenu(){
  const open = $("#langMenu").hidden;
  $("#langMenu").hidden = !open;
  $("#langBtn").setAttribute("aria-expanded",String(open));
}

function closeLangMenu(){
  $("#langMenu").hidden = true;
  $("#langBtn").setAttribute("aria-expanded","false");
}

// 換語言：畫面上正在顯示的字跟著換；祝福用新的語言重寫一次
async function onLangChange(){
  renderMusicButton();
  window.Gacha3D?.relabel?.();
  renderGachaAction();
  renderReveal();
  if(state.wish){
    $("#wishText").textContent = I18N.quote(state.wish);
    $("#redoWishBtn").textContent = I18N.t(state.wishBy==="voice" ? "sayAgain" : "writeAgain");
    $("#micStatus").textContent = I18N.t("gotIt");
    $("#finaleWish").textContent = I18N.quote(state.wish);
  }else if(!state.listening) $("#micStatus").textContent = I18N.t("micIdle");
  $(".mic-icon").textContent = I18N.t(state.listening ? "micDone" : "micTalk");
  if(PoseGuide.current()) renderPoses();
  window.Book3D?.relabel?.();
  if(state.listening) state.restartListening?.();
  if(!state.blessing) $(".inline-blessing span").textContent = I18N.t("aiAnswering");
  if(!state.wish || state.busy || !["wish","camera","review"].includes(state.screen)) return;
  state.blessingPromise = requestBlessing();
  if(state.screen!=="review") return;
  await state.blessingPromise;
  if(state.screen!=="review" || state.busy) return;
  state.collage = await buildCollage();
  $("#collagePreview").src = state.collage;
  $("#pickupPreview").src = state.collage;
}

function preloadScenes(){
  SCENES.forEach(scene => { const img = new Image(); img.src = scene.image; sceneImages[scene.key] = img; });
}

function showScreen(name){
  state.screen = name;
  screens.forEach(screen => screen.classList.toggle("is-active", screen.dataset.screen === name));
  const step = ({gacha:0,reveal:0,wish:1,camera:2,review:3,pickup:3,finale:3,album:3})[name] ?? 0;
  progressDots.forEach((dot,index) => dot.classList.toggle("is-active", index === step));
  if(name !== "camera") stopCamera();
  if(name !== "finale") window.LanternSky?.close();
  if(name !== "album") window.Book3D?.close();
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

// 第一下投幣、第二下轉把手；按機台或按鈕都一樣
async function gachaStep(){
  if(state.busy) return;
  if(window.Gacha3D && !window.Gacha3D.coined){
    state.busy = true;
    await window.Gacha3D.insertCoin();
    state.busy = false;
    renderGachaAction();
    return;
  }
  spinGacha();
}

function renderGachaAction(){
  const coined = window.Gacha3D?.coined;
  $("#spinAction span").textContent = I18N.t(window.Gacha3D ? (coined ? "spinTurn" : "spinCoin") : "spinFlat");
}

async function spinGacha(){
  if(state.busy) return;
  state.busy = true;
  const choices = SCENES.filter(scene => scene.key !== state.scene.key);
  const chosen = choices[Math.floor(Math.random()*choices.length)];
  $(".hero").classList.add("is-spinning");
  if(window.Gacha3D){
    // 背景隱藏時動畫會停，等太久就直接揭曉
    await Promise.race([window.Gacha3D.spin(I18N.scene(chosen).title),sleep(16000)]);
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
  renderReveal();
  showScreen("reveal");
  $(".hero").classList.remove("is-spinning");
  window.Gacha3D?.reset();
  renderGachaAction();
  await sleep(80);
  wipe.classList.remove("is-on");
  state.busy = false;
}

function renderReveal(){
  const scene = I18N.scene(state.scene);
  $("#sceneIcon").textContent = scene.icon;
  $("#sceneTitle").textContent = scene.title;
  $("#scenePoem").textContent = scene.poem;
}

function rerollGacha(){
  if(state.busy) return;
  showScreen("gacha");
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
  if(!wish){ showToast(I18N.t("writeFirst")); return; }
  acceptWish(wish);
  $("#wishDialog").close();
}

function acceptWish(wish,by="type"){
  state.wish = wish.slice(0,WISH_MAX);
  state.wishBy = by;
  $("#redoWishBtn").textContent = I18N.t(by==="voice" ? "sayAgain" : "writeAgain");
  $("#wishText").textContent = I18N.quote(state.wish);
  $("#wishPreview").hidden = false;
  $("#micBtn").hidden = true;
  $("#typeBtn").hidden = true;
  $("#micStatus").textContent = I18N.t("gotIt");
  state.blessingPromise = requestBlessing();
  BgSwap.load();
}

// 不滿意就重來：講的直接開始聽，打的帶著原本的字回去改
function redoWish(){
  const voice = state.wishBy==="voice";
  $("#wishPreview").hidden = true;
  $("#micBtn").hidden = false;
  $("#typeBtn").hidden = false;
  $("#micStatus").textContent = I18N.t("micIdle");
  state.blessingPromise = null;
  if(voice){ state.wish = ""; startSpeech(); }
  else openWishDialog();
}

// 長輩講話會停頓：講到一半停下來不算講完。
// 一直聽到按「說完了」，或安靜夠久、或到時間上限才結束。
const LISTEN_MAX = 120000, SILENCE_AFTER_SPEECH = 9000, SILENCE_NO_SPEECH = 20000;

function startSpeech(){
  if(state.listening){ state.stopListening?.(); return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Recognition){
    $("#micStatus").textContent = I18N.t("noVoice");
    openWishDialog();
    return;
  }
  const recognition = new Recognition();
  recognition.lang = I18N.speech;
  recognition.interimResults = true;
  recognition.continuous = true;
  const parts = [];
  let interim = "", silenceTimer = 0, maxTimer = 0, stopping = false;
  const gap = I18N.lang==="en" ? " " : "";
  const heard = () => [...parts,interim].map(part=>part.trim()).filter(Boolean).join(gap);
  const keepWaiting = () => { clearTimeout(silenceTimer); silenceTimer = setTimeout(stop, heard() ? SILENCE_AFTER_SPEECH : SILENCE_NO_SPEECH); };
  const stop = () => { stopping = true; clearTimeout(silenceTimer); clearTimeout(maxTimer); try{ recognition.stop(); }catch(_){ finish(); } };
  const finish = () => {
    clearTimeout(silenceTimer); clearTimeout(maxTimer);
    state.stopListening = null;
    finishListening();
    if(heard()) acceptWish(heard(),"voice");
    else $("#micStatus").textContent = I18N.t("notClear");
  };
  // 講到一半想重來：把聽到的丟掉，斷線重連的流程會接著聽（換語言也走這條，重連時用新的語言）
  state.restartListening = () => {
    parts.length = 0; interim = "";
    recognition.lang = I18N.speech;
    $("#restartBtn").hidden = true;
    $("#micStatus").textContent = I18N.t("sayAgainNow");
    keepWaiting();
    try{ recognition.abort(); }catch(_){}
  };
  state.stopListening = stop;
  state.listening = true;
  $("#micBtn").classList.add("is-listening");
  $(".mic-icon").textContent = I18N.t("micDone");
  $("#micStatus").textContent = I18N.t("speakSlowly");
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
    $("#micStatus").textContent = heard() || I18N.t("listening");
    $("#restartBtn").hidden = !heard();
    keepWaiting();
  };
  recognition.onerror = event => {
    if(event.error === "no-speech" || event.error === "aborted") return;
    stopping = true;
    clearTimeout(silenceTimer); clearTimeout(maxTimer);
    state.stopListening = null;
    finishListening();
    if(heard()){ acceptWish(heard(),"voice"); return; }
    $("#micStatus").textContent = I18N.t("noSound");
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
  $("#restartBtn").hidden = true;
  $("#micBtn").classList.remove("is-listening");
  $(".mic-icon").textContent = I18N.t("micTalk");
}

async function requestBlessing(){
  const wish = state.wish, lang = I18N.lang; // 重講或換語言之後，上一次的回覆晚到也不算數
  const stale = () => wish!==state.wish || lang!==I18N.lang;
  state.blessing = "";
  $("#blessingText").textContent = I18N.t("blessWriting");
  $("#inlineBlessing").textContent = I18N.t("blessWait");
  $(".inline-blessing span").textContent = I18N.t("blessWritingLabel");
  try{
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action:"bless",wish:state.wish+I18N.t("aiHint"),lang}),signal:controller.signal});
    clearTimeout(timer);
    const data = await response.json();
    if(stale()) return state.blessing;
    if(!data.ok) throw new Error(data.error || "no blessing");
    const reply = String(data.reply || "").trim();
    // AI 沒回應或回錯語言時，至少依願望內容給一句貼近的話
    state.blessing = reply && I18N.fits(reply) ? reply : I18N.localBlessing(state.wish);
    $(".inline-blessing span").textContent = I18N.t("blessLabel");
  }catch(error){
    if(stale()) return state.blessing;
    state.blessing = I18N.localBlessing(state.wish);
    $(".inline-blessing span").textContent = I18N.t("blessLabel");
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
  PoseGuide.next();
  renderPoses();
  highlightPose(0);
}

function renderPoses(){
  const set = PoseGuide.current();
  const now = $$("#poseList li").findIndex(item => item.classList.contains("is-now"));
  $("#poseTitle").textContent = set.title();
  $("#poseList").innerHTML = PoseGuide.labels(set.poses).map((label,i)=>`<li>${i+1}. ${label}</li>`).join("");
  if(now>=0) highlightPose(now);
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
  $("#skipBgBtn").hidden = true;
  $("#startShotsBtn").hidden = false;
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

// 背景模型有 25MB，網路慢要等一分多鐘：邊等邊看得到自己，等到了才拍；失敗就一直重試，要不要先拍由人決定
async function prepareBackground(){
  const run = state.liveRun, note = $("#cameraNote"), skip = $("#skipBgBtn");
  const progress = percent => { if(run === state.liveRun && !state.busy) note.textContent = I18N.t("bgProgress",{p:percent}); };
  note.textContent = I18N.t("bgPreparing");
  const offer = setTimeout(() => { if(run === state.liveRun) { skip.hidden = false; $("#startShotsBtn").hidden = true; } }, 30000);
  while(run === state.liveRun && !await BgSwap.load(progress)) await sleep(4000);
  clearTimeout(offer);
  if(run !== state.liveRun || state.busy) return;
  skip.hidden = true;
  $("#startShotsBtn").hidden = false;
  $("#startShotsBtn").disabled = false;
  note.textContent = I18N.t("shotNote");
}

async function startCamera(){
  stopCamera();
  $("#startShotsBtn").disabled = true;
  $("#cameraPlaceholder").style.display = "grid";
  $("#cameraPlaceholder").innerHTML = `<span>${I18N.t("cameraOpening")}</span>`;
  try{
    state.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:960}},audio:false});
    video.srcObject = state.stream;
    await video.play();
    $("#cameraPlaceholder").style.display = "none";
    startLivePreview();
    prepareBackground();
  }catch(_){
    $("#cameraPlaceholder").innerHTML = `<span>${I18N.t("cameraFail")}</span>`;
    $("#startShotsBtn").disabled = true;
    $("#cameraNote").textContent = I18N.t("cameraFailNote");
    const skip = document.createElement("button");
    skip.className = "text-link"; skip.type = "button"; skip.textContent = I18N.t("skipToLantern");
    skip.addEventListener("click", () => showFinale());
    $("#cameraNote").appendChild(skip);
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
  state.variant = (state.variant+1+Math.floor(Math.random()*3))%4; // 每次排法都不一樣
  renderShotSlots();
  $("#startShotsBtn").disabled = true;
  for(let shot=0;shot<3;shot++){
    highlightPose(shot);
    const label = PoseGuide.labels([PoseGuide.current().poses[shot]])[0];
    $("#cameraNote").textContent = I18N.t("shotN",{n:shot+1,label});
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
  $("#cameraNote").textContent = I18N.t("developing");
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
  if(scene && BgSwap.updateMask(video,true)){
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
  await renderCollage(ctx,{images,frame:state.frame,scene:state.scene,sceneImage:sceneImage(),blessingText:state.blessing,variant:state.variant});
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
  mount.innerHTML=`<div class="qr-loading">${I18N.t("uploading")}</div>`;
  try{
    const response=await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action:"savePhoto",imageData:state.collage,wish:state.wish.slice(0,WISH_MAX),scene:state.scene.key,lang:I18N.lang})});
    const data=await response.json();
    if(!data.ok || !data.claimUrl) throw new Error(data.error || "no claim url");
    renderQR(String(data.claimUrl),mount);
  }catch(error){
    mount.innerHTML=`<div class="qr-loading">${I18N.t("qrFail")}</div>`;
  }
  state.busy=false;
}

function renderQR(text,mount){
  mount.innerHTML="";
  new QRCode(mount,{text,width:202,height:202,colorDark:"#281c31",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
}

// 手機用分享面板最穩，選「儲存影像」就進相簿；電腦才走下載
async function downloadCollage(){
  if(!state.collage) return;
  const name=`${I18N.t("brand")}-${Date.now()}.jpg`;
  try{
    const blob=await (await fetch(state.collage)).blob();
    const file=new File([blob],name,{type:"image/jpeg"});
    if(/Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare?.({files:[file]})){ await navigator.share({files:[file]}); return; }
  }catch(error){
    if(error.name==="AbortError") return;
  }
  const link=document.createElement("a");
  link.download=name; link.href=state.collage; link.click();
}

async function showFinale(){
  showScreen("finale");
  $("#finaleIntro").hidden=false; $("#lightBtn").hidden=false; $("#finaleEnd").hidden=true;
  $("#finaleWish").textContent=I18N.quote(state.wish);
  checkAlbum();
  const photo=state.shots[0] ? await loadImage(state.shots[0]).catch(()=>null) : null;
  const title=I18N.scene(state.scene).title;
  await Promise.allSettled([document.fonts.load(`700 80px 'LXGW WenKai TC'`,state.wish+title+I18N.t("lanternFu")+I18N.lanternWords().join(""))]);
  state.lantern3d=!!window.LanternSky?.open({wish:lanternWish(),photo,title});
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

// ── 大家的相冊 ─────────────────────────────
// 後端還沒開通、或沒有拍照時，不出現相冊按鈕
async function checkAlbum(){
  $("#albumBtn").hidden=true;
  if(!state.collage) return;
  try{
    const data=await albumCall({action:"albumList"});
    $("#albumBtn").hidden=!Array.isArray(data.pages);
  }catch(_){}
}

function askAlbum(){
  $("#albumDialog").showModal();
}

// 相冊用小一點的圖，翻起來才快
function albumImage(){
  const out=document.createElement("canvas"); out.width=600; out.height=1000;
  out.getContext("2d").drawImage(canvas,0,0,600,1000);
  return out.toDataURL("image/jpeg",.72);
}

async function albumCall(body){
  const response=await fetch(GAS_URL,{method:"POST",body:JSON.stringify(body)});
  return response.json();
}

async function enterAlbum(share){
  $("#albumDialog").close();
  showScreen("album");
  $("#albumNote").textContent=I18N.t("albumOpening");
  const today=new Date();
  const mine={wish:state.wish,scene:I18N.scene(state.scene).title,date:I18N.date(today),src:state.collage};
  const list=[{kind:"cover"},{kind:"inside"}];
  if(share) list.push(mine);
  const finished=()=>{
    const pages=[...list,{kind:"end",note:""}];
    if(pages.length%2) pages.push({kind:"blank"});
    return pages;
  };
  openAlbum(finished(),null,false);
  let note="";
  try{
    if(share){
      const saved=await albumCall({action:"albumAdd",imageData:albumImage(),wish:state.wish,scene:mine.scene});
      if(saved.id) mine.id=saved.id;
      else note=saved.error ? I18N.t("albumNotAdded",{e:saved.error}) : I18N.t("albumOnlyYou");
    }
    const data=await albumCall({action:"albumList"});
    if(!Array.isArray(data.pages)) throw new Error("album closed");
    const others=data.pages.filter(page=>page.id!==mine.id).map(page=>({id:page.id,wish:page.wish,scene:page.scene,date:I18N.date(new Date(page.time))}));
    list.push(...others);
    if(!others.length && !note) note=I18N.t("albumFirst");
  }catch(_){
    note=note||I18N.t("albumClosed");
  }
  $("#albumNote").textContent=note;
  openAlbum(finished(),async id=>(await albumCall({action:"albumPage",id})).imageData||"",true);
}

// 有 3D 就用 3D 的書，開不起來才退回平面翻頁
function openAlbum(pages,loader,keep){
  const ok=window.Book3D?.open(pages,loader,keep);
  $(".screen.album").classList.toggle("has-book",!!ok);
  if(!ok) FlipAlbum.open(pages.filter(page=>page.kind!=="inside"&&page.kind!=="blank"),loader);
}

function resetExperience(){
  stopCamera();
  Object.assign(state,{screen:"gacha",scene:SCENES[0],wish:"",frame:"album",shots:[],collage:"",blessing:"",blessingPromise:null,stream:null,listening:false,busy:false});
  $("#wishPreview").hidden=true; $("#wishText").textContent=""; $("#wishInput").value="";
  $("#micBtn").hidden=false; $("#typeBtn").hidden=false; $("#micStatus").textContent=I18N.t("micIdle");
  $("#shotCount").textContent="0"; $("#blessingText").textContent=I18N.t("blessWriting");
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
