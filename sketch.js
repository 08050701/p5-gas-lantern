// sketch.js ✅整份覆蓋（修正：愛心天燈文字「不被砍斷」：自動斷行 + 自動縮字 + 過長時自動「多頁輪播」）
// 重要：若文字非常長，為了「完整出現且不砍斷」，會在愛心同一面上每 2.5 秒自動切換下一頁。
// 其餘功能保持：一面自拍、一面願望+AI回覆、Step流程、大字不重疊、5秒期間也看得到愛心與文字。

let state = "wish"; // "wish" | "selfie" | "final" | "saved" | "release_fx" | "release"
// ★ 貼上你的 Apps Script 網頁應用程式網址（部署後拿到的 https://script.google.com/macros/s/.../exec）
const GAS_URL = "https://script.google.com/macros/s/AKfycby8mJZ1G2s4XTW0xiTznLSxSBp7n1jXhQnU9QoMmvzhUzW7Hol-3eryjZgvIMPZslikMQ/exec";

// 音效檔（跟 index.html 放在同一個資料夾）
const SOUND_BELL_URL = "https://assets.editor.p5js.org/68bfdd75e72d15a331e70880/6be9683d-26a3-46fe-8748-98b5a3f5d911.mp3";
const SOUND_PIANO_URL = "https://assets.editor.p5js.org/68bfdd75e72d15a331e70880/ac85ddbf-2041-47aa-8241-d7220cae74c4.mp3";

// --- 相機 ---
let cam = null;
let selfieImg = null;

// --- 語音辨識 ---
let recognition = null;
let isRecognizing = false;
let micHolding = false;

// --- 願望文字 ---
let liveWishText = "";
let finalWishText = "";

// --- 天燈（愛心） ---
let lanterns = [];
let baseAngle = 0;

// --- 星空 ---
let stars = [];

// --- HUD 2D ---
let hud;
const VW = 1280;
const VH = 720;

// --- UI 按鈕 ---
let buttons = {};
let pointerDown = false;
let pointerDownId = null;

// 釋放光輝特效
let releaseStartMs = 0;
const RELEASE_FX_MS = 5000;

// 愛心幾何
let HEART_PTS = null;
const HEART_N = 140;

// 釋放動畫：回應便條紙（七彩）
let fxReplies = [];
let fxPulse = 0;

// 音效
let sBell = null;
let sPiano = null;
let audioReady = false;
let bellPlayedThisFx = false;
let pianoPlaying = false;

// touch
let _lastPointerX = 0, _lastPointerY = 0;

// ✅ 文字面輪播（避免砍字）
const TEXT_PAGE_MS = 2500; // 每頁停留時間

// 用 <audio> 播放（音檔主機沒開 CORS，p5.sound 的 loadSound 會失敗），介面仿 p5.SoundFile
class HtmlSound {
  constructor(url) {
    this.a = new Audio(url);
    this.a.preload = "auto";
    this.ready = false;
    this.a.addEventListener("canplaythrough", () => { this.ready = true; });
    this.a.load();
  }
  isLoaded() { return this.ready; }
  setVolume(v) { this.a.volume = v; }
  play() { this.a.loop = false; this.a.currentTime = 0; this.a.play().catch(() => {}); }
  loop() { this.a.loop = true; this.a.currentTime = 0; this.a.play().catch(() => {}); }
  stop() { this.a.pause(); this.a.currentTime = 0; }
}

function preload() {
  try {
    sBell = new HtmlSound(SOUND_BELL_URL);
    sPiano = new HtmlSound(SOUND_PIANO_URL);
  } catch (e) {
    sBell = null;
    sPiano = null;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(60);
  textureMode(NORMAL);

  hud = createGraphics(VW, VH);
  hud.pixelDensity(1);

  cam = createCapture(VIDEO, () => {});
  cam.size(640, 480);
  cam.hide();

  initSpeechRecognition();
  initStars();

  HEART_PTS = buildHeartPoints(HEART_N);
  buildButtons();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initStars();
  buildButtons();
}

function draw() {
  background(5, 8, 20);
  drawSky3D();

  if (state === "release_fx") {
    // ✅ 5秒期間仍顯示愛心（包含文字）
    drawReleaseAllScene3D();
    drawReleaseFx3D();

    if (!bellPlayedThisFx) {
      playBellOnce();
      bellPlayedThisFx = true;
    }

    if (millis() - releaseStartMs >= RELEASE_FX_MS) {
      state = "release";
      fxReplies = [];
      bellPlayedThisFx = false;
      startPianoLoop();
    }
  } else if (state === "release") {
    drawReleaseAllScene3D();
  } else {
    stopPianoLoop();
  }

  drawHUD();
}

// ==================================================
// 音效
// ==================================================
function ensureAudio() {
  if (audioReady) return;
  try { userStartAudio(); audioReady = true; } catch (e) {}
}
function playBellOnce() {
  if (!sBell || !sBell.isLoaded()) return;
  ensureAudio();
  try { sBell.stop(); sBell.setVolume(0.9); sBell.play(); } catch (e) {}
}
function startPianoLoop() {
  if (!sPiano || !sPiano.isLoaded()) return;
  ensureAudio();
  if (pianoPlaying) return;
  try { sPiano.setVolume(0.45); sPiano.loop(); pianoPlaying = true; } catch (e) {}
}
function stopPianoLoop() {
  if (!sPiano || !sPiano.isLoaded()) return;
  if (!pianoPlaying) return;
  try { sPiano.stop(); pianoPlaying = false; } catch (e) {}
}

// ==================================================
// 語音辨識
// ==================================================
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { recognition = null; return; }

  recognition = new SR();
  recognition.lang = "zh-TW";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecognizing = true;
    liveWishText = "";
    finalWishText = "";
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interimText += r[0].transcript;
    }
    finalWishText += finalText;
    liveWishText = (finalWishText + interimText).trim();
  };

  recognition.onerror = (e) => {
    isRecognizing = false;
    micHolding = false;
    // Apps Script 的 iframe 可能不允許麥克風 → 改用打字輸入
    if (e && (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "network")) {
      recognition = null;
      showWishInput();
    }
  };

  recognition.onend = () => {
    isRecognizing = false;
    micHolding = false;
    if (!finalWishText.trim() && liveWishText.trim()) finalWishText = liveWishText.trim();
    liveWishText = liveWishText.trim();
  };
}

