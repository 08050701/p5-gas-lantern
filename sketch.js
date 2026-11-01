// sketch.js ✅整份覆蓋（修正：愛心天燈文字「不被砍斷」：自動斷行 + 自動縮字 + 過長時自動「多頁輪播」）
// 重要：若文字非常長，為了「完整出現且不砍斷」，會在愛心同一面上每 2.5 秒自動切換下一頁。
// 其餘功能保持：一面自拍、一面願望+AI回覆、Step流程、大字不重疊、5秒期間也看得到愛心與文字。

let state = "scene"; // "scene" | "wish" | "selfie" | "final" | "saved" | "release_fx" | "release"
// ★ 貼上你的 Apps Script 網頁應用程式網址（部署後拿到的 https://script.google.com/macros/s/.../exec）
const GAS_URL = "https://script.google.com/macros/s/AKfycby8mJZ1G2s4XTW0xiTznLSxSBp7n1jXhQnU9QoMmvzhUzW7Hol-3eryjZgvIMPZslikMQ/exec";

// 音效檔（跟 index.html 放在同一個資料夾）
const SOUND_BELL_URL = "https://assets.editor.p5js.org/68bfdd75e72d15a331e70880/6be9683d-26a3-46fe-8748-98b5a3f5d911.mp3";
const SOUND_PIANO_URL = "https://assets.editor.p5js.org/68bfdd75e72d15a331e70880/ac85ddbf-2041-47aa-8241-d7220cae74c4.mp3";

// --- 相機 ---
let cam = null;
let cameraStream = null;
let cameraStarting = false;
let cameraError = "";
let selfieImg = null;
let selfieShots = [];
let selectedFrameStyle = "hearts";
let boothShooting = false;
let boothCountdown = 0;
let boothShotNumber = 0;
let boothFlashUntil = 0;
let boothSession = 0;
const BOOTH_SHOT_COUNT = 3;

const FRAME_OPTIONS = {
  frameHearts: { key: "hearts", label: "愛心粉" },
  frameStars: { key: "stars", label: "星光金" },
  frameDream: { key: "dream", label: "夢幻紫" },
  frameClassic: { key: "classic", label: "經典白" },
};

// --- 願望扭蛋場景 ---
const SCENE_THEMES = {
  garden: {
    label: "晨光花園", icon: "✿",
    skyTop: [104, 181, 231], skyBottom: [255, 224, 185],
    accent: [255, 122, 168], ground: [76, 139, 85],
  },
  day: {
    label: "晴朗白日", icon: "☀",
    skyTop: [72, 164, 242], skyBottom: [202, 238, 255],
    accent: [255, 217, 92], ground: [95, 176, 113],
  },
  sunset: {
    label: "金色黃昏", icon: "◒",
    skyTop: [79, 72, 142], skyBottom: [255, 160, 103],
    accent: [255, 205, 112], ground: [68, 58, 94],
  },
  night: {
    label: "星願夜空", icon: "✦",
    skyTop: [7, 11, 32], skyBottom: [30, 35, 76],
    accent: [255, 225, 132], ground: [18, 28, 58],
  },
  beach: {
    label: "海風藍岸", icon: "≈",
    skyTop: [67, 171, 225], skyBottom: [255, 220, 171],
    accent: [106, 225, 234], ground: [234, 206, 145],
  },
};
let selectedSceneKey = "night";
let scenePreviewKey = "night";
let gachaSpinning = false;
let gachaResultReady = false;
let gachaStartMs = 0;
let gachaParticles = [];
const GACHA_SPIN_MS = 1900;

// --- 掃碼領取拍貼 ---
let pickupState = "idle"; // idle | uploading | ready | error
let pickupQrImg = null;
let pickupClaimUrl = "";
let pickupError = "";

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
  updateGacha();
  background(5, 8, 20);
  drawSky3D();
  drawAmbientDepth3D();

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
    prepareSelfieStep();
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
      prepareSelfieStep();
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
  prepareSelfieStep();
}

function prepareSelfieStep() {
  cancelBoothSequence();
  stopCamera();
  selfieImg = null;
  selfieShots = [];
  cameraError = "";
  pickupState = "idle";
  pickupQrImg = null;
  pickupClaimUrl = "";
  pickupError = "";
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
    gachaSpin: new CanvasButton(VW / 2 - 220, bottomY, 440, 92, "轉動願望扭蛋", "tap", "primary"),
    gachaAgain: new CanvasButton(VW / 2 - 330, bottomY, 280, 84, "再抽一次", "tap", "secondary"),
    gachaContinue: new CanvasButton(VW / 2 + 10, bottomY, 360, 84, "帶著場景許願", "tap", "primary"),

    holdRecord: new CanvasButton(centerX, centerY, bigW, bigH, "按著錄音", "hold", "primary"),

    takePhoto: new CanvasButton(VW / 2 - 180, bottomY, 360, 84, "開啟相機", "tap", "primary"),
    photoRedo: new CanvasButton(VW / 2 - 320, bottomY, 280, 84, "重拍三張", "tap", "secondary"),
    photoNext: new CanvasButton(VW / 2 + 40, bottomY, 280, 84, "使用這組", "tap", "primary"),

    frameHearts: new CanvasButton(862, 270, 150, 58, "愛心粉", "tap", "choice"),
    frameStars: new CanvasButton(1030, 270, 150, 58, "星光金", "tap", "choice"),
    frameDream: new CanvasButton(862, 344, 150, 58, "夢幻紫", "tap", "choice"),
    frameClassic: new CanvasButton(1030, 344, 150, 58, "經典白", "tap", "choice"),

    saveLantern: new CanvasButton(VW / 2 - 190, bottomY, 380, 92, "儲存天燈", "tap", "primary"),
    retryPickup: new CanvasButton(836, 496, 260, 58, "重新產生 QR", "tap", "choice"),

    backToStart: new CanvasButton(VW / 2 - 320, bottomY, 280, 84, "回到開始", "tap", "secondary"),
    releaseAll: new CanvasButton(VW / 2 + 40, bottomY, 280, 84, "釋放天燈", "tap", "primary"),
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
  if (state === "scene") {
    if ((id === "gachaSpin" || id === "gachaAgain") && !gachaSpinning) {
      startGachaSpin();
      return;
    }
    if (id === "gachaContinue" && gachaResultReady && !gachaSpinning) {
      state = "wish";
      return;
    }
  }

  if (state === "selfie") {
    if (FRAME_OPTIONS[id] && !boothShooting) {
      selectedFrameStyle = FRAME_OPTIONS[id].key;
      if (selfieShots.length === BOOTH_SHOT_COUNT) {
        selfieImg = composePhotoBoothCard(selfieShots, selectedFrameStyle);
      }
      return;
    }
    if (id === "takePhoto") {
      if (cameraStarting || boothShooting) return;
      if (!camWorking()) { startCamera(); return; }
      startBoothSequence();
      return;
    }
    if (id === "photoRedo") {
      cancelBoothSequence();
      stopCamera();
      selfieImg = null;
      selfieShots = [];
      cameraError = "";
      return;
    }
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
      preparePhotoPickup(selfieImg);
      return;
    }
  }

  if (state === "saved") {
    if (id === "retryPickup" && pickupState === "error") {
      preparePhotoPickup(selfieImg);
      return;
    }
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
  cancelBoothSequence();
  stopCamera();
  state = "scene";
  gachaResultReady = false;
  gachaSpinning = false;
  selfieImg = null;
  selfieShots = [];
  pickupState = "idle";
  pickupQrImg = null;
  pickupClaimUrl = "";
  pickupError = "";
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
  if (state === "scene") {
    if (gachaSpinning) return [];
    return gachaResultReady ? ["gachaAgain", "gachaContinue"] : ["gachaSpin"];
  }
  if (state === "wish") return ["holdRecord"];
  if (state === "selfie") {
    const frames = boothShooting ? [] : Object.keys(FRAME_OPTIONS);
    return selfieImg ? [...frames, "photoRedo", "photoNext"] : [...frames, "takePhoto"];
  }
  if (state === "final") return ["saveLantern"];
  if (state === "saved") {
    const retry = pickupState === "error" ? ["retryPickup"] : [];
    return [...retry, "backToStart", "releaseAll"];
  }
  if (state === "release_fx" || state === "release") return ["backToStart"];
  return [];
}

