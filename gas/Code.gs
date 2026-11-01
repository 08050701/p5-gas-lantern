// 願望拍貼機 Google Apps Script 後端
// OPENAI / 其他服務的金鑰不要寫在這個檔案，請放在「指令碼屬性」。

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-6-luna";
const PHOTO_FOLDER_NAME = "願望拍貼機-QR照片";
const PHOTO_KEY_PREFIX = "WISH_PHOTO_";
const PHOTO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_PHOTOS = 300;
// 相冊只收本人按「放進去」的拍貼；照片留 ALBUM_KEEP_DAYS 天，最多 MAX_ALBUM_PAGES 頁。
const ALBUM_FOLDER_NAME = "願望拍貼機-大家的相冊";
const ALBUM_KEEP_DAYS = 30;
const MAX_ALBUM_PAGES = 200;

function doGet(e) {
  const token = String((e && e.parameter && e.parameter.photo) || "").trim();
  if (token) return renderPhotoPickupPage_(token);
  return jsonOut_({ ok: true, message: "願望拍貼機 API 運作中" });
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return jsonOut_({ ok: false, error: "請求格式錯誤" });
  }

  try {
    if (body.action === "savePhoto") return jsonOut_(savePhoto_(body));
    if (body.action === "albumAdd") return jsonOut_(albumAdd_(body));
    if (body.action === "albumList") return jsonOut_(albumList_());
    if (body.action === "albumPage") return jsonOut_(albumPage_(body));
    const wish = String(body.wish || "").trim();
    return jsonOut_({ ok: true, reply: getReply_(wish) });
  } catch (err) {
    return jsonOut_({ ok: false, reply: "", error: String(err && err.message || err) });
  }
}

function savePhoto_(body) {
  const props = PropertiesService.getScriptProperties();
  const activePhotoCount = Object.keys(props.getProperties()).filter(function(key) {
    return key.indexOf(PHOTO_KEY_PREFIX) === 0;
  }).length;
  if (activePhotoCount >= MAX_ACTIVE_PHOTOS) throw new Error("目前拍貼領取量已滿，請稍後再試");

  const imageData = String(body.imageData || "");
  const match = imageData.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("照片格式不支援");
  if (imageData.length > 5 * 1024 * 1024) throw new Error("照片檔案太大");

  const extension = match[1] === "png" ? "png" : "jpg";
  const mimeType = extension === "png" ? "image/png" : "image/jpeg";
  const token = Utilities.getUuid().replace(/-/g, "");
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, mimeType, `wish-photo-${token}.${extension}`);
  const folder = getPhotoFolder_();
  const file = folder.createFile(blob);
  const expiresAt = Date.now() + PHOTO_TTL_MS;

  // 檔案維持私人；公開網頁只會透過不可猜測的 token 讀取。
  props.setProperty(PHOTO_KEY_PREFIX + token, JSON.stringify({
    fileId: file.getId(),
    expiresAt: expiresAt
  }));
  ensurePhotoCleanupTrigger_();
  const claimUrl = `${ScriptApp.getService().getUrl()}?photo=${encodeURIComponent(token)}`;
  return { ok: true, claimUrl: claimUrl, token: token, expiresAt: new Date(expiresAt).toISOString() };
}

function getAlbumFolder_() {
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty("ALBUM_FOLDER_ID");
  if (storedId) {
    try { return DriveApp.getFolderById(storedId); } catch (err) {}
  }
  const folder = DriveApp.createFolder(ALBUM_FOLDER_NAME);
  props.setProperty("ALBUM_FOLDER_ID", folder.getId());
  return folder;
}

function albumFiles_() {
  const list = [];
  const files = getAlbumFolder_().getFiles();
  while (files.hasNext()) {
    const file = files.next();
    list.push({ file: file, time: file.getDateCreated().getTime() });
  }
  return list.sort(function(a, b) { return b.time - a.time; });
}