function startHoldRecord() {
  if (state !== "wish") return;
  liveWishText = "";
  finalWishText = "";
  if (!recognition) { showWishInput(); return; }
  micHolding = true;
  if (!isRecognizing) {
    try { recognition.start(); } catch (e) {}
  }
}

function stopHoldRecord() {
  if (!micHolding) return;
  micHolding = false;

  if (recognition && isRecognizing) {
    try { recognition.stop(); } catch (e) {}
  }

  const t = (liveWishText || finalWishText || "").trim();
  if (state === "wish" && t.length > 0) {
    finalWishText = t;
    liveWishText = t;
    state = "selfie";
    selfieImg = null;
    return;
  }

  // 放開後等一下，語音還是沒抓到字（Apps Script 裡常擋麥克風）→ 改用打字
  setTimeout(() => {
    if (state !== "wish" || micHolding) return;
    const t2 = (liveWishText || finalWishText || "").trim();
    if (t2.length > 0) {
      finalWishText = t2;
      liveWishText = t2;
      state = "selfie";
      selfieImg = null;
    } else {
      showWishInput();
    }
  }, 1200);
}

// 打字輸入（不支援語音辨識時的備案，元素在 Index.html）
function showWishInput() {
  const box = document.getElementById("wishInputBox");
  const input = document.getElementById("wishInput");
  if (!box || box.style.display === "flex") return;
  pointerDown = false;
  pointerDownId = null;
  input.value = "";
  box.style.display = "flex";
  setTimeout(() => input.focus(), 50);
}

function submitWishInput() {
  const box = document.getElementById("wishInputBox");
  const t = (document.getElementById("wishInput").value || "").trim();
  if (!t) return;
  box.style.display = "none";
  if (state !== "wish") return;
  finalWishText = t;
  liveWishText = t;
  state = "selfie";
  selfieImg = null;
}

function cancelWishInput() {
  document.getElementById("wishInputBox").style.display = "none";
}

// ==================================================
// UI：按鈕
// ==================================================
function buildButtons() {
  const bigW = 760;
  const bigH = 260;
  const centerX = VW / 2 - bigW / 2;
  const centerY = VH / 2 - bigH / 2 + 40;

  const bottomY = VH - 120;

  buttons = {
    holdRecord: new CanvasButton(centerX, centerY, bigW, bigH, "按著錄音", "hold"),

    takePhoto: new CanvasButton(VW / 2 - 150, bottomY, 300, 84, "拍照", "tap"),
    photoRedo: new CanvasButton(VW / 2 - 320, bottomY, 280, 84, "重新拍攝", "tap"),
    photoNext: new CanvasButton(VW / 2 + 40, bottomY, 280, 84, "下一步", "tap"),

    saveLantern: new CanvasButton(VW / 2 - 190, bottomY, 380, 92, "儲存天燈", "tap"),

    backToStart: new CanvasButton(VW / 2 - 320, bottomY, 280, 84, "回到開始", "tap"),
    releaseAll: new CanvasButton(VW / 2 + 40, bottomY, 280, 84, "釋放天燈", "tap"),
  };
}

function pointerToHUD(px, py) {
  const s = min(width / VW, height / VH);
  const ox = (width - VW * s) / 2;
  const oy = (height - VH * s) / 2;
  return { x: (px - ox) / s, y: (py - oy) / s };
}

function onPointerDown(px, py) {
  _lastPointerX = px; _lastPointerY = py;
  ensureAudio();

  pointerDown = true;
  const { x, y } = pointerToHUD(px, py);
  pointerDownId = hitTestButton(x, y);

  if (pointerDownId === "holdRecord" && state === "wish") startHoldRecord();
}