// ==================================================
// 全域 3D 舞台：景深、光環、漂浮粒子
// ==================================================
function drawAmbientDepth3D() {
  const key = gachaSpinning ? scenePreviewKey : selectedSceneKey;
  const theme = SCENE_THEMES[key] || SCENE_THEMES.night;
  const pointerX = typeof mouseX === "number" ? map(mouseX, 0, max(1, width), -1, 1) : 0;
  const pointerY = typeof mouseY === "number" ? map(mouseY, 0, max(1, height), -1, 1) : 0;

  push();
  rotateX(radians(72 + pointerY * 2.2));
  rotateZ(frameCount * 0.0018 + pointerX * 0.035);
  translate(pointerX * 24, height * 0.42, -540);
  noFill();
  for (let i = 0; i < 4; i++) {
    stroke(...theme.accent, 42 - i * 7);
    strokeWeight(2.2 - i * 0.28);
    torus(min(width, height) * (0.38 + i * 0.12), 2.4, 72, 8);
    translate(0, 0, -18);
  }
  pop();

  push();
  noStroke();
  for (let i = 0; i < 30; i++) {
    const orbit = i * 2.399 + frameCount * (0.0025 + (i % 4) * 0.0008);
    const radius = min(width, height) * (0.22 + (i % 7) * 0.075);
    const z = -260 - (i % 6) * 105;
    const x = cos(orbit) * radius + pointerX * (10 + (i % 4) * 4);
    const y = sin(orbit * 1.31) * radius * 0.58 + pointerY * 10;
    const pulse = 0.55 + 0.45 * sin(frameCount * 0.035 + i * 1.7);
    push();
    translate(x, y, z);
    fill(...theme.accent, 35 + 70 * pulse);
    sphere(2.2 + (i % 3) * 1.4, 8, 6);
    pop();
  }
  pop();
}

function drawHudAtmosphere3D() {
  const theme = SCENE_THEMES[gachaSpinning ? scenePreviewKey : selectedSceneKey] || SCENE_THEMES.night;
  const pulse = 0.5 + 0.5 * sin(frameCount * 0.022);
  hud.noStroke();
  hud.fill(4, 7, 24, 68);
  hud.ellipse(VW * 0.5, VH * 0.2 + 10, VW * 0.92, VH * 0.4);
  hud.fill(...theme.accent, 12 + 12 * pulse);
  hud.ellipse(VW * 0.5, VH * 0.19, VW * 0.72, VH * 0.28);

  for (let i = 0; i < 18; i++) {
    const a = i * 2.08 + frameCount * 0.006;
    const rx = 430 + (i % 5) * 42;
    const ry = 185 + (i % 4) * 24;
    const x = VW / 2 + cos(a) * rx;
    const y = VH / 2 + sin(a * 1.17) * ry;
    const s = 2 + (i % 3) * 1.8;
    hud.fill(...theme.accent, 38 + 50 * sin(frameCount * 0.04 + i));
    hud.ellipse(x, y, s, s);
  }
}

