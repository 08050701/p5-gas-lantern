// 願望拍貼機 Google Apps Script 後端
// OPENAI / 其他服務的金鑰不要寫在這個檔案，請放在「指令碼屬性」。

const API_URL = "https://eow1fla8fgzbk23.m.pipedream.net";
const PHOTO_FOLDER_NAME = "願望拍貼機-QR照片";
const PHOTO_KEY_PREFIX = "WISH_PHOTO_";

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
    const wish = String(body.wish || "").trim();
    return jsonOut_({ ok: true, reply: getReply_(wish) });
  } catch (err) {
    return jsonOut_({ ok: false, reply: "", error: String(err && err.message || err) });
  }
}

function savePhoto_(body) {
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

  // 檔案維持私人；公開網頁只會透過不可猜測的 token 讀取。
  PropertiesService.getScriptProperties().setProperty(PHOTO_KEY_PREFIX + token, file.getId());
  const claimUrl = `${ScriptApp.getService().getUrl()}?photo=${encodeURIComponent(token)}`;
  return { ok: true, claimUrl: claimUrl, token: token };
}

function renderPhotoPickupPage_(token) {
  if (!/^[a-f0-9]{32}$/i.test(token)) return pickupErrorPage_("領取碼格式錯誤");
  const fileId = PropertiesService.getScriptProperties().getProperty(PHOTO_KEY_PREFIX + token);
  if (!fileId) return pickupErrorPage_("找不到這張拍貼，請重新產生 QR Code");

  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
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
        <small>照片儲存在活動主辦人的私人雲端空間</small>
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

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getReply_(wish) {
  const payload = {
    model: "gpt-4o-mini",
    wish: String(wish || "").trim(),
    persona: "溫暖的家人",
    style: "QandA",
    seed: Math.floor(Math.random() * 1e9),
    instruction: "你是溫暖的家人，用中文回覆。要貼心、具體，不要制式。請用一段話，不要加表情符號。"
  };
  const res = UrlFetchApp.fetch(API_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const raw = res.getContentText();
  try {
    const data = JSON.parse(raw);
    return String(data.reply || data.text || data.content || data.message || data.output || "").trim();
  } catch (err) {
    return String(raw || "").trim();
  }
}