function onPointerUp(px, py) {
  _lastPointerX = px; _lastPointerY = py;
  const { x, y } = pointerToHUD(px, py);
  const upId = hitTestButton(x, y);

  if (state === "wish") stopHoldRecord();
  if (pointerDownId && upId && pointerDownId === upId) onButtonClick(upId);

  pointerDown = false;
  pointerDownId = null;
}

// 打字框開著時，讓點擊/觸控交給輸入框，不要被畫布吃掉
function wishInputOpen() {
  const box = document.getElementById("wishInputBox");
  return !!box && box.style.display === "flex";
}

function mousePressed() { if (wishInputOpen()) return; onPointerDown(mouseX, mouseY); }
function mouseReleased() { if (wishInputOpen()) return; onPointerUp(mouseX, mouseY); }

function touchStarted() {
  if (wishInputOpen()) return true;
  if (touches && touches[0]) onPointerDown(touches[0].x, touches[0].y);
  return false;
}
function touchEnded() {
  if (wishInputOpen()) return true;
  onPointerUp(_lastPointerX, _lastPointerY);
  return false;
}

function hitTestButton(x, y) {
  const visible = getVisibleButtons();
  for (const id of visible) {
    if (buttons[id] && buttons[id].hit(x, y)) return id;
  }
  return null;
}

function onButtonClick(id) {
  if (state === "selfie") {
    if (id === "takePhoto") {
      // 相機被擋（Apps Script 的 iframe 常見）→ 改開手機相機 / 選照片
      if (!camWorking()) { openPhotoPicker(); return; }
      selfieImg = cam.get();
      return;
    }
    if (id === "photoRedo") { selfieImg = null; return; }
    if (id === "photoNext") {
      if (!selfieImg) return;
      state = "final";
      return;
    }
  }

  if (state === "final") {
    if (id === "saveLantern") {
      const x = random(-380, 380);
      const z = random(-220, 220);

      const wish = (finalWishText || "").trim();
      const heart = new Lantern3D(selfieImg, wish, x, z);
      lanterns.push(heart);

      heart.setReply("等待回覆…");

      requestFullReplyFromAPI(heart.q)
        .then((reply) => heart.setReply(reply))
        .catch(() => heart.setReply("我在，慢慢來就好"));

      state = "saved";
      return;
    }
  }

  if (state === "saved") {
    if (id === "backToStart") { resetToStart(); return; }
    if (id === "releaseAll") {
      if (lanterns.length === 0) return;
      enterReleaseFx();
      return;
    }
  }

  if (state === "release" || state === "release_fx") {
    if (id === "backToStart") { resetToStart(); return; }
  }
}

function resetToStart() {
  state = "wish";
  selfieImg = null;
  liveWishText = "";
  finalWishText = "";
  stopPianoLoop();
}

function enterReleaseFx() {
  state = "release_fx";
  releaseStartMs = millis();
  bellPlayedThisFx = false;
  fxReplies = buildFxRepliesFromLanterns();
  stopPianoLoop();
}

function getVisibleButtons() {
  if (state === "wish") return ["holdRecord"];
  if (state === "selfie") return selfieImg ? ["photoRedo", "photoNext"] : ["takePhoto"];
  if (state === "final") return ["saveLantern"];
  if (state === "saved") return ["backToStart", "releaseAll"];
  if (state === "release_fx" || state === "release") return ["backToStart"];
  return [];
}