function albumAdd_(body) {
  const imageData = String(body.imageData || "");
  const match = imageData.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("照片格式不支援");
  if (imageData.length > 1500 * 1024) throw new Error("照片檔案太大");
  if (albumFiles_().length >= MAX_ALBUM_PAGES) throw new Error("相冊已經滿了");

  const blob = Utilities.newBlob(Utilities.base64Decode(match[1]), "image/jpeg", `album-${Utilities.getUuid()}.jpg`);
  const file = getAlbumFolder_().createFile(blob);
  file.setDescription(JSON.stringify({
    wish: String(body.wish || "").trim().slice(0, 300),
    scene: String(body.scene || "").trim().slice(0, 30)
  }));
  CacheService.getScriptCache().remove("albumList");
  ensurePhotoCleanupTrigger_();
  return { ok: true, id: file.getId() };
}

function albumList_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("albumList");
  if (cached) return JSON.parse(cached);
  const pages = albumFiles_().map(function(item) {
    let meta = {};
    try { meta = JSON.parse(item.file.getDescription() || "{}"); } catch (err) {}
    return { id: item.file.getId(), wish: meta.wish || "", scene: meta.scene || "", time: item.time };
  });
  const result = { ok: true, pages: pages };
  const text = JSON.stringify(result);
  if (text.length < 90000) cache.put("albumList", text, 60);
  return result;
}

function albumPage_(body) {
  const id = String(body.id || "");
  if (!/^[\w-]{20,80}$/.test(id)) throw new Error("頁碼格式錯誤");
  const file = DriveApp.getFileById(id);
  // 只讀相冊資料夾裡的檔案，別的 Drive 檔案一律不給
  const albumId = getAlbumFolder_().getId();
  const parents = file.getParents();
  let inAlbum = false;
  while (parents.hasNext()) { if (parents.next().getId() === albumId) inAlbum = true; }
  if (!inAlbum) throw new Error("找不到這一頁");
  return { ok: true, imageData: `data:image/jpeg;base64,${Utilities.base64Encode(file.getBlob().getBytes())}` };
}

function cleanupAlbum_() {
  if (!PropertiesService.getScriptProperties().getProperty("ALBUM_FOLDER_ID")) return;
  const limit = Date.now() - ALBUM_KEEP_DAYS * 24 * 60 * 60 * 1000;
  albumFiles_().forEach(function(item) {
    if (item.time < limit) item.file.setTrashed(true);
  });
}

function renderPhotoPickupPage_(token) {
  if (!/^[a-f0-9]{32}$/i.test(token)) return pickupErrorPage_("領取碼格式錯誤");
  const rawRecord = PropertiesService.getScriptProperties().getProperty(PHOTO_KEY_PREFIX + token);
  if (!rawRecord) return pickupErrorPage_("找不到這張拍貼，請重新產生 QR Code");

  let record;
  try {
    record = JSON.parse(rawRecord);
  } catch (err) {
    record = { fileId: rawRecord, expiresAt: 0 };
  }
  if (!record.fileId) return pickupErrorPage_("找不到這張拍貼");
  if (record.expiresAt && Date.now() >= Number(record.expiresAt)) {
    deletePhotoRecord_(token, record.fileId);
    return pickupErrorPage_("這張拍貼已超過 24 小時並自動刪除");
  }

  try {
    const blob = DriveApp.getFileById(record.fileId).getBlob();
    const mimeType = String(blob.getContentType() || "image/jpeg");
    const dataUrl = `data:${mimeType};base64,${Utilities.base64Encode(blob.getBytes())}`;
    const html = `<!doctype html>
      <html lang="zh-Hant"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
      <meta name="robots" content="noindex,nofollow">
      <title>領取願望拍貼</title>
      <style>
        *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
        background:radial-gradient(circle at top,#40325f,#11152f 68%);color:#fff;font-family:system-ui,"Microsoft JhengHei",sans-serif}
        main{width:min(560px,100%);text-align:center;background:#ffffff12;border:1px solid #ffffff38;border-radius:28px;padding:24px;box-shadow:0 22px 70px #0007}
        h1{font-size:28px;margin:0 0 8px}.sub{color:#dfe3ff;margin:0 0 20px}.photo{width:100%;border-radius:22px;display:block;background:#fff}
        a{display:block;margin-top:20px;padding:15px 20px;border-radius:18px;background:linear-gradient(135deg,#ffd96c,#ff77ad);color:#351b3d;text-decoration:none;font-size:22px;font-weight:800}
        small{display:block;margin-top:14px;color:#bac0df}
      </style></head><body><main>
        <h1>你的願望拍貼 ✦</h1><p class="sub">長按照片或按下按鈕即可儲存</p>
        <img class="photo" src="${dataUrl}" alt="願望拍貼">
        <a href="${dataUrl}" download="wish-photo.${mimeType.indexOf("png") >= 0 ? "png" : "jpg"}">下載拍貼</a>
        <small>照片儲存在活動主辦人的私人雲端空間，24 小時後自動刪除</small>
      </main></body></html>`;
    return HtmlService.createHtmlOutput(html).setTitle("領取願望拍貼");
  } catch (err) {
    return pickupErrorPage_("照片目前無法讀取");
  }
}