function drawHudVignette3D() {
  const ctx = hud.drawingContext;
  ctx.save();
  const vignette = ctx.createRadialGradient(VW / 2, VH * 0.46, VH * 0.12, VW / 2, VH * 0.5, VW * 0.86);
  vignette.addColorStop(0, "rgba(4,7,24,0)");
  vignette.addColorStop(0.7, "rgba(4,7,24,0.04)");
  vignette.addColorStop(1, "rgba(2,4,16,0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

function drawPanel3D(g, x, y, w, h, r, accent, depth = 14, face = [11, 16, 42, 225]) {
  const glow = accent || [255, 213, 116];
  g.push();
  g.noStroke();
  g.fill(0, 0, 0, 72);
  roundedRect(g, x + 10, y + depth + 15, w, h, r + 3);

  for (let d = depth; d >= 1; d -= 2) {
    const t = d / max(1, depth);
    g.fill(3 + glow[0] * 0.055, 6 + glow[1] * 0.04, 18 + glow[2] * 0.035, 218);
    roundedRect(g, x, y + d, w, h, r);
    if (t < 0.28) break;
  }

  g.fill(...face);
  roundedRect(g, x, y, w, h, r);

  const ctx = g.drawingContext;
  ctx.save();
  const sheen = ctx.createLinearGradient(x, y, x, y + h);
  sheen.addColorStop(0, "rgba(255,255,255,0.17)");
  sheen.addColorStop(0.34, "rgba(255,255,255,0.035)");
  sheen.addColorStop(1, "rgba(0,0,0,0.17)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x + 1, y + 1, w - 2, h - 2, max(1, r - 1));
  else ctx.rect(x + 1, y + 1, w - 2, h - 2);
  ctx.fill();
  ctx.restore();

  g.noFill();
  g.stroke(...glow, 155);
  g.strokeWeight(2.4);
  roundedRect(g, x, y, w, h, r);
  g.stroke(255, 255, 255, 85);
  g.strokeWeight(1.4);
  roundedRect(g, x + 5, y + 5, w - 10, h * 0.43, max(6, r - 5));
  g.noStroke();
  g.fill(255, 255, 255, 195);
  g.ellipse(x + 22, y + 18, 5, 5);
  g.fill(...glow, 120);
  g.ellipse(x + w - 22, y + h - 18, 7, 7);
  g.pop();
}

// ==================================================
// HUD（大字 + 行距 + 不重疊）
// ==================================================
function drawHUD() {
  hud.clear();

  drawHudAtmosphere3D();

  const TITLE_SIZE = 48;
  const SUB_BASE_SIZE = 40;
  const TOP_PAD = 16;
  const GAP = 36;
  const SUB_MAX_W = VW * 0.88;
  const SUB_MIN_SIZE = 30;

  hud.textAlign(CENTER, TOP);

  const activeTheme = SCENE_THEMES[gachaSpinning ? scenePreviewKey : selectedSceneKey] || SCENE_THEMES.night;
  hud.textSize(TITLE_SIZE);
  hud.textLeading(TITLE_SIZE * 1.35);
  hud.textStyle(BOLD);

  const titleY = TOP_PAD;
  const title = getTitleText();
  hud.fill(7, 9, 25, 185);
  hud.text(title, VW / 2 + 4, titleY + 7);
  hud.stroke(...activeTheme.accent, 125);
  hud.strokeWeight(3);
  hud.fill(255);
  hud.text(title, VW / 2, titleY);
  hud.noStroke();
  hud.textStyle(NORMAL);

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

  hud.fill(7, 9, 25, 150);
  hud.text(sub, VW / 2 + 3, subY + 5);
  hud.fill(243, 246, 255);
  hud.textSize(subSize);
  hud.textLeading(subSize * 1.55);
  hud.text(sub, VW / 2, subY);

  const lines = max(1, sub.split("\n").length);
  const headerBottom = subY + lines * subSize * 1.55;

  if (state === "scene") drawGachaScreen(headerBottom + 6);
  if (state === "selfie") drawCameraScreen(headerBottom + 18);
  if (state === "final") drawFinalPreview(headerBottom + 18);

  if (state === "saved") drawSavedPickupScreen(headerBottom + 18);

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
  if (state !== "scene") drawCurrentSceneBadge();

  const visible = getVisibleButtons();
  if (buttons.takePhoto) {
    buttons.takePhoto.label = cameraStarting
      ? "開啟中…"
      : (boothShooting ? "拍攝中…" : (camWorking() ? "開始三連拍" : "開啟相機"));
  }
  for (const id of visible) buttons[id].draw(hud, isButtonHot(id));

  drawHudVignette3D();

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
  if (FRAME_OPTIONS[id] && FRAME_OPTIONS[id].key === selectedFrameStyle) return true;
  if (pointerDown && pointerDownId === id) return true;
  if (typeof mouseX === "number" && typeof mouseY === "number" && buttons[id]) {
    const p = pointerToHUD(mouseX, mouseY);
    return buttons[id].hit(p.x, p.y);
  }
  return false;
}

function drawCurrentSceneBadge() {
  const scene = SCENE_THEMES[selectedSceneKey] || SCENE_THEMES.night;
  const pulse = 0.5 + 0.5 * sin(frameCount * 0.045);
  hud.noStroke();
  hud.fill(0, 0, 0, 75);
  roundedRect(hud, 26, 27, 196, 50, 20);
  hud.fill(15, 18, 45, 235);
  roundedRect(hud, 22, 18, 196, 50, 20);
  hud.fill(255, 255, 255, 30 + 20 * pulse);
  roundedRect(hud, 27, 23, 186, 22, 15);
  hud.noFill();
  hud.stroke(...scene.accent, 130 + 80 * pulse);
  hud.strokeWeight(2.5);
  roundedRect(hud, 22, 18, 196, 50, 20);
  hud.noStroke();
  hud.fill(...scene.accent, 245);
  hud.textAlign(CENTER, CENTER);
  hud.textSize(25);
  hud.text(scene.icon, 52, 43);
  hud.fill(255);
  hud.textAlign(LEFT, CENTER);
  hud.textSize(19);
  hud.text(scene.label, 76, 43);
}

function getTitleText() {
  if (state === "scene") return "願望扭蛋機";
  if (state === "wish") return "STEP 1";
  if (state === "selfie") return "STEP 2｜願望拍貼機";
  if (state === "final") return "STEP 3";
  if (state === "saved") return "STEP 4";
  if (state === "release_fx" || state === "release") return "釋放天燈";
  return "";
}

function getSubtitleText() {
  if (state === "scene") {
    if (gachaSpinning) return "命運場景正在滾動…";
    if (gachaResultReady) return `你抽到｜${SCENE_THEMES[selectedSceneKey].label}`;
    return "轉動扭蛋，抽出今天的願望場景";
  }
  if (state === "wish") return micHolding ? "放開就完成" : "按住錄音";
  if (state === "selfie") {
    if (selfieImg) return "三張拍貼完成，可換相框或重新拍攝";
    if (boothShooting) return `自動連拍中｜第 ${boothShotNumber} / ${BOOTH_SHOT_COUNT} 張`;
    if (cameraStarting) return "正在要求相機權限";
    if (cameraError) return cameraError;
    return camWorking() ? "選好相框後，按一次開始三連拍" : "先選相框，再開啟相機";
  }
  if (state === "final") return "按下儲存天燈";
  if (state === "saved") {
    if (pickupState === "ready") return "掃描 QR，把願望拍貼帶走";
    if (pickupState === "error") return "QR 產生失敗，照片仍保留在這一頁";
    return "正在製作你的專屬領取 QR…";
  }
  if (state === "release_fx") return "5 秒後升空";
  if (state === "release") return "天燈升空中";
  return "";
}

function startGachaSpin() {
  gachaSpinning = true;
  gachaResultReady = false;
  gachaStartMs = millis();
  gachaParticles = [];
}

function updateGacha() {
  if (!gachaSpinning) return;
  const keys = Object.keys(SCENE_THEMES);
  const elapsed = millis() - gachaStartMs;
  scenePreviewKey = keys[floor(elapsed / 120) % keys.length];

  if (elapsed >= GACHA_SPIN_MS) {
    const choices = keys.filter((key) => key !== selectedSceneKey);
    selectedSceneKey = random(choices);
    scenePreviewKey = selectedSceneKey;
    gachaSpinning = false;
    gachaResultReady = true;
    burstGachaParticles();
  }
}

function burstGachaParticles() {
  const palette = SCENE_THEMES[selectedSceneKey];
  gachaParticles = [];
  for (let i = 0; i < 112; i++) {
    const a = random(-PI, 0);
    const speed = random(3.2, 11.5);
    gachaParticles.push({
      x: VW / 2,
      y: 395,
      vx: cos(a) * speed,
      vy: sin(a) * speed - random(1, 4),
      life: random(70, 120),
      size: random(5, 13),
      col: random([palette.accent, [255, 255, 255], [255, 191, 223]]),
      rot: random(TWO_PI),
      streak: random(1.6, 4.5),
    });
  }
}

function drawGachaScreen(yTop) {
  const y = min(yTop, 188);
  const cx = VW / 2;
  const globeY = y + 135;
  const globeR = 145;
  const sceneKey = gachaSpinning ? scenePreviewKey : selectedSceneKey;
  const scene = SCENE_THEMES[sceneKey];

  // 整台機器浮在有景深的展示台上。
  hud.noStroke();
  hud.fill(0, 0, 0, 78);
  hud.ellipse(cx, y + 372, 670, 72);
  hud.fill(...scene.accent, 22);
  hud.ellipse(cx, y + 360, 590, 54);
  drawPanel3D(hud, 240, y - 16, 800, 356, 42, scene.accent, 18, [8, 12, 36, 188]);

  // 立體背板與環形跑馬燈。
  hud.noFill();
  for (let ring = 0; ring < 3; ring++) {
    hud.stroke(...scene.accent, 55 - ring * 12);
    hud.strokeWeight(3 - ring * 0.55);
    hud.ellipse(cx, globeY + 6, globeR * 2 + 55 + ring * 24, globeR * 2 + 55 + ring * 24);
  }
  hud.noStroke();
  for (let i = 0; i < 18; i++) {
    const a = i * TWO_PI / 18 + frameCount * (gachaSpinning ? 0.035 : 0.006);
    const rr = globeR + 37;
    const lampPulse = 0.45 + 0.55 * sin(frameCount * 0.11 + i * 0.8);
    hud.fill(...scene.accent, 90 + 150 * lampPulse);
    hud.ellipse(cx + cos(a) * rr, globeY + sin(a) * rr, 7 + 4 * lampPulse, 7 + 4 * lampPulse);
  }
  if (gachaSpinning) {
    const spinPulse = 0.5 + 0.5 * sin(frameCount * 0.25);
    hud.noFill();
    for (let i = 0; i < 8; i++) {
      const start = frameCount * 0.13 + i * TWO_PI / 8;
      hud.stroke(...scene.accent, 90 + 100 * spinPulse);
      hud.strokeWeight(4 + (i % 3) * 2);
      hud.arc(cx, globeY, globeR * 2 + 84 + i * 5, globeR * 2 + 84 + i * 5, start, start + 0.34 + i * 0.018);
    }
  }

  // 透明球罩內的扭蛋會持續漂動，轉動時速度加快。
  const ctx = hud.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, globeY, globeR - 8, 0, Math.PI * 2);
  ctx.clip();
  const glass = ctx.createRadialGradient(cx - 48, globeY - 58, 8, cx, globeY, globeR * 1.08);
  glass.addColorStop(0, "rgba(255,255,255,0.48)");
  glass.addColorStop(0.24, "rgba(96,125,220,0.24)");
  glass.addColorStop(0.72, "rgba(18,25,67,0.88)");
  glass.addColorStop(1, "rgba(5,9,31,0.98)");
  ctx.fillStyle = glass;
  ctx.fillRect(cx - globeR, globeY - globeR, globeR * 2, globeR * 2);

  const sceneKeys = Object.keys(SCENE_THEMES);
  for (let i = 0; i < 14; i++) {
    const speed = gachaSpinning ? 0.085 : 0.018;
    const angle = i * 2.17 + frameCount * speed * (i % 2 ? 1 : -1);
    const radius = 35 + (i % 4) * 24;
    const px = cx + cos(angle) * radius;
    const py = globeY + sin(angle * 1.3) * radius * 0.72 + 28;
    const key = sceneKeys[i % sceneKeys.length];
    drawGachaCapsule(hud, px, py, 31, angle, SCENE_THEMES[key]);
  }
  ctx.restore();

  // 厚玻璃球罩：暗側、亮邊與鏡面反光。
  hud.noFill();
  hud.stroke(3, 7, 25, 205);
  hud.strokeWeight(18);
  hud.ellipse(cx + 5, globeY + 9, globeR * 2 + 10, globeR * 2 + 10);
  hud.noFill();
  hud.stroke(255, 245, 220, 220);
  hud.strokeWeight(8);
  hud.ellipse(cx, globeY, globeR * 2, globeR * 2);
  hud.stroke(255, 255, 255, 80);
  hud.strokeWeight(4);
  hud.arc(cx - 24, globeY - 18, globeR * 1.35, globeR * 1.35, PI + 0.2, TWO_PI - 0.25);

  hud.stroke(255, 255, 255, 145);
  hud.strokeWeight(7);
  hud.arc(cx - 28, globeY - 27, globeR * 1.42, globeR * 1.42, PI + 0.28, TWO_PI - 0.32);

  // 機台與會轉動的立體把手。
  for (let d = 22; d >= 3; d -= 3) {
    hud.noStroke();
    hud.fill(88 - d, 28, 74, 245);
    roundedRect(hud, cx - 176, globeY + 112 + d, 352, 132, 34);
  }
  const baseCtx = hud.drawingContext;
  baseCtx.save();
  const baseGrad = baseCtx.createLinearGradient(cx - 176, globeY + 112, cx + 176, globeY + 244);
  baseGrad.addColorStop(0, "#ff9dc4");
  baseGrad.addColorStop(0.48, "#ff6ca4");
  baseGrad.addColorStop(1, "#bf3f84");
  baseCtx.fillStyle = baseGrad;
  baseCtx.beginPath();
  if (baseCtx.roundRect) baseCtx.roundRect(cx - 176, globeY + 112, 352, 132, 34);
  else baseCtx.rect(cx - 176, globeY + 112, 352, 132);
  baseCtx.fill();
  baseCtx.restore();

  hud.noStroke();
  hud.fill(255, 255, 255, 62);
  roundedRect(hud, cx - 164, globeY + 121, 328, 42, 24);

  for (let d = 11; d >= 2; d -= 3) {
    hud.fill(118, 76, 30, 225);
    roundedRect(hud, cx - 144, globeY + 142 + d, 288, 76, 26);
  }
  const plateCtx = hud.drawingContext;
  plateCtx.save();
  const plateGrad = plateCtx.createLinearGradient(cx, globeY + 142, cx, globeY + 218);
  plateGrad.addColorStop(0, "#fff19a");
  plateGrad.addColorStop(0.55, "#ffd75c");
  plateGrad.addColorStop(1, "#d89d25");
  plateCtx.fillStyle = plateGrad;
  plateCtx.beginPath();
  if (plateCtx.roundRect) plateCtx.roundRect(cx - 144, globeY + 142, 288, 76, 26);
  else plateCtx.rect(cx - 144, globeY + 142, 288, 76);
  plateCtx.fill();
  plateCtx.restore();
  hud.noFill();
  hud.stroke(255, 250, 205, 210);
  hud.strokeWeight(3);
  roundedRect(hud, cx - 144, globeY + 142, 288, 76, 26);
  hud.fill(68, 35, 74);
  hud.noStroke();
  hud.textAlign(CENTER, CENTER);
  hud.textStyle(BOLD);
  hud.textSize(30);
  hud.text(gachaResultReady ? `${scene.icon} ${scene.label}` : "WISH GACHA", cx, globeY + 180);
  hud.textStyle(NORMAL);

  hud.push();
  hud.translate(cx + 205, globeY + 170);
  hud.rotate(gachaSpinning ? frameCount * 0.24 : -0.35);
  hud.noStroke();
  hud.fill(0, 0, 0, 105);
  hud.ellipse(7, 9, 72, 72);
  hud.fill(122, 72, 23, 235);
  hud.ellipse(3, 5, 68, 68);
  hud.fill(255, 225, 115);
  hud.ellipse(0, 0, 62, 62);
  hud.fill(255, 255, 255, 105);
  hud.ellipse(-13, -14, 22, 16);
  hud.fill(255, 247, 216);
  hud.rect(-8, -4, 88, 20, 10);
  hud.fill(143, 77, 95);
  hud.rect(-8, 8, 88, 9, 6);
  hud.fill(255, 247, 216);
  roundedRect(hud, -8, -10, 88, 20, 10);
  hud.fill(255, 118, 160);
  hud.ellipse(84, 5, 38, 38);
  hud.ellipse(82, 0, 34, 34);
  hud.fill(255, 255, 255, 95);
  hud.ellipse(75, -7, 11, 8);
  hud.pop();

  drawGachaParticles();
}

function drawGachaCapsule(g, x, y, size, angle, scene) {
  g.push();
  g.translate(x, y);
  g.rotate(angle * 0.35);
  g.noStroke();
  g.fill(0, 0, 0, 70);
  g.ellipse(4, 7, size * 2.08, size * 2.08);
  g.fill(...scene.accent, 245);
  g.arc(0, 0, size * 2, size * 2, PI, TWO_PI, CHORD);
  g.fill(250, 249, 255, 245);
  g.arc(0, 0, size * 2, size * 2, 0, PI, CHORD);
  g.noFill();
  g.stroke(255, 255, 255, 185);
  g.strokeWeight(2.2);
  g.arc(-3, -2, size * 1.6, size * 1.6, PI + 0.15, TWO_PI - 0.35);
  g.stroke(255, 255, 255, 185);
  g.strokeWeight(3);
  g.line(-size, 0, size, 0);
  g.noStroke();
  g.fill(255, 255, 255, 145);
  g.ellipse(-size * 0.34, -size * 0.42, size * 0.34, size * 0.22);
  g.fill(55, 37, 72);
  g.textAlign(CENTER, CENTER);
  g.textSize(size * 0.8);
  g.text(scene.icon, 0, size * 0.32);
  g.pop();
}

function drawGachaParticles() {
  for (const p of gachaParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 1;
    p.rot += 0.08;
    hud.push();
    hud.translate(p.x, p.y);
    hud.stroke(...p.col, constrain(p.life * 1.8, 0, 180));
    hud.strokeWeight(max(1, p.size * 0.2));
    hud.line(0, 0, -p.vx * p.streak, -p.vy * p.streak);
    hud.rotate(p.rot);
    hud.noStroke();
    hud.fill(...p.col, constrain(p.life * 0.8, 0, 80));
    hud.ellipse(0, 0, p.size * 2.8, p.size * 2.8);
    hud.fill(...p.col, constrain(p.life * 2.2, 0, 230));
    hud.rect(-p.size / 2, -p.size / 2, p.size, p.size, 3);
    hud.pop();
  }
  gachaParticles = gachaParticles.filter((p) => p.life > 0 && p.y < VH + 40);
}

function drawCameraScreen(yTop) {
  const screenW = 720;
  const screenH = 360;
  const x = 60;
  const y = min(yTop, VH - screenH - 160);
  const theme = SCENE_THEMES[selectedSceneKey] || SCENE_THEMES.night;

  drawPanel3D(hud, x - 22, y - 22, screenW + 44, screenH + 44, 28, theme.accent, 16, [8, 12, 33, 235]);

  // 拍貼機螢幕的內縮金屬框。
  for (let d = 11; d >= 2; d -= 3) {
    hud.noFill();
    hud.stroke(2, 5, 19, 150 + d * 6);
    hud.strokeWeight(3);
    roundedRect(hud, x - d / 2, y - d / 2, screenW + d, screenH + d, 14 + d / 2);
  }
  hud.noFill();
  hud.stroke(255, 255, 255, 95);
  hud.strokeWeight(2);
  roundedRect(hud, x + 4, y + 4, screenW - 8, screenH - 8, 13);

  hud.noStroke();
  if (selfieImg) {
    const previewSize = min(screenH, screenW);
    hud.image(selfieImg, x + (screenW - previewSize) / 2, y, previewSize, previewSize);
  } else {
    const ok = camWorking();
    if (ok) {
      // 自拍預覽左右鏡像，拍下來的照片也保持同一個方向。
      const ctx = hud.drawingContext;
      ctx.save();
      ctx.translate(x + screenW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(cam, 0, 0, screenW, screenH);
      ctx.restore();
    }
    hud.fill(0, 0, 0, 90);
    hud.rect(x, y + screenH - 70, screenW, 70);
    hud.fill(255);
    hud.textAlign(CENTER, CENTER);
    hud.textSize(40);
    const hint = ok
      ? (boothShooting ? `第 ${boothShotNumber} 張準備中` : "臉放中間，按開始三連拍")
      : (cameraStarting ? "相機開啟中…" : (cameraError || "按開啟相機開始預覽"));
    hud.text(hint, x + screenW / 2, y + screenH - 35);

    if (boothShooting && boothCountdown > 0) {
      hud.fill(8, 10, 24, 130);
      hud.ellipse(x + screenW / 2, y + screenH / 2, 170, 170);
      hud.noFill();
      for (let ring = 0; ring < 4; ring++) {
        hud.stroke(...theme.accent, 120 - ring * 22);
        hud.strokeWeight(3 - ring * 0.45);
        const rr = 180 + ring * 22 + sin(frameCount * 0.12) * 8;
        hud.ellipse(x + screenW / 2, y + screenH / 2, rr, rr);
      }
      hud.noFill();
      hud.stroke(255, 225, 120, 240);
      hud.strokeWeight(7);
      hud.ellipse(x + screenW / 2, y + screenH / 2, 150, 150);
      hud.noStroke();
      hud.fill(255);
      hud.textAlign(CENTER, CENTER);
      hud.textSize(100);
      hud.text(boothCountdown, x + screenW / 2, y + screenH / 2 - 4);
    }

    if (Date.now() < boothFlashUntil) {
      hud.fill(255, 255, 255, 225);
      hud.rect(x, y, screenW, screenH);
    }
  }

  hud.noStroke();
  hud.fill(8, 10, 24, 165);
  roundedRect(hud, x + 18, y + 18, 112, 48, 18);
  hud.fill(255);
  hud.textAlign(CENTER, CENTER);
  hud.textSize(24);
  hud.text(`${selfieShots.length} / ${BOOTH_SHOT_COUNT}`, x + 74, y + 42);

  drawFramePicker(y);
}

function drawFramePicker(y) {
  const x = 812;
  const w = 408;
  const h = 360;
  const theme = SCENE_THEMES[selectedSceneKey] || SCENE_THEMES.night;
  drawPanel3D(hud, x, y - 16, w, h + 32, 26, theme.accent, 14, [14, 18, 46, 238]);
  hud.noStroke();
  hud.fill(255);
  hud.textAlign(CENTER, TOP);
  hud.textSize(30);
  hud.text("選擇拍貼相框", x + w / 2, y + 22);
  hud.fill(210, 216, 242);
  hud.textSize(22);
  hud.text("拍完後也可以換框", x + w / 2, y + 64);

  drawFrameSample(x + 96, y + 222, selectedFrameStyle);
}

function drawFrameSample(cx, cy, style) {
  const palette = getFramePalette(style);
  const w = 216;
  const h = 112;
  hud.noStroke();
  hud.fill(0, 0, 0, 90);
  roundedRect(hud, cx + 7, cy + 10, w, h, 16);
  hud.fill(70, 45, 90, 170);
  roundedRect(hud, cx + 3, cy + 5, w, h, 16);
  hud.fill(...palette.bg);
  roundedRect(hud, cx, cy, w, h, 16);
  hud.fill(255, 255, 255, 42);
  roundedRect(hud, cx + 5, cy + 5, w - 10, h * 0.42, 12);
  hud.fill(...palette.paper);
  roundedRect(hud, cx + 14, cy + 14, 56, 70, 8);
  roundedRect(hud, cx + 80, cy + 14, 56, 70, 8);
  roundedRect(hud, cx + 146, cy + 14, 56, 70, 8);
  hud.fill(...palette.ink);
  hud.textAlign(CENTER, CENTER);
  hud.textSize(20);
  hud.text("WISH BOOTH ✦", cx + w / 2, cy + 98);
}

function camWorking() {
  return !!(cam && cam.videoWidth > 0 && cam.readyState >= 2);
}

async function startCamera() {
  if (cameraStarting || camWorking()) return;
  cameraStarting = true;
  cameraError = "";

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("CAMERA_UNSUPPORTED");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "user" } },
      audio: false,
    });

    cam = document.createElement("video");
    cam.autoplay = true;
    cam.muted = true;
    cam.playsInline = true;
    cam.setAttribute("playsinline", "");
    cam.srcObject = cameraStream;
    cam.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(cam);
    await cam.play();
  } catch (err) {
    stopCamera();
    if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      cameraError = "相機權限被拒絕，請在瀏覽器設定中允許";
    } else if (err && err.name === "NotFoundError") {
      cameraError = "找不到可用的相機";
    } else if (err && err.message === "CAMERA_UNSUPPORTED") {
      cameraError = "這個瀏覽器不支援即時相機";
    } else {
      cameraError = "相機無法啟動，請改用 Chrome 或 Safari";
    }
  } finally {
    cameraStarting = false;
  }
}