// ==================================================
// HUD（大字 + 行距 + 不重疊）
// ==================================================
function drawHUD() {
  hud.clear();

  hud.noStroke();
  hud.fill(255, 255, 255, 10);
  hud.ellipse(VW * 0.5, VH * 0.18, VW * 0.85, VH * 0.35);

  const TITLE_SIZE = 48;
  const SUB_BASE_SIZE = 40;
  const TOP_PAD = 16;
  const GAP = 36;
  const SUB_MAX_W = VW * 0.88;
  const SUB_MIN_SIZE = 30;

  hud.textAlign(CENTER, TOP);

  hud.fill(255);
  hud.textSize(TITLE_SIZE);
  hud.textLeading(TITLE_SIZE * 1.35);

  const titleY = TOP_PAD;
  const title = getTitleText();
  hud.text(title, VW / 2, titleY);

  const titleBlockH = TITLE_SIZE * 1.35;
  const subY = titleY + titleBlockH + GAP;

  let sub = (getSubtitleText() || "").trim();
  let subSize = SUB_BASE_SIZE;

  while (subSize > SUB_MIN_SIZE) {
    hud.textSize(subSize);
    hud.textLeading(subSize * 1.55);

    const maybe = (hud.textWidth(sub) > SUB_MAX_W) ? wrapTextByWidth(hud, sub, SUB_MAX_W) : sub;
    const lines = maybe.split("\n").length;
    const h = lines * subSize * 1.55;

    if (h <= 210) { sub = maybe; break; }
    subSize -= 2;
  }

  hud.fill(235);
  hud.textSize(subSize);
  hud.textLeading(subSize * 1.55);
  hud.text(sub, VW / 2, subY);

  const lines = max(1, sub.split("\n").length);
  const headerBottom = subY + lines * subSize * 1.55;

  if (state === "selfie") drawCameraScreen(headerBottom + 18);
  if (state === "final") drawFinalPreview(headerBottom + 18);

  if (state === "saved") {
    const msgY = max(VH * 0.22, headerBottom + 50);
    hud.textAlign(CENTER, TOP);
    hud.fill(255, 240, 180);
    hud.textSize(40);
    hud.textLeading(40 * 1.6);
    hud.text("STEP 4\n請選擇：\n釋放天燈 或 回到開始", VW / 2, msgY);
  }

  if (state === "release_fx") {
    const y = max(90, headerBottom + 20);
    hud.textAlign(CENTER, TOP);
    hud.fill(255, 240, 180);
    hud.textSize(44);
    hud.textLeading(44 * 1.4);
    hud.text("釋放天燈\n光輝正在聚集…", VW / 2, y);
    drawFxRepliesScatter();
  }

  hud.textAlign(RIGHT, TOP);
  hud.textSize(16);
  hud.fill(220);
  hud.text(`天燈數量：${lanterns.length}`, VW - 24, 20);

  const visible = getVisibleButtons();
  for (const id of visible) buttons[id].draw(hud, isButtonHot(id));

  const s = min(width / VW, height / VH);
  const ox = (width - VW * s) / 2;
  const oy = (height - VH * s) / 2;

  push();
  resetMatrix();
  translate(-width / 2, -height / 2, 0);
  image(hud, ox, oy, VW * s, VH * s);
  pop();
}

function isButtonHot(id) {
  if (!pointerDown) return false;
  return pointerDownId === id;
}

function getTitleText() {
  if (state === "wish") return "STEP 1";
  if (state === "selfie") return "STEP 2";
  if (state === "final") return "STEP 3";
  if (state === "saved") return "STEP 4";
  if (state === "release_fx" || state === "release") return "釋放天燈";
  return "";
}

function getSubtitleText() {
  if (state === "wish") return micHolding ? "放開就完成" : "按住錄音";
  if (state === "selfie") return selfieImg ? "確認後按下一步" : "請按拍照";
  if (state === "final") return "按下儲存天燈";
  if (state === "saved") return "接下來要做什麼？";
  if (state === "release_fx") return "5 秒後升空";
  if (state === "release") return "天燈升空中";
  return "";
}

function drawCameraScreen(yTop) {
  const screenW = 760;
  const screenH = 440;
  const x = VW / 2 - screenW / 2;
  const y = min(yTop, VH - screenH - 160);

  hud.noStroke();
  hud.fill(10, 12, 30, 200);
  roundedRect(hud, x - 16, y - 16, screenW + 32, screenH + 32, 22);

  hud.noFill();
  hud.stroke(255, 220, 140, 120);
  hud.strokeWeight(2);
  roundedRect(hud, x - 16, y - 16, screenW + 32, screenH + 32, 22);

  hud.noStroke();
  if (selfieImg) {
    hud.image(selfieImg, x, y, screenW, screenH);
  } else {
    const ok = camWorking();
    if (ok) hud.image(cam, x, y, screenW, screenH);
    hud.fill(0, 0, 0, 90);
    hud.rect(x, y + screenH - 70, screenW, 70);
    hud.fill(255);
    hud.textAlign(CENTER, CENTER);
    hud.textSize(40);
    hud.text(ok ? "臉放中間再拍照" : "按拍照開啟相機或選照片", VW / 2, y + screenH - 35);
  }
}

function camWorking() {
  return !!(cam && cam.elt && cam.elt.videoWidth > 0);
}

// 用 <input type="file" capture> 開手機相機，iframe 裡也能用
function openPhotoPicker() {
  const input = document.getElementById("photoInput");
  if (!input) return;
  input.value = "";
  input.onchange = () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadImage(url, (img) => { selfieImg = img; URL.revokeObjectURL(url); });
  };
  input.click();
}

function drawFinalPreview(yTop) {
  const cardW = 980;
  const cardH = 260;
  const x = VW / 2 - cardW / 2;
  const y = min(yTop, VH - cardH - 160);

  hud.noStroke();
  hud.fill(15, 18, 40, 170);
  roundedRect(hud, x, y, cardW, cardH, 18);

  hud.noFill();
  hud.stroke(255, 220, 140, 90);
  hud.strokeWeight(2);
  roundedRect(hud, x, y, cardW, cardH, 18);

  hud.noStroke();
  hud.fill(255);
  hud.textAlign(LEFT, TOP);
  hud.textSize(40);
  hud.textLeading(40 * 1.35);

  hud.text("願望：", x + 22, y + 18);

  hud.textSize(38);
  hud.textLeading(38 * 1.35);
  hud.text(wrapText(finalWishText || liveWishText || "", 18), x + 22, y + 78);
}

