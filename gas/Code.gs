const SHEET_NAME = "annotations";
const TARGET_FOLDER_NAMES = ["panorama", "oral_photo", "dentalxray"];
const ROOT_FOLDER_ID = "";

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "listFolders") {
      return jsonResponse({ ok: true, folders: listFolders_() });
    }
    if (action === "listImages") {
      const folderId = e.parameter.folderId;
      if (!folderId) throw new Error("folderId が必要です");
      return jsonResponse({ ok: true, images: listImages_(folderId) });
    }
    if (action === "getImageData") {
      const imageId = e.parameter.imageId;
      if (!imageId) throw new Error("imageId が必要です");
      return jsonResponse({ ok: true, image: getImageData_(imageId) });
    }
    if (action === "saveAnnotation") {
      saveAnnotation_({
        annotator: e.parameter.annotator || "",
        folderId: e.parameter.folderId || "",
        folderName: e.parameter.folderName || "",
        imageId: e.parameter.imageId || "",
        imageName: e.parameter.imageName || "",
        caption: e.parameter.caption || "",
        timestamp: e.parameter.timestamp || "",
      });
      return jsonResponse({ ok: true });
    }
    return jsonResponse({
      ok: true,
      message:
        "Use action=listFolders, action=listImages, action=getImageData or action=saveAnnotation",
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action || "";
    if (action !== "saveAnnotation") {
      throw new Error("action=saveAnnotation のみ対応しています");
    }
    saveAnnotation_(payload);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function listFolders_() {
  const result = [];
  const seen = {};
  const root = ROOT_FOLDER_ID ? DriveApp.getFolderById(ROOT_FOLDER_ID) : null;

  TARGET_FOLDER_NAMES.forEach(function (name) {
    let iter;
    if (root) {
      iter = root.getFoldersByName(name);
    } else {
      iter = DriveApp.getFoldersByName(name);
    }
    if (iter.hasNext()) {
      const folder = iter.next();
      if (!seen[folder.getId()]) {
        result.push({ id: folder.getId(), name: folder.getName() });
        seen[folder.getId()] = true;
      }
    }
  });

  return result;
}

function listImages_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const map = getAnnotationMap_();
  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const file = iter.next();
    if (file.getMimeType().indexOf("image/") !== 0) continue;
    const imageId = file.getId();
    const anno = map[imageId] || null;
    files.push({
      id: imageId,
      name: file.getName(),
      url: "",
      thumbnailUrl: "https://drive.google.com/thumbnail?id=" + imageId + "&sz=w1600",
      annotated: Boolean(anno && anno.caption),
      caption: anno ? anno.caption : "",
      updated_at: anno ? anno.updatedAt : "",
    });
  }
  files.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  return files;
}

function getImageData_(imageId) {
  const file = DriveApp.getFileById(imageId);
  const blob = file.getBlob();
  const mimeType = blob.getContentType() || "image/jpeg";
  const base64 = Utilities.base64Encode(blob.getBytes());
  return {
    id: imageId,
    mimeType: mimeType,
    dataUrl: "data:" + mimeType + ";base64," + base64,
  };
}

function saveAnnotation_(payload) {
  if (!payload.imageId) throw new Error("imageId が必要です");
  if (!payload.caption) throw new Error("caption が必要です");

  const sheet = getOrCreateSheet_();
  sheet.appendRow([
    payload.annotator || "",
    payload.timestamp || new Date().toISOString(),
    payload.folderName || "",
    payload.folderId || "",
    payload.imageId || "",
    payload.imageName || "",
    payload.caption || "",
    new Date().toISOString(),
  ]);
}

function getAnnotationMap_() {
  const sheet = getOrCreateSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return {};
  const headers = values[0];
  const idxImageId = headers.indexOf("image_id");
  const idxCaption = headers.indexOf("caption");
  const idxUpdated = headers.indexOf("updated_at");
  const map = {};
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const imageId = idxImageId >= 0 ? row[idxImageId] : row[3];
    if (!imageId) continue;
    map[imageId] = {
      caption: (idxCaption >= 0 ? row[idxCaption] : row[5]) || "",
      updatedAt: (idxUpdated >= 0 ? row[idxUpdated] : row[6]) || "",
    };
  }
  return map;
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "annotator",
      "timestamp",
      "folder_name",
      "folder_id",
      "image_id",
      "image_name",
      "caption",
      "updated_at",
    ]);
  }
  return sheet;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