function captureCameraFrame() {
  if (!camWorking()) return null;
  const w = cam.videoWidth;
  const h = cam.videoHeight;
  const shot = createGraphics(w, h);
  const ctx = shot.drawingContext;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(cam, 0, 0, w, h);
  ctx.restore();
  const img = shot.get();
  shot.remove();
  return img;
}

async function startBoothSequence() {
  if (!camWorking() || boothShooting) return;
  const session = ++boothSession;
  boothShooting = true;
  boothCountdown = 0;
  boothShotNumber = 1;
  selfieImg = null;
  selfieShots = [];

  for (let i = 0; i < BOOTH_SHOT_COUNT; i++) {
    boothShotNumber = i + 1;
    for (let count = 3; count >= 1; count--) {
      if (session !== boothSession || !camWorking()) return;
      boothCountdown = count;
      await waitForBooth(720);
    }

    if (session !== boothSession || !camWorking()) return;
    boothCountdown = 0;
    const shot = captureCameraFrame();
    if (shot) selfieShots.push(shot);
    boothFlashUntil = Date.now() + 190;
    if (navigator.vibrate) navigator.vibrate(55);
    await waitForBooth(720);
  }

  if (session !== boothSession) return;
  boothShooting = false;
  boothShotNumber = 0;
  boothCountdown = 0;
  selfieImg = composePhotoBoothCard(selfieShots, selectedFrameStyle);
  stopCamera();
}