// ==================================================
// 星空
// ==================================================
function initStars() {
  stars = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: random(-VW, VW),
      y: random(-VH, VH),
      z: random(-1200, -200),
      base: random(0.4, 1.0),
      tw: random(0.01, 0.03),
      off: random(1000),
      warm: random(0, 1),
    });
  }
}

function drawSky3D() {
  push();
  translate(0, 0, -900);
  noStroke();

  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    fill(5 + 8 * t, 8 + 10 * t, 20 + 20 * t, 200);
    push();
    translate(0, map(t, 0, 1, 250, -250), 0);
    plane(width * 2, height / 10);
    pop();
  }

  const warmA = color(255, 190, 110);
  const warmB = color(255, 240, 190);
  for (const s of stars) {
    const tw = s.base + 0.4 * sin(frameCount * s.tw + s.off);
    const c = lerpColor(warmA, warmB, s.warm);
    stroke(red(c), green(c), blue(c), 120 + 120 * tw);
    strokeWeight(1.5);
    point(s.x * 0.6, s.y * 0.6, s.z);
  }
  pop();
}

// ==================================================
// 釋放光輝特效
// ==================================================
function drawReleaseFx3D() {
  const t = constrain((millis() - releaseStartMs) / RELEASE_FX_MS, 0, 1);

  push();
  resetMatrix();
  translate(0, 0, -300);
  noStroke();

  const pulse = 0.5 + 0.5 * sin(frameCount * 0.2);
  const a = 220 * (1 - t) + 50 * pulse;
  fill(255, 220, 140, a);
  plane(width * 2, height * 2);

  for (let i = 0; i < 12; i++) {
    const k = i / 11;
    const r = lerp(40, min(width, height) * 0.45, k) * (0.8 + 0.25 * pulse);
    fill(255, 210, 120, (1 - k) * a * 0.35);
    ellipse(0, 0, r * 2, r * 1.2);
  }
  pop();
}

// ==================================================
// 愛心升空（慢轉）
// ==================================================
function drawReleaseAllScene3D() {
  baseAngle += 0.0016;
  for (let l of lanterns) { l.update(); l.draw(); }
}

// ==================================================
// Lantern3D：一面自拍、一面文字（不砍字：多頁輪播）
// ==================================================
class Lantern3D {
  constructor(selfie, wishText, x, z) {
    this.selfie = selfie || null;

    this.q = (wishText || "").trim();
    this.reply = "";

    this.xPos = x;
    this.zPos = z;
    this.yPos = random(260, 660);
    this.speedY = random(1.2, 2.0);
    this.rotOffset = random(TWO_PI);

    this.size = random(430, 520);
    this.thick = random(54, 66);

    this.sideCol = color(255, 120, 170, 235);
    this.edgeCol = color(255, 180, 210, 200);

    this.frontTex = createHeartTextureFromPhoto(this.selfie, 768);

    // ✅ 文字面用「多頁」方案
    this.textPages = buildWishReplyPages(this.q, "等待回覆…", 768);
  }

  setReply(replyText) {
    this.reply = (replyText ?? "").toString().trim();
    if (!this.reply) this.reply = "我在，慢慢來就好";
    this.textPages = buildWishReplyPages(this.q, this.reply, 768);
  }

  update() {
    this.yPos -= this.speedY;
    if (this.yPos < -620) this.yPos = random(320, 760);
  }

  draw() {
    push();
    translate(this.xPos, this.yPos, this.zPos);

    const wobble = sin(frameCount * 0.010 + this.rotOffset) * radians(3);
    rotateY(baseAngle + this.rotOffset + wobble);
    rotateX(radians(-8));
    rotateZ(sin(frameCount * 0.006 + this.rotOffset) * radians(1.6));

    this.drawHeartBody();
    this.drawGlow();
    pop();
  }

  drawGlow() {
    push();
    noStroke();
    const pulse = 0.6 + 0.4 * sin(frameCount * 0.035 + this.rotOffset);
    fill(255, 120, 180, 35 + 25 * pulse);
    rotateX(radians(90));
    ellipse(0, 0, this.size * 1.08, this.size * 0.65);
    pop();
  }

