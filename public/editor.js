// ===============================
//  editor.js
//  高機能ルームエディタ
// ===============================

const editorOverlay = document.getElementById("editor-overlay");
const editorClose = document.getElementById("editor-close");

const envSkyColorInput = document.getElementById("env-skyColor");
const envFogColorInput = document.getElementById("env-fogColor");
const envFogDensityInput = document.getElementById("env-fogDensity");
const envAmbientColorInput = document.getElementById("env-ambientColor");

const boundsWidthInput = document.getElementById("bounds-width");
const boundsDepthInput = document.getElementById("bounds-depth");

const objectsList = document.getElementById("objects-list");
const addBoxBtn = document.getElementById("addBoxBtn");
const addSphereBtn = document.getElementById("addSphereBtn");

const selectedObjectIdLabel = document.getElementById("selected-object-id");
const objTypeSelect = document.getElementById("obj-type");
const objPosXInput = document.getElementById("obj-pos-x");
const objPosYInput = document.getElementById("obj-pos-y");
const objPosZInput = document.getElementById("obj-pos-z");
const objRotXInput = document.getElementById("obj-rot-x");
const objRotYInput = document.getElementById("obj-rot-y");
const objRotZInput = document.getElementById("obj-rot-z");
const objScaleXInput = document.getElementById("obj-scale-x");
const objScaleYInput = document.getElementById("obj-scale-y");
const objScaleZInput = document.getElementById("obj-scale-z");
const objColorInput = document.getElementById("obj-color");
const objApplyBtn = document.getElementById("obj-apply");
const objDeleteBtn = document.getElementById("obj-delete");

const editorSaveBtn = document.getElementById("editor-save");

let editorRoomId = null;
let editorSessionToken = null;
let editorRoomData = null;
let editorSelectedObject = null;

// ===============================
// エディタを開く
// ===============================
window.editorOpen = function (roomId, sessionToken) {
  editorRoomId = roomId;
  editorSessionToken = sessionToken;
  editorOverlay.classList.remove("hidden");
};

// ===============================
// エディタを閉じる
// ===============================
editorClose.onclick = () => {
  editorOverlay.classList.add("hidden");
};

// ===============================
// ルームデータを読み込む
// ===============================
window.editorLoadRoom = function (roomId, room) {
  if (editorRoomId === roomId) {
    editorRoomData = JSON.parse(JSON.stringify(room));
    applyEditorRoom();
  }
};

// ===============================
// エディタUIへ反映
// ===============================
function applyEditorRoom() {
  if (!editorRoomData) return;

  envSkyColorInput.value = editorRoomData.environment.skyColor;
  envFogColorInput.value = editorRoomData.environment.fogColor;
  envFogDensityInput.value = editorRoomData.environment.fogDensity;
  envAmbientColorInput.value = editorRoomData.environment.ambientColor;

  boundsWidthInput.value = editorRoomData.bounds.width;
  boundsDepthInput.value = editorRoomData.bounds.depth;

  objectsList.innerHTML = "";
  editorRoomData.objects.forEach((obj) => {
    const div = document.createElement("div");
    div.textContent = `${obj.id} (${obj.type})`;
    div.style.cursor = "pointer";
    div.onclick = () => selectObject(obj.id);
    objectsList.appendChild(div);
  });

  clearSelectedObject();
}

// ===============================
// 選択解除
// ===============================
function clearSelectedObject() {
  editorSelectedObject = null;
  selectedObjectIdLabel.textContent = "-";
  objTypeSelect.value = "box";
  objPosXInput.value = "";
  objPosYInput.value = "";
  objPosZInput.value = "";
  objRotXInput.value = "";
  objRotYInput.value = "";
  objRotZInput.value = "";
  objScaleXInput.value = "";
  objScaleYInput.value = "";
  objScaleZInput.value = "";
  objColorInput.value = "#ffffff";
}

// ===============================
// オブジェクト選択
// ===============================
function selectObject(id) {
  const obj = editorRoomData.objects.find((o) => o.id === id);
  if (!obj) return;
  editorSelectedObject = obj;

  selectedObjectIdLabel.textContent = obj.id;
  objTypeSelect.value = obj.type;
  objPosXInput.value = obj.position.x;
  objPosYInput.value = obj.position.y;
  objPosZInput.value = obj.position.z;
  objRotXInput.value = obj.rotation.x;
  objRotYInput.value = obj.rotation.y;
  objRotZInput.value = obj.rotation.z;
  objScaleXInput.value = obj.scale.x;
  objScaleYInput.value = obj.scale.y;
  objScaleZInput.value = obj.scale.z;
  objColorInput.value = obj.color || "#ffffff";
}

// ===============================
// オブジェクト追加
// ===============================
function addObject(type) {
  const id = "obj_" + Math.random().toString(36).slice(2);
  const obj = {
    id,
    type,
    position: { x: 0, y: 1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: "#ffffff"
  };
  editorRoomData.objects.push(obj);
  applyEditorRoom();
}

addBoxBtn.onclick = () => addObject("box");
addSphereBtn.onclick = () => addObject("sphere");

// ===============================
// オブジェクト編集適用
// ===============================
objApplyBtn.onclick = () => {
  if (!editorSelectedObject) return;

  editorSelectedObject.type = objTypeSelect.value;
  editorSelectedObject.position = {
    x: parseFloat(objPosXInput.value || "0"),
    y: parseFloat(objPosYInput.value || "1"),
    z: parseFloat(objPosZInput.value || "0")
  };
  editorSelectedObject.rotation = {
    x: parseFloat(objRotXInput.value || "0"),
    y: parseFloat(objRotYInput.value || "0"),
    z: parseFloat(objRotZInput.value || "0")
  };
  editorSelectedObject.scale = {
    x: parseFloat(objScaleXInput.value || "1"),
    y: parseFloat(objScaleYInput.value || "1"),
    z: parseFloat(objScaleZInput.value || "1")
  };
  editorSelectedObject.color = objColorInput.value || "#ffffff";

  applyEditorRoom();
};

// ===============================
// オブジェクト削除
// ===============================
objDeleteBtn.onclick = () => {
  if (!editorSelectedObject) return;
  editorRoomData.objects = editorRoomData.objects.filter(
    (o) => o.id !== editorSelectedObject.id
  );
  applyEditorRoom();
};

// ===============================
// ルーム保存
// ===============================
editorSaveBtn.onclick = async () => {
  if (!editorRoomId || !editorSessionToken || !editorRoomData) return;

  editorRoomData.environment = {
    skyColor: envSkyColorInput.value || "#000022",
    fogColor: envFogColorInput.value || "#000000",
    fogDensity: parseFloat(envFogDensityInput.value || "0.02"),
    ambientColor: envAmbientColorInput.value || "#ffffff"
  };

  editorRoomData.bounds = {
    width: parseFloat(boundsWidthInput.value || "50"),
    depth: parseFloat(boundsDepthInput.value || "50")
  };

  try {
    const res = await fetch(`/api/updateRoom/${encodeURIComponent(editorRoomId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": editorSessionToken
      },
      body: JSON.stringify({
        environment: editorRoomData.environment,
        bounds: editorRoomData.bounds,
        objects: editorRoomData.objects
      })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "updateRoom failed");
    alert("ルームを保存しました");
  } catch (e) {
    console.error(e);
    alert("保存に失敗しました");
  }
};