function cancelBoothSequence() {
  boothSession++;
  boothShooting = false;
  boothCountdown = 0;
  boothShotNumber = 0;
  boothFlashUntil = 0;
}

function waitForBooth(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function composePhotoBoothCard(shots, style) {
  if (!shots || shots.length !== BOOTH_SHOT_COUNT) return null;
  const palette = getFramePalette(style);
  const card = createGraphics(900, 900);
  card.pixelDensity(1);
  card.background(...palette.bg);

  card.noStroke();
  card.fill(24, 15, 40, 70);
  roundedRect(card, 36, 36, 842, 848, 40);
  card.fill(...palette.accent);
  roundedRect(card, 18, 16, 864, 864, 42);
  card.fill(...palette.paper);
  roundedRect(card, 24, 22, 852, 856, 38);
  card.fill(255, 255, 255, 72);
  roundedRect(card, 34, 32, 832, 210, 30);

  card.fill(...palette.ink);
  card.textAlign(CENTER, CENTER);
  card.textStyle(BOLD);
  card.textSize(42);
  card.fill(0, 0, 0, 45);
  card.text("WISH BOOTH", 453, 70);
  card.fill(...palette.ink);
  card.text("WISH BOOTH", 450, 66);
  card.textStyle(NORMAL);
  card.textSize(22);
  card.text("三張照片・一個願望・好多祝福", 450, 104);

  drawBoothPhoto(card, shots[0], 58, 136, 784, 372, palette);
  drawBoothPhoto(card, shots[1], 58, 532, 378, 240, palette);
  drawBoothPhoto(card, shots[2], 464, 532, 378, 240, palette);

  card.fill(...palette.ink);
  card.textAlign(CENTER, CENTER);
  card.textSize(26);
  card.text("願望會發光  ✦  WISHES COME TRUE", 450, 824);

  drawBoothDecorations(card, style, palette);
  const result = card.get();
  card.remove();
  return result;
}

function drawBoothPhoto(g, img, x, y, w, h, palette) {
  g.noStroke();
  g.fill(25, 20, 40, 82);
  roundedRect(g, x + 11, y + 15, w, h, 22);
  g.fill(80, 52, 80, 75);
  roundedRect(g, x + 5, y + 8, w, h, 22);
  g.fill(...palette.accent);
  roundedRect(g, x - 7, y - 7, w + 14, h + 14, 22);
  g.fill(255);
  roundedRect(g, x, y, w, h, 16);

  const iw = max(1, img.width || 1);
  const ih = max(1, img.height || 1);
  const scale = max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  g.push();
  g.drawingContext.save();
  g.drawingContext.beginPath();
  g.drawingContext.rect(x, y, w, h);
  g.drawingContext.clip();
  g.image(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  g.drawingContext.restore();
  g.pop();

  g.noFill();
  g.stroke(255, 255, 255, 150);
  g.strokeWeight(3);
  roundedRect(g, x + 2, y + 2, w - 4, h - 4, 14);
  g.noStroke();
  g.fill(255, 255, 255, 48);
  roundedRect(g, x + 8, y + 8, w - 16, h * 0.24, 10);
}

function drawBoothDecorations(g, style, palette) {
  g.fill(...palette.accent);
  g.noStroke();
  g.textAlign(CENTER, CENTER);
  g.textStyle(BOLD);
  if (style === "hearts") {
    g.textSize(34);
    g.text("♡", 70, 70); g.text("♡", 830, 70);
    g.text("♥", 42, 810); g.text("♥", 858, 810);
  } else if (style === "stars") {
    g.textSize(34);
    g.text("✦", 70, 70); g.text("✧", 830, 70);
    g.text("★", 42, 810); g.text("★", 858, 810);
  } else if (style === "dream") {
    g.textSize(32);
    g.text("☾", 70, 70); g.text("✦", 830, 70);
    g.text("✧", 42, 810); g.text("☁", 858, 810);
  } else {
    g.textSize(24);
    g.text("●", 58, 68); g.text("●", 842, 68);
    g.text("—", 52, 810); g.text("—", 848, 810);
  }
  g.textStyle(NORMAL);
}

function getFramePalette(style) {
  if (style === "stars") {
    return { bg: [226, 180, 82], paper: [255, 249, 226], ink: [78, 52, 18], accent: [255, 214, 105] };
  }
  if (style === "dream") {
    return { bg: [145, 112, 211], paper: [246, 238, 255], ink: [72, 43, 112], accent: [191, 155, 244] };
  }
  if (style === "classic") {
    return { bg: [34, 38, 52], paper: [250, 250, 248], ink: [32, 34, 42], accent: [205, 208, 218] };
  }
  return { bg: [248, 145, 187], paper: [255, 239, 246], ink: [112, 40, 78], accent: [255, 102, 161] };
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (cam) {
    cam.pause();
    cam.srcObject = null;
    cam.remove();
    cam = null;
  }
}

window.addEventListener("pagehide", () => {
  cancelBoothSequence();
  stopCamera();
});

function drawFinalPreview(yTop) {
  const cardW = 980;
  const cardH = 260;
  const x = VW / 2 - cardW / 2;
  const y = min(yTop, VH - cardH - 160);
  const theme = SCENE_THEMES[selectedSceneKey] || SCENE_THEMES.night;

  hud.noStroke();
  hud.fill(...theme.accent, 24);
  hud.ellipse(VW / 2, y + cardH + 38, cardW * 0.88, 68);
  drawPanel3D(hud, x, y, cardW, cardH, 28, theme.accent, 18, [12, 16, 44, 226]);

  hud.noStroke();
  hud.fill(...theme.accent, 205);
  roundedRect(hud, x + 22, y + 24, 12, cardH - 48, 7);

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

function drawSavedPickupScreen(yTop) {
  const x = 80;
  const y = min(yTop, 184);
  const w = 1120;
  const h = 378;
  const theme = SCENE_THEMES[selectedSceneKey] || SCENE_THEMES.night;

  hud.noStroke();
  hud.fill(...theme.accent, 22);
  hud.ellipse(x + w / 2, y + h + 42, w * 0.9, 76);
  drawPanel3D(hud, x, y, w, h, 36, theme.accent, 18, [8, 13, 37, 238]);

  if (selfieImg) {
    hud.noStroke();
    hud.fill(0, 0, 0, 95);
    roundedRect(hud, x + 36, y + 42, 322, 322, 26);
    hud.fill(...theme.accent, 210);
    roundedRect(hud, x + 28, y + 28, 322, 322, 26);
    hud.fill(255, 255, 255, 60);
    roundedRect(hud, x + 34, y + 34, 310, 150, 22);
    hud.image(selfieImg, x + 39, y + 39, 300, 300);
    hud.noFill();
    hud.stroke(255, 255, 255, 145);
    hud.strokeWeight(3);
    roundedRect(hud, x + 38, y + 38, 302, 302, 20);
  }

  hud.noStroke();
  hud.fill(255);
  hud.textAlign(LEFT, TOP);
  hud.textStyle(BOLD);
  hud.textSize(32);
  hud.text("願望拍貼已完成", x + 382, y + 42);
  hud.textStyle(NORMAL);
  hud.fill(224, 228, 249);
  hud.textSize(22);
  hud.textLeading(34);
  const copy = pickupState === "ready"
    ? "拿手機掃描右側 QR Code\n即可開啟並下載這張拍貼。"
    : (pickupState === "error"
      ? `目前無法產生領取連結。\n${pickupError || "請稍後重試。"}`
      : "正在把拍貼安全送到領取頁…\n通常只需要幾秒鐘。");
  hud.text(copy, x + 382, y + 98);

  hud.fill(...theme.accent, 225);
  roundedRect(hud, x + 382, y + 212, 300, 52, 18);
  hud.fill(35, 28, 55);
  hud.textAlign(CENTER, CENTER);
  hud.textSize(22);
  hud.text(`${theme.icon} ${theme.label}`, x + 532, y + 238);

  const qrX = x + 802;
  const qrY = y + 54;
  hud.noStroke();
  hud.fill(0, 0, 0, 95);
  roundedRect(hud, qrX + 8, qrY + 12, 252, 252, 22);
  hud.fill(...theme.accent, 215);
  roundedRect(hud, qrX - 5, qrY - 5, 262, 262, 26);
  hud.fill(255);
  roundedRect(hud, qrX, qrY, 252, 252, 22);
  hud.fill(255, 255, 255, 75);
  roundedRect(hud, qrX + 8, qrY + 8, 236, 92, 16);

  if (pickupState === "ready" && pickupQrImg) {
    hud.image(pickupQrImg, qrX + 16, qrY + 16, 220, 220);
  } else if (pickupState === "error") {
    hud.fill(255, 122, 150);
    hud.textAlign(CENTER, CENTER);
    hud.textSize(68);
    hud.text("!", qrX + 126, qrY + 112);
    hud.fill(95, 62, 82);
    hud.textSize(20);
    hud.text("請重試", qrX + 126, qrY + 176);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = frameCount * 0.1 + i * TWO_PI / 10;
      const alpha = map(i, 0, 9, 45, 230);
      hud.fill(...theme.accent, alpha);
      hud.ellipse(qrX + 126 + cos(a) * 54, qrY + 126 + sin(a) * 54, 14, 14);
    }
  }

  hud.fill(208, 214, 239);
  hud.textAlign(CENTER, TOP);
  hud.textSize(18);
  hud.textLeading(25);
  hud.text("掃碼後可直接儲存照片\n24 小時後自動刪除", qrX + 126, qrY + 312);
}

async function preparePhotoPickup(img) {
  if (!img) {
    pickupState = "error";
    pickupError = "找不到拍貼照片";
    return;
  }

  pickupState = "uploading";
  pickupQrImg = null;
  pickupClaimUrl = "";
  pickupError = "";

  try {
    const sourceCanvas = img.canvas;
    if (!sourceCanvas || typeof sourceCanvas.toDataURL !== "function") {
      throw new Error("照片格式無法轉換");
    }
    const imageData = sourceCanvas.toDataURL("image/jpeg", 0.88);
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "savePhoto",
        imageData,
        wish: (finalWishText || "").slice(0, 160),
        scene: selectedSceneKey,
      }),
    });
    const data = await res.json();
    if (!data.ok || !data.claimUrl) throw new Error(data.error || "後端沒有回傳領取網址");
    pickupClaimUrl = String(data.claimUrl);
    pickupQrImg = await createQrTexture(pickupClaimUrl);
    pickupState = "ready";
  } catch (err) {
    pickupState = "error";
    pickupError = (err && err.message ? err.message : "照片上傳失敗").slice(0, 42);
  }
}