  drawHeartBody() {
    const zFront = this.thick / 2;
    const zBack = -this.thick / 2;

    noStroke();
    fill(this.sideCol);
    beginShape(QUAD_STRIP);
    for (let i = 0; i <= HEART_PTS.length; i++) {
      const p = HEART_PTS[i % HEART_PTS.length];
      const px = (p.x - 0.5) * this.size;
      const py = (p.y - 0.5) * this.size;
      vertex(px, py, zFront);
      vertex(px, py, zBack);
    }
    endShape();

    noFill();
    stroke(this.edgeCol);
    strokeWeight(1.2);
    beginShape();
    for (let p of HEART_PTS) vertex((p.x - 0.5) * this.size, (p.y - 0.5) * this.size, zFront + 0.2);
    endShape(CLOSE);
    beginShape();
    for (let p of HEART_PTS) vertex((p.x - 0.5) * this.size, (p.y - 0.5) * this.size, zBack - 0.2);
    endShape(CLOSE);

    // front：自拍
    noStroke();
    texture(this.frontTex);
    beginShape(TRIANGLE_FAN);
    vertex(0, 0, zFront, 0.5, 0.5);
    for (let i = 0; i <= HEART_PTS.length; i++) {
      const p = HEART_PTS[i % HEART_PTS.length];
      const px = (p.x - 0.5) * this.size;
      const py = (p.y - 0.5) * this.size;
      vertex(px, py, zFront, p.u, p.v);
    }
    endShape();

    // back：文字（多頁輪播）
    const page = this.getTextPage();
    texture(page);
    beginShape(TRIANGLE_FAN);
    vertex(0, 0, zBack, 0.5, 0.5);
    for (let i = HEART_PTS.length; i >= 0; i--) {
      const p = HEART_PTS[i % HEART_PTS.length];
      const px = (p.x - 0.5) * this.size;
      const py = (p.y - 0.5) * this.size;
      vertex(px, py, zBack, 1.0 - p.u, p.v);
    }
    endShape();
  }

  getTextPage() {
    const pages = this.textPages && this.textPages.length ? this.textPages : null;
    if (!pages) return createHeartTextureWishReplySingle("願望：\n" + this.q + "\n\nAI回覆：\n" + (this.reply || "…"), 768);
    if (pages.length === 1) return pages[0];
    const idx = Math.floor(millis() / TEXT_PAGE_MS) % pages.length;
    return pages[idx];
  }
}

// ==================================================
// CanvasButton
// ==================================================
class CanvasButton {
  constructor(x, y, w, h, label, type = "tap") {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.label = label;
    this.type = type;
  }
  hit(px, py) { return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h; }
  draw(g, isHot) {
    const r = 28;
    g.noStroke();
    g.fill(0, 0, 0, 80);
    roundedRect(g, this.x + 2, this.y + 6, this.w, this.h, r);

    g.fill(isHot ? 255 : 255, isHot ? 205 : 215, isHot ? 70 : 90, isHot ? 255 : 240);
    roundedRect(g, this.x, this.y, this.w, this.h, r);

    g.noFill();
    g.stroke(255, 255, 255, 120);
    g.strokeWeight(2);
    roundedRect(g, this.x, this.y, this.w, this.h, r);

    g.noStroke();
    g.fill(35, 20, 40, 220);
    g.textAlign(CENTER, CENTER);

    const ts = this.h >= 200 ? 64 : (this.h >= 120 ? 50 : 40);
    g.textSize(ts);
    g.text(this.label, this.x + this.w / 2, this.y + this.h / 2 + 2);
  }
}

// ==================================================
// 愛心幾何
// ==================================================
function buildHeartPoints(n = 120) {
  let raw = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;

  for (let i = 0; i < n; i++) {
    const t = map(i, 0, n, 0, TWO_PI);
    const x = 16 * pow(sin(t), 3);
    const y = 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t);
    raw.push({ x, y: -y });

    minX = min(minX, x);
    maxX = max(maxX, x);
    minY = min(minY, -y);
    maxY = max(maxY, -y);
  }

  let pts = [];
  for (let p of raw) {
    const nx = map(p.x, minX, maxX, 0.12, 0.88);
    const ny = map(p.y, minY, maxY, 0.12, 0.88);
    pts.push({ x: nx, y: ny, u: nx, v: ny });
  }
  return pts;
}

function makeHeartMask(size = 512) {
  const m = createGraphics(size, size);
  m.pixelDensity(1);
  m.background(0);
  m.noStroke();
  m.fill(255);
  m.beginShape();
  for (let p of HEART_PTS) m.vertex(p.x * size, p.y * size);
  m.endShape(CLOSE);
  return m;
}