function pickupErrorPage_(message) {
  const safe = String(message || "無法領取").replace(/[<>&\"']/g, "");
  return HtmlService.createHtmlOutput(`<!doctype html><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#11152f;color:#fff;font-family:system-ui">
    <main style="text-align:center;padding:28px"><h1>找不到拍貼</h1><p>${safe}</p></main></body>`);
}

function getPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty("PHOTO_FOLDER_ID");
  if (storedId) {
    try { return DriveApp.getFolderById(storedId); } catch (err) {}
  }
  const folder = DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty("PHOTO_FOLDER_ID", folder.getId());
  return folder;
}

function ensurePhotoCleanupTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === "cleanupExpiredPhotos";
  });
  if (!exists) {
    ScriptApp.newTrigger("cleanupExpiredPhotos").timeBased().everyHours(1).create();
  }
}

function cleanupExpiredPhotos() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(PHOTO_KEY_PREFIX) !== 0) return;
    let record;
    try { record = JSON.parse(all[key]); } catch (err) { return; }
    if (!record.expiresAt || now < Number(record.expiresAt)) return;
    const token = key.substring(PHOTO_KEY_PREFIX.length);
    deletePhotoRecord_(token, record.fileId);
  });
  cleanupAlbum_();
}

// 部署管理員只需在 Apps Script 編輯器執行一次，完成 Drive 與觸發器授權。
function setupPhotoStorage() {
  getPhotoFolder_();
  ensurePhotoCleanupTrigger_();
  return true;
}

function deletePhotoRecord_(token, fileId) {
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (err) {}
  PropertiesService.getScriptProperties().deleteProperty(PHOTO_KEY_PREFIX + token);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getReply_(wish) {
  const cleanWish = String(wish || "").trim().slice(0, 500);
  if (!cleanWish) return "願望已經收到，願你在接下來的日子裡，也能好好照顧自己並一步一步靠近它。";

  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY") || "").trim();
  const model = String(props.getProperty("OPENAI_MODEL") || DEFAULT_OPENAI_MODEL).trim();
  if (!apiKey) throw new Error("尚未設定 OPENAI_API_KEY 指令碼屬性");

  const payload = {
    model: model,
    store: false,
    max_output_tokens: 180,
    instructions: "你是溫暖、真誠的家人。請用繁體中文回覆使用者的願望，給一段貼心且具體的祝福；不要制式、不要說教、不要使用表情符號，也不要超過 100 個中文字。",
    input: cleanWish
  };
  const res = UrlFetchApp.fetch(OPENAI_RESPONSES_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const status = res.getResponseCode();
  const raw = res.getContentText();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error("OpenAI API 回傳了無法解析的內容（HTTP " + status + "）");
  }

  if (status < 200 || status >= 300) {
    const detail = data && data.error && data.error.message ? String(data.error.message) : "請稍後再試";
    throw new Error("OpenAI API 錯誤（HTTP " + status + "）：" + detail.slice(0, 180));
  }

  const outputText = String(data.output_text || extractResponseText_(data.output) || "").trim();
  if (!outputText) throw new Error("OpenAI API 沒有回傳祝福文字");
  return outputText;
}

function extractResponseText_(output) {
  if (!Array.isArray(output)) return "";
  const parts = [];
  output.forEach(function(item) {
    if (!item || !Array.isArray(item.content)) return;
    item.content.forEach(function(content) {
      if (content && content.type === "output_text" && content.text) parts.push(String(content.text));
    });
  });
  return parts.join("\n");
}