function createQrTexture(text) {
  return new Promise((resolve, reject) => {
    const host = document.getElementById("qrStage");
    if (!host || typeof QRCode === "undefined") {
      reject(new Error("QR 元件尚未載入"));
      return;
    }
    host.innerHTML = "";
    new QRCode(host, {
      text,
      width: 240,
      height: 240,
      colorDark: "#19152f",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });

    setTimeout(() => {
      const canvas = host.querySelector("canvas");
      const imageEl = host.querySelector("img");
      const dataUrl = canvas ? canvas.toDataURL("image/png") : (imageEl && imageEl.src);
      if (!dataUrl) {
        reject(new Error("QR 圖片建立失敗"));
        return;
      }
      loadImage(dataUrl, resolve, () => reject(new Error("QR 圖片讀取失敗")));
    }, 80);
  });
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
  const key = gachaSpinning ? scenePreviewKey : selectedSceneKey;
  const theme = SCENE_THEMES[key] || SCENE_THEMES.night;
  push();
  translate(0, 0, -900);
  noStroke();

  const topCol = color(...theme.skyTop);
  const bottomCol = color(...theme.skyBottom);
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const c = lerpColor(topCol, bottomCol, t);
    fill(red(c), green(c), blue(c), 255);
    push();
    translate(0, map(t, 0, 1, -height * 0.62, height * 0.62), 0);
    plane(width * 2.1, height / 12 + 3);
    pop();
  }

  if (key === "night" || key === "sunset") {
    const warmA = color(255, 190, 110);
    const warmB = color(255, 248, 214);
    for (const s of stars) {
      const tw = s.base + 0.4 * sin(frameCount * s.tw + s.off);
      const c = lerpColor(warmA, warmB, s.warm);
      stroke(red(c), green(c), blue(c), (key === "night" ? 120 : 35) + 120 * tw);
      strokeWeight(key === "night" ? 1.8 : 1.1);
      point(s.x * 0.6, s.y * 0.6, s.z + 720);
    }
    noStroke();
  }

  drawSceneFeatures3D(key, theme);
  pop();
}