// ==================================================
// 自拍照片貼圖
// ==================================================
function createHeartTextureFromPhoto(img, size = 512) {
  const g = createGraphics(size, size);
  g.pixelDensity(1);

  g.background(255, 200, 220);

  if (img) {
    const iw = img.width || 1;
    const ih = img.height || 1;
    const scale = max(size / iw, size / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    g.image(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  } else {
    g.noStroke();
    g.fill(255, 160, 200, 120);
    g.ellipse(size * 0.5, size * 0.5, size * 0.7, size * 0.7);
    g.fill(90, 30, 70, 220);
    g.textAlign(CENTER, CENTER);
    g.textSize(28);
    g.text("（沒有照片）", size * 0.5, size * 0.5);
  }

  g.noStroke();
  g.fill(255, 120, 170, 28);
  g.rect(0, 0, size, size);

  const mask = makeHeartMask(size);
  let tex = g.get();
  tex.mask(mask.get());
  return tex;
}

// ==================================================
// ✅ 文字面「不砍字」：分頁打包（每頁保證完整顯示）
// ==================================================
function buildWishReplyPages(wish, reply, size = 512) {
  const w = (wish || "").toString().trim() || "（沒有願望）";
  const a = (reply || "").toString().trim() || "（沒有回覆）";

  const wishBlock = "願望：\n" + w;
  const replyBlock = "AI回覆：\n" + a;

  // 先嘗試單頁（若塞得下就只回傳 1 頁）
  const single = tryBuildSinglePage(wishBlock + "\n\n" + replyBlock, size);
  if (single.ok) return [single.tex];

  // 塞不下：拆成多頁（每頁都會「完整顯示」那一頁的文字，不裁切）
  const wishPages = buildPagedBlock("願望：", w, size);
  const replyPages = buildPagedBlock("AI回覆：", a, size);

  // 先把願望頁全部放完，再放回覆頁（順序清楚）
  return [...wishPages, ...replyPages];
}

// 嘗試把整段放入一頁：成功則不需要分頁
function tryBuildSinglePage(content, size) {
  const g = createGraphics(size, size);
  g.pixelDensity(1);

  drawTextBackground(g, size);

  const pad = 64;
  const maxW = size - pad * 2;

  const topY = 70;
  const bottomY = size * 0.92;
  const maxH = bottomY - topY;

  let fs = 38;
  let wrapped = "";
  while (fs >= 14) {
    g.textSize(fs);
    g.textLeading(fs * 1.28);
    wrapped = wrapTextByWidth(g, content, maxW);
    const lines = wrapped.split("\n").length;
    const h = lines * fs * 1.28;
    if (h <= maxH) break;
    fs -= 2;
  }

  // 若縮到 14 還放不下 → 需要分頁
  g.textSize(fs);
  g.textLeading(fs * 1.28);
  const lines = wrapped.split("\n").length;
  const h = lines * fs * 1.28;

  if (h > maxH) return { ok: false, tex: null };

  g.fill(85, 25, 65, 245);
  g.textAlign(CENTER, CENTER);
  g.text(wrapped, size / 2, topY + maxH / 2);

  const mask = makeHeartMask(size);
  let tex = g.get();
  tex.mask(mask.get());
  return { ok: true, tex };
}

// 分頁：標題固定，內容分多頁
function buildPagedBlock(title, body, size) {
  const pages = [];
  const gMeasure = createGraphics(size, size);
  gMeasure.pixelDensity(1);

  const pad = 64;
  const maxW = size - pad * 2;

  const topY = 70;
  const bottomY = size * 0.92;
  const maxH = bottomY - topY;

  // 固定字級（用較大字，清楚），若行太多就分頁，不縮到很小
  let fs = 30; // 可視度優先
  gMeasure.textSize(fs);
  gMeasure.textLeading(fs * 1.28);

  // 先把 body 做斷行（不砍字）
  const allWrapped = wrapTextByWidth(gMeasure, body, maxW);
  const lines = allWrapped.split("\n");

  // 每頁可容納的行數（扣掉標題兩行空間）
  const headerLines = 2; // title + 空行
  const maxLinesPerPage = max(3, Math.floor(maxH / (fs * 1.28)) - headerLines);

  let idx = 0;
  let pageNo = 1;
  const totalPages = Math.max(1, Math.ceil(lines.length / maxLinesPerPage));

  while (idx < lines.length) {
    const slice = lines.slice(idx, idx + maxLinesPerPage);
    idx += maxLinesPerPage;

    const content =
      title + `（${pageNo}/${totalPages}）` + "\n\n" +
      slice.join("\n");

    pages.push(createHeartTextureWishReplySingle(content, size, fs));
    pageNo++;
  }

  if (pages.length === 0) {
    pages.push(createHeartTextureWishReplySingle(title + "\n\n" + body, size, fs));
  }
  return pages;
}

function createHeartTextureWishReplySingle(content, size = 512, fixedFontSize = null) {
  const g = createGraphics(size, size);
  g.pixelDensity(1);

  drawTextBackground(g, size);

  const pad = 64;
  const maxW = size - pad * 2;

  const topY = 70;
  const bottomY = size * 0.92;
  const maxH = bottomY - topY;

  let wrapped = "";
  let fs = fixedFontSize || 38;

  if (fixedFontSize) {
    g.textSize(fs);
    g.textLeading(fs * 1.28);
    wrapped = wrapTextByWidth(g, content, maxW);
  } else {
    while (fs >= 14) {
      g.textSize(fs);
      g.textLeading(fs * 1.28);
      wrapped = wrapTextByWidth(g, content, maxW);
      const lines = wrapped.split("\n").length;
      const h = lines * fs * 1.28;
      if (h <= maxH) break;
      fs -= 2;
    }
  }

  g.fill(85, 25, 65, 245);
  g.textAlign(CENTER, CENTER);
  g.textSize(fs);
  g.textLeading(fs * 1.28);
  g.text(wrapped, size / 2, topY + maxH / 2);

  const mask = makeHeartMask(size);
  let tex = g.get();
  tex.mask(mask.get());
  return tex;
}

function drawTextBackground(g, size) {
  g.background(255, 210, 228);
  g.noStroke();
  g.fill(255, 170, 205, 90);
  g.ellipse(size * 0.52, size * 0.40, size * 0.95, size * 0.75);
  g.fill(255, 240, 246, 80);
  g.ellipse(size * 0.48, size * 0.28, size * 0.9, size * 0.6);
}

// ==================================================
// API：回覆
// ==================================================
// 呼叫 Apps Script 後端（Code.gs 的 doPost）拿 AI 回覆
// 不設 Content-Type（預設 text/plain），瀏覽器就不會先送 OPTIONS，Apps Script 才收得到
async function requestFullReplyFromAPI(wish) {
  const w = (wish || "").trim();
  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({ wish: w }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "Apps Script 回傳錯誤");
  return (j.reply ?? "").toString().trim();
}

// ==================================================
// 釋放便條紙（七彩）
// ==================================================
function buildFxRepliesFromLanterns() {
  const list = [];
  const margin = 80;
  const n = max(1, lanterns.length);

  for (let i = 0; i < n; i++) {
    const heart = lanterns[i % lanterns.length];
    list.push({
      q: (heart?.q || "").trim(),
      a: ((heart?.reply || "等待回覆…") ?? "").toString().trim(),
      x: random(margin, VW - margin),
      y: random(170, VH - 240),
      rot: random(-0.25, 0.25),
      s: random(1.05, 1.25),
      aAlpha: random(210, 255),
      hue: (i * 360 / max(1, n)) % 360,
      wob: random(1000)
    });
  }
  return list;
}

function drawFxRepliesScatter() {
  fxPulse = 0.5 + 0.5 * sin(frameCount * 0.08);

  hud.push();
  hud.colorMode(HSB, 360, 100, 100, 255);

  for (let i = 0; i < fxReplies.length; i++) {
    const r = fxReplies[i];
    const dx = sin(frameCount * 0.02 + i * 1.7 + r.wob) * 6;
    const dy = cos(frameCount * 0.02 + i * 1.3 + r.wob) * 6;

    const cardW = 460;
    const cardH = 210;

    hud.push();
    hud.translate(r.x + dx, r.y + dy);
    hud.rotate(r.rot + sin(frameCount * 0.01 + i) * 0.05);
    hud.scale(r.s);

    hud.noStroke();
    hud.fill(0, 0, 0, 70);
    roundedRect(hud, -cardW/2 + 6, -cardH/2 + 10, cardW, cardH, 18);

    hud.fill(55, 12, 98, 235);
    roundedRect(hud, -cardW/2, -cardH/2, cardW, cardH, 18);

    hud.noFill();
    hud.stroke(r.hue, 70, 95, 220);
    hud.strokeWeight(4);
    roundedRect(hud, -cardW/2, -cardH/2, cardW, cardH, 18);

    const pad = 18;
    const maxW = cardW - pad * 2;
    const maxH = cardH - 18 - 18;

    const text = "願望：" + r.q + "\n回覆：" + r.a;

    let fs = 24;
    let wrapped = "";
    while (fs >= 14) {
      hud.textSize(fs);
      hud.textLeading(fs * 1.25);
      wrapped = wrapTextByWidth(hud, text, maxW);
      const lines = wrapped.split("\n").length;
      if (lines * fs * 1.25 <= maxH) break;
      fs -= 2;
    }

    hud.noStroke();
    hud.fill(330, 35, 20, r.aAlpha);
    hud.textAlign(LEFT, TOP);
    hud.textSize(fs);
    hud.textLeading(fs * 1.25);
    hud.text(wrapped, -cardW/2 + pad, -cardH/2 + pad);

    hud.noStroke();
    hud.fill(r.hue, 55, 95, 30 + 35 * fxPulse);
    hud.ellipse(0, cardH/2 - 10, cardW*0.78, 30);

    hud.pop();
  }

  hud.colorMode(RGB, 255);
  hud.pop();
}

// ==================================================
// 小工具
// ==================================================
function roundedRect(g, x, y, w, h, r) { g.rect(x, y, w, h, r); }

function wrapText(str, maxCharsPerLine) {
  const s = (str || "").toString().trim();
  if (!s) return "";
  let out = "";
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    out += s[i];
    count++;
    if (count >= maxCharsPerLine && i < s.length - 1) {
      out += "\n";
      count = 0;
    }
  }
  return out;
}

function wrapTextByWidth(g, str, maxW) {
  const s = (str || "").toString();
  if (!s.trim()) return "";
  let out = "";
  let line = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\n") { out += line + "\n"; line = ""; continue; }
    const test = line + ch;
    if (g.textWidth(test) > maxW && line.length > 0) {
      out += line + "\n";
      line = ch;
    } else {
      line = test;
    }
  }
  out += line;
  return out;
}