function drawSceneFeatures3D(key, theme) {
  const drift = sin(frameCount * 0.006) * width * 0.04;

  if (key === "day") {
    fill(255, 229, 115, 245);
    ellipse(width * 0.31, -height * 0.28, 118, 118);
    drawSceneCloud(-width * 0.3 + drift, -height * 0.25, 1.2, 210);
    drawSceneCloud(width * 0.12 + drift * 0.6, -height * 0.1, 0.86, 180);
    drawRollingGround(theme.ground, 185);
  } else if (key === "sunset") {
    fill(255, 210, 125, 225);
    ellipse(width * 0.25, height * 0.08, 154, 154);
    fill(77, 60, 102, 245);
    ellipse(-width * 0.18, height * 0.34, width * 1.25, height * 0.46);
    fill(55, 48, 82, 250);
    ellipse(width * 0.28, height * 0.42, width * 1.5, height * 0.5);
    drawFlyingBirds();
  } else if (key === "beach") {
    fill(255, 232, 154, 245);
    ellipse(width * 0.3, -height * 0.22, 126, 126);
    fill(50, 169, 210, 245);
    rect(-width, height * 0.14, width * 2, height * 0.5);
    for (let i = 0; i < 8; i++) {
      const waveY = height * 0.18 + i * 28;
      stroke(198, 249, 255, 145 - i * 8);
      strokeWeight(4);
      noFill();
      beginShape();
      for (let x = -width; x <= width; x += 36) {
        vertex(x, waveY + sin(x * 0.025 + frameCount * 0.045 + i) * 7, 3);
      }
      endShape();
    }
    noStroke();
    fill(...theme.ground, 255);
    rect(-width, height * 0.46, width * 2, height * 0.35);
    drawSceneCloud(-width * 0.25 + drift, -height * 0.28, 0.9, 180);
  } else if (key === "garden") {
    drawSceneCloud(-width * 0.26 + drift, -height * 0.27, 0.82, 155);
    drawRollingGround(theme.ground, 170);
    drawGardenFlowers();
  } else {
    // 夜晚：月亮、遠山與會緩慢呼吸的微光。
    fill(255, 244, 203, 238);
    ellipse(width * 0.3, -height * 0.27, 106, 106);
    fill(12, 17, 43, 255);
    ellipse(width * 0.325, -height * 0.29, 92, 92);
    fill(...theme.ground, 245);
    ellipse(-width * 0.18, height * 0.42, width * 1.25, height * 0.5);
    ellipse(width * 0.34, height * 0.46, width * 1.5, height * 0.52);
    for (let i = 0; i < 18; i++) {
      const x = ((i * 173) % max(1, width)) - width / 2;
      const y = height * 0.18 + ((i * 47) % max(1, height * 0.3));
      fill(255, 221, 120, 95 + 90 * sin(frameCount * 0.035 + i));
      ellipse(x, y, 5, 5);
    }
  }
}

function drawSceneCloud(x, y, scaleValue, alpha) {
  push();
  translate(x, y, 6);
  scale(scaleValue);
  noStroke();
  fill(255, 255, 255, alpha);
  ellipse(-44, 8, 86, 48);
  ellipse(0, -4, 104, 68);
  ellipse(52, 10, 90, 48);
  rect(-72, 8, 146, 34, 18);
  pop();
}

function drawRollingGround(rgb, horizonY) {
  noStroke();
  fill(rgb[0] + 20, rgb[1] + 18, rgb[2] + 12, 235);
  ellipse(-width * 0.25, horizonY + 80, width * 1.3, height * 0.48);
  fill(...rgb, 250);
  ellipse(width * 0.25, horizonY + 130, width * 1.55, height * 0.58);
}

function drawGardenFlowers() {
  for (let i = 0; i < 38; i++) {
    const x = ((i * 97) % max(1, width * 1.25)) - width * 0.625;
    const baseY = height * 0.28 + ((i * 53) % max(1, height * 0.28));
    const sway = sin(frameCount * 0.025 + i) * 7;
    stroke(61, 118, 72, 210);
    strokeWeight(2);
    line(x, baseY + 26, x + sway, baseY);
    noStroke();
    const flowerCols = [[255, 145, 184], [255, 225, 105], [204, 165, 255], [255, 255, 245]];
    const c = flowerCols[i % flowerCols.length];
    fill(...c, 225);
    for (let p = 0; p < 5; p++) {
      const a = p * TWO_PI / 5;
      ellipse(x + sway + cos(a) * 7, baseY + sin(a) * 7, 10, 10);
    }
    fill(255, 198, 71, 240);
    ellipse(x + sway, baseY, 7, 7);
  }
}

function drawFlyingBirds() {
  stroke(70, 54, 82, 150);
  strokeWeight(3);
  noFill();
  for (let i = 0; i < 7; i++) {
    const x = -width * 0.28 + i * 58 + sin(frameCount * 0.01 + i) * 10;
    const y = -height * 0.16 + (i % 3) * 32;
    arc(x - 9, y, 18, 12, PI, TWO_PI);
    arc(x + 9, y, 18, 12, PI, TWO_PI);
  }
  noStroke();
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
  constructor(x, y, w, h, label, type = "tap", variant = "primary") {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.label = label;
    this.type = type;
    this.variant = variant;
    this.phase = random(TWO_PI);
  }
  hit(px, py) { return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h; }
  draw(g, isHot) {
    const r = this.h <= 60 ? 20 : 28;
    const floatY = this.variant === "primary" ? sin(frameCount * 0.045 + this.phase) * 3.5 : 0;
    const pulse = 0.5 + 0.5 * sin(frameCount * 0.07 + this.phase);
    const pressed = pointerDown && pointerDownId && this.hit(pointerToHUD(_lastPointerX, _lastPointerY).x, pointerToHUD(_lastPointerX, _lastPointerY).y);
    const depth = this.h <= 60 ? 8 : 14;
    const pressShift = pressed ? depth * 0.58 : 0;
    const y = this.y + floatY + pressShift;
    const visibleDepth = max(3, depth - pressShift);
    g.push();

    // 落地陰影與多層擠出厚度。
    g.noStroke();
    g.fill(0, 0, 0, 105);
    roundedRect(g, this.x + 8, y + visibleDepth + 11, this.w, this.h, r + 2);

    let top = [255, 140, 184];
    let bottom = [190, 58, 126];
    let side = [91, 27, 81];
    let ink = [47, 25, 58];
    if (this.variant === "secondary") {
      top = isHot ? [118, 104, 171] : [72, 66, 117];
      bottom = [32, 31, 72];
      side = [17, 17, 48];
      ink = [255, 248, 255];
    } else if (this.variant === "choice") {
      top = isHot ? [255, 226, 115] : [90, 82, 133];
      bottom = isHot ? [213, 145, 48] : [38, 39, 82];
      side = isHot ? [116, 70, 26] : [21, 22, 58];
      ink = isHot ? [61, 34, 42] : [249, 245, 255];
    }

    for (let d = visibleDepth; d >= 1; d -= 2) {
      g.fill(...side, 248);
      roundedRect(g, this.x, y + d, this.w, this.h, r);
    }

    const ctx = g.drawingContext;
    ctx.save();
    const faceGrad = ctx.createLinearGradient(this.x, y, this.x, y + this.h);
    faceGrad.addColorStop(0, `rgba(${top[0]},${top[1]},${top[2]},1)`);
    faceGrad.addColorStop(0.52, `rgba(${round((top[0] + bottom[0]) / 2)},${round((top[1] + bottom[1]) / 2)},${round((top[2] + bottom[2]) / 2)},1)`);
    faceGrad.addColorStop(1, `rgba(${bottom[0]},${bottom[1]},${bottom[2]},1)`);
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(this.x, y, this.w, this.h, r);
    else ctx.rect(this.x, y, this.w, this.h);
    ctx.fill();
    ctx.restore();

    // 鏡面高光與底部反射線。
    g.noStroke();
    g.fill(255, 255, 255, this.variant === "secondary" ? 25 : 64 + 28 * pulse);
    roundedRect(g, this.x + 5, y + 5, this.w - 10, this.h * 0.44, max(10, r - 5));
    g.fill(255, 255, 255, 34);
    roundedRect(g, this.x + 16, y + 9, this.w * 0.38, max(5, this.h * 0.08), 8);
    g.fill(20, 8, 35, 48);
    roundedRect(g, this.x + 8, y + this.h - 13, this.w - 16, 7, 5);

    g.noFill();
    g.stroke(255, 244, 204, isHot ? 245 : 132 + 55 * pulse);
    g.strokeWeight(isHot ? 4.5 : 2.4);
    roundedRect(g, this.x, y, this.w, this.h, r);
    if (isHot) {
      g.stroke(255, 214, 126, 70 + 80 * pulse);
      g.strokeWeight(10);
      roundedRect(g, this.x - 5, y - 5, this.w + 10, this.h + 10, r + 5);
      g.stroke(255, 255, 255, 55 + 65 * pulse);
      g.strokeWeight(17);
      roundedRect(g, this.x - 9, y - 9, this.w + 18, this.h + 18, r + 9);
    }

    g.noStroke();
    g.fill(0, 0, 0, 95);
    g.textAlign(CENTER, CENTER);

    const ts = this.h >= 200 ? 64 : (this.h >= 120 ? 50 : (this.h <= 60 ? 24 : 40));
    g.textSize(ts);
    g.textStyle(BOLD);
    g.text(this.label, this.x + this.w / 2 + 2, y + this.h / 2 + 6);
    g.fill(...ink, 250);
    g.textAlign(CENTER, CENTER);
    g.text(this.label, this.x + this.w / 2, y + this.h / 2 + 1);
    g.textStyle(NORMAL);

    if (this.variant === "primary" && this.h < 150) {
      g.fill(255, 246, 205, 155 + 90 * pulse);
      g.textSize(18);
      g.text("✦", this.x + 24, y + this.h / 2);
      g.text("✦", this.x + this.w - 24, y + this.h / 2);
    }
    g.pop();
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
