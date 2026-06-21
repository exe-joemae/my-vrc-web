// ===============================
//  client.js
// ===============================

// グローバル状態
let sessionToken = null;
let currentUser = null;
window.currentUser = null; // スマホ用からも参照できるように

let currentRoomId = "lobby";

let avatarColor = "#FFAA00";
let phoneKey = "p";

let velocity = { x: 0, y: 0, z: 0 };
const GRAVITY = -20;
const MOVE_SPEED = 4;
const JUMP_POWER = 8;
let keys = {};
let yaw = 0;
let pitch = 0;
let isGrounded = true;

// DOM
const loginOverlay = document.getElementById("login-overlay");
const loginTabBtns = document.querySelectorAll(".login-tab-btn");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const loginDisplayNameLabel = document.getElementById("login-displayName-label");
const loginDisplayName = document.getElementById("login-displayName");
const loginSubmit = document.getElementById("login-submit");
const loginMessage = document.getElementById("login-message");

const hud = document.getElementById("ui");
const labelUsername = document.getElementById("label-username");
const labelDisplayName = document.getElementById("label-displayName");
const displayNameInput = document.getElementById("displayName");
const avatarColorInput = document.getElementById("avatarColorInput");
const phoneKeyInput = document.getElementById("phoneKeyInput");
const accountUpdateBtn = document.getElementById("accountUpdateBtn");

const roomInput = document.getElementById("roomId");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const myRoomsList = document.getElementById("myRoomsList");

const startVoiceBtn = document.getElementById("startVoiceBtn");
const socketIdLabel = document.getElementById("socketIdLabel");

const snsTextInput = document.getElementById("sns-text");
const snsSendBtn = document.getElementById("sns-send");
const snsFeed = document.getElementById("sns-feed");

const phone = document.getElementById("phone");
const phoneClose = document.getElementById("phone-close");
const phoneTabs = document.querySelectorAll("#phone-tabs button");
const phoneKeyLabel = document.getElementById("phoneKeyLabel");

const dmToUsernameInput = document.getElementById("dm-to-username");
const dmToSocketInput = document.getElementById("dm-to-socket");
const dmTextInput = document.getElementById("dm-text");
const dmSendBtn = document.getElementById("dm-send");
const dmLog = document.getElementById("dm-log");

const openEditorBtn = document.getElementById("openEditorBtn");

const playerRoot = document.getElementById("playerRoot");
const playerCamera = document.getElementById("playerCamera");
const playerAvatar = document.getElementById("playerAvatar");
const playerNameTag = document.getElementById("playerNameTag");
const ground = document.getElementById("ground");
const envSky = document.getElementById("env-sky");
const envLight = document.getElementById("env-light");

// マップ
const mapCanvas = document.getElementById("map-canvas");
const mapCtx = mapCanvas.getContext("2d");
const mapModeSelect = document.getElementById("map-mode");

let mapSelf = {
  pos: { x: 0, y: 0, z: 0 },
  yaw: 0
};
let mapPlayers = {};

// ===============================
// キー入力
// ===============================
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === " " && isGrounded) {
    velocity.y = JUMP_POWER;
    isGrounded = false;
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// マウス視点
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

window.addEventListener("mousedown", (e) => {
  isMouseDown = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener("mouseup", () => {
  isMouseDown = false;
});

window.addEventListener("mousemove", (e) => {
  if (!isMouseDown) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  const sensitivity = 0.2;
  yaw -= dx * sensitivity;
  pitch -= dy * sensitivity;
  pitch = Math.max(-80, Math.min(80, pitch));
});

// 矢印キー視点
window.addEventListener("keydown", (e) => {
  const sensitivity = 2;
  if (e.key === "ArrowLeft") yaw += sensitivity;
  if (e.key === "ArrowRight") yaw -= sensitivity;
  if (e.key === "ArrowUp") pitch -= sensitivity;
  if (e.key === "ArrowDown") pitch += sensitivity;
  pitch = Math.max(-80, Math.min(80, pitch));
});

// ===============================
// ログインタブ
// ===============================
let loginMode = "login";

loginTabBtns.forEach((btn) => {
  btn.onclick = () => {
    loginMode = btn.dataset.mode;
    loginTabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (loginMode === "register") {
      loginDisplayNameLabel.classList.remove("hidden");
      loginDisplayName.classList.remove("hidden");
    } else {
      loginDisplayNameLabel.classList.add("hidden");
      loginDisplayName.classList.add("hidden");
    }
  };
});

// ===============================
// ログイン / 新規登録
// ===============================
loginSubmit.onclick = async () => {
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  const displayName = loginDisplayName.value.trim();

  if (!username || !password) {
    loginMessage.textContent = "ユーザー名とパスワードを入力してね";
    return;
  }

  try {
    if (loginMode === "register") {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "register failed");
      loginMessage.textContent = "登録完了。次にログインしてね。";
      return;
    } else {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "login failed");

      sessionToken = json.token;
      currentUser = json.user;
      window.currentUser = currentUser;
      avatarColor = currentUser.avatarColor || "#FFAA00";
      phoneKey = currentUser.phoneKey || "p";

      // ローカル保存
      localStorage.setItem("sessionToken", sessionToken);

      afterLogin();
    }
  } catch (e) {
    console.error(e);
    loginMessage.textContent = "エラー: " + e.message;
  }
};

// 起動時：セッション復元
(async function autoLogin() {
  const token = localStorage.getItem("sessionToken");
  if (!token) return;
  try {
    const res = await fetch("/api/me", {
      headers: { "x-session-token": token }
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "invalid session");

    sessionToken = token;
    currentUser = json.user;
    window.currentUser = currentUser;
    avatarColor = currentUser.avatarColor || "#FFAA00";
    phoneKey = currentUser.phoneKey || "p";

    afterLogin();
  } catch (e) {
    console.warn("autoLogin failed:", e.message);
    localStorage.removeItem("sessionToken");
  }
})();

function afterLogin() {
  loginOverlay.classList.add("hidden");
  hud.classList.remove("hidden");

  labelUsername.textContent = currentUser.username;
  labelDisplayName.textContent = currentUser.displayName;
  displayNameInput.value = currentUser.displayName;
  avatarColorInput.value = avatarColor;
  phoneKeyInput.value = phoneKey;
  phoneKeyLabel.textContent = phoneKey.toUpperCase();

  playerAvatar.setAttribute("material", `color: ${avatarColor}`);
  playerNameTag.setAttribute(
    "text",
    `value: ${currentUser.displayName}; align: center; color: #00FFFF; width: 4`
  );

  initSocket();
  connectWS("lobby");
  currentRoomId = "lobby";
  history.replaceState(null, "", "?room=lobby");

  loadMyRooms();
  loadSnsHistory();
  loadDmHistory();
}

// ===============================
// アカウント更新
// ===============================
accountUpdateBtn.onclick = async () => {
  if (!sessionToken) return;
  const displayName = displayNameInput.value.trim();
  const color = avatarColorInput.value;
  const key = phoneKeyInput.value.trim().toLowerCase() || "p";

  try {
    const res = await fetch("/api/updateUser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken
      },
      body: JSON.stringify({
        displayName,
        avatarColor: color,
        phoneKey: key
      })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "updateUser failed");

    currentUser.displayName = displayName;
    currentUser.avatarColor = color;
    currentUser.phoneKey = key;
    window.currentUser = currentUser;

    avatarColor = color;
    phoneKey = key;
    phoneKeyLabel.textContent = key.toUpperCase();

    labelDisplayName.textContent = displayName;
    playerAvatar.setAttribute("material", `color: ${avatarColor}`);
    playerNameTag.setAttribute(
      "text",
      `value: ${displayName}; align: center; color: #00FFFF; width: 4`
    );
  } catch (e) {
    console.error(e);
    alert("更新に失敗しました");
  }
};

// ===============================
// WebSocket（位置同期）
// ===============================
let ws;

function connectWS(roomId) {
  if (ws) ws.close();

  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(
    `${proto}://${location.host}/?room=${roomId}&username=${encodeURIComponent(
      currentUser.username
    )}`
  );

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === "spawn") {
      handleSpawn(data);
    } else if (data.type === "despawn") {
      handleDespawn(data);
    }
  };
}

function handleSpawn(data) {
  let e = document.getElementById(data.id);
  let nameTag;

  if (!e) {
    e = document.createElement("a-entity");
    e.setAttribute("id", data.id);
    e.setAttribute(
      "geometry",
      "primitive: box; height: 1.6; width: 0.5; depth: 0.5"
    );
    e.setAttribute("material", `color: ${data.avatarColor}`);
    e.setAttribute("position", "0 0 0");

    nameTag = document.createElement("a-entity");
    nameTag.setAttribute(
      "text",
      `value: ${data.displayName}; align: center; color: #00FFFF; width: 4`
    );
    nameTag.setAttribute("position", "0 2.2 0");
    nameTag.setAttribute("id", `name-${data.id}`);

    e.appendChild(nameTag);
    document.querySelector("a-scene").appendChild(e);
  } else {
    nameTag = document.getElementById(`name-${data.id}`);
  }

  e.setAttribute("position", data.pos);
  if (nameTag) {
    nameTag.setAttribute(
      "text",
      `value: ${data.displayName}; align: center; color: #00FFFF; width: 4`
    );
  }

  updateMapPlayer(data.id, data.mapPos);
}

function handleDespawn(data) {
  const e = document.getElementById(data.id);
  if (e && e.parentNode) e.parentNode.removeChild(e);
  const nameTag = document.getElementById(`name-${data.id}`);
  if (nameTag && nameTag.parentNode) nameTag.parentNode.removeChild(nameTag);
  removeMapPlayer(data.id);
}

// ===============================
// ルーム一覧 / 作成 / 読み込み
// ===============================
async function loadMyRooms() {
  try {
    const res = await fetch("/api/myRooms", {
      headers: { "x-session-token": sessionToken }
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "myRooms failed");

    myRoomsList.innerHTML = "";
    json.rooms.forEach((room) => {
      const div = document.createElement("div");
      div.textContent = `${room.id} (${room.name})`;
      div.style.cursor = "pointer";
      div.onclick = () => {
        roomInput.value = room.id;
        currentRoomId = room.id;
        loadRoom(room.id);
      };
      myRoomsList.appendChild(div);
    });
  } catch (e) {
    console.error(e);
  }
}

createRoomBtn.onclick = async () => {
  const roomId = roomInput.value.trim();
  if (!roomId) return alert("Room ID を入力してね");

  try {
    const res = await fetch("/api/createRoom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken
      },
      body: JSON.stringify({ roomId, name: roomId })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "createRoom failed");

    alert("ルーム作成しました");
    currentRoomId = roomId;
    history.replaceState(null, "", `?room=${encodeURIComponent(roomId)}`);
    loadMyRooms();
    loadRoom(roomId);
  } catch (e) {
    console.error(e);
    alert("ルーム作成に失敗しました");
  }
};

joinRoomBtn.onclick = () => {
  const roomId = roomInput.value.trim() || "lobby";
  currentRoomId = roomId;
  history.replaceState(null, "", `?room=${encodeURIComponent(roomId)}`);
  loadRoom(roomId);
};

async function loadRoom(roomId) {
  try {
    const res = await fetch(`/api/getRoom/${encodeURIComponent(roomId)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "getRoom failed");

    const room = json.room;

    envSky.setAttribute("color", room.environment.skyColor);
    envLight.setAttribute(
      "light",
      `type: ambient; color: ${room.environment.ambientColor}`
    );
    const scene = document.getElementById("scene");
    scene.setAttribute(
      "fog",
      `type: exponential; color: ${room.environment.fogColor}; density: ${room.environment.fogDensity}`
    );

    ground.setAttribute("width", room.bounds.width);
    ground.setAttribute("height", room.bounds.depth);

    document
      .querySelectorAll(".room-object")
      .forEach((e) => e.parentNode.removeChild(e));

    room.objects.forEach((obj) => {
      const e = document.createElement("a-entity");
      e.setAttribute("id", `obj-${obj.id}`);
      e.classList.add("room-object");

      if (obj.type === "box") {
        e.setAttribute("geometry", "primitive: box");
      } else if (obj.type === "sphere") {
        e.setAttribute("geometry", "primitive: sphere");
      }

      e.setAttribute("material", `color: ${obj.color || "#FFFFFF"}`);
      e.setAttribute("position", obj.position);
      e.setAttribute("rotation", obj.rotation);
      e.setAttribute("scale", obj.scale);

      scene.appendChild(e);
    });

    window.editorLoadRoom(roomId, room);

    connectWS(roomId);

    socket.emit("join-room", {
      roomId,
      username: currentUser.username
    });
  } catch (e) {
    console.error(e);
    alert("ルーム読み込みに失敗しました");
  }
}

// ===============================
// Socket.IO（音声 / SNS / DM）
// ===============================
const socket = io();
window.socket = socket;

let localStream = null;
let peers = {};

function initSocket() {
  socket.on("connect", () => {
    socketIdLabel.textContent = socket.id;
    socket.emit("join-room", {
      roomId: currentRoomId,
      username: currentUser.username
    });
  });

  socket.on("sns-history", (messages) => {
    snsFeed.innerHTML = "";
    phoneSnsFeed.innerHTML = "";
    messages.forEach((m) => {
      addSnsItem(snsFeed, m);
      addSnsItem(phoneSnsFeed, m);
    });
  });

  socket.on("dm-history", (messages) => {
    messages.forEach((m) => {
      addDmLog(
        `履歴 ← ${m.fromDisplayName} (${m.fromUsername})`,
        `${m.message} (${m.time})`
      );
    });
  });

  socket.on("sns-feed", (msg) => {
    addSnsItem(snsFeed, msg);
    addSnsItem(phoneSnsFeed, msg);
  });

  socket.on("dm-receive", ({ from, fromUsername, fromDisplayName, message, time }) => {
    const label = `${fromDisplayName || fromUsername} (${fromUsername})`;
    addDmLog(`受信 ← ${label}`, `${message} (${time})`);
  });

  socket.on("signal", async ({ from, data }) => {
    let pc = peers[from];
    if (!pc) pc = await createPeerConnection(from, false);

    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", { to: from, data: answer });
    } else if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.error(e);
      }
    }
  });
}

// 音声チャット
startVoiceBtn.onclick = async () => {
  if (localStream) {
    alert("すでに音声チャット中だよ");
    return;
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    console.error(e);
    alert("マイクへのアクセスが拒否されたかも");
    return;
  }

  socket.emit("get-peers", currentRoomId, async (peerIds) => {
    for (const peerId of peerIds) {
      await createPeerConnection(peerId, true);
    }
  });
};

async function createPeerConnection(peerId, isCaller) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peers[peerId] = pc;

  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", {
        to: peerId,
        data: { candidate: event.candidate }
      });
    }
  };

  pc.ontrack = (event) => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  if (isCaller) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { to: peerId, data: offer });
  }

  return pc;
}

// ===============================
// SNS（PC側）
// ===============================
snsSendBtn.onclick = () => {
  const text = snsTextInput.value.trim();
  if (!text) return;

  const post = {
    userDisplayName: currentUser.displayName,
    text,
    time: new Date().toLocaleTimeString()
  };

  socket.emit("sns-post", post);
  snsTextInput.value = "";
};

function addSnsItem(container, post) {
  const div = document.createElement("div");
  div.className = "sns-item";

  const nameEl = document.createElement("div");
  nameEl.className = "sns-name";
  nameEl.textContent = post.userDisplayName;

  const textEl = document.createElement("div");
  textEl.textContent = post.text;

  const timeEl = document.createElement("div");
  timeEl.className = "sns-time";
  timeEl.textContent = post.time;

  div.appendChild(nameEl);
  div.appendChild(textEl);
  div.appendChild(timeEl);

  container.prepend(div);
}

// ===============================
// DM
// ===============================
dmSendBtn.onclick = () => {
  const toUsername = dmToUsernameInput.value.trim();
  const toSocketId = dmToSocketInput.value.trim();
  const message = dmTextInput.value.trim();
  if (!toUsername || !toSocketId || !message) return;

  socket.emit("dm-send", {
    toSocketId,
    message,
    fromUsername: currentUser.username,
    fromDisplayName: currentUser.displayName,
    toUsername
  });

  addDmLog(
    `自分 (${currentUser.displayName}/${currentUser.username}) → ${toUsername}`,
    message
  );
  dmTextInput.value = "";
};

function addDmLog(fromLabel, text) {
  const div = document.createElement("div");
  div.className = "dm-item";

  const fromEl = document.createElement("div");
  fromEl.className = "dm-from";
  fromEl.textContent = fromLabel;

  const textEl = document.createElement("div");
  textEl.className = "dm-text";
  textEl.textContent = text;

  div.appendChild(fromEl);
  div.appendChild(textEl);
  dmLog.prepend(div);
}

// REST履歴
async function loadSnsHistory() {
  try {
    const res = await fetch("/api/snsHistory");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "snsHistory failed");
    snsFeed.innerHTML = "";
    phoneSnsFeed.innerHTML = "";
    json.messages.forEach((m) => {
      addSnsItem(snsFeed, m);
      addSnsItem(phoneSnsFeed, m);
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadDmHistory() {
  try {
    const res = await fetch("/api/dmHistory", {
      headers: { "x-session-token": sessionToken }
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "dmHistory failed");
    json.messages.forEach((m) => {
      addDmLog(
        `履歴 ← ${m.fromDisplayName} (${m.fromUsername})`,
        `${m.message} (${m.time})`
      );
    });
  } catch (e) {
    console.error(e);
  }
}

// ===============================
// スマホUI
// ===============================
function openPhone() {
  phone.classList.remove("hidden");
}
function closePhone() {
  phone.classList.add("hidden");
}
phoneClose.onclick = closePhone;

phoneTabs.forEach((btn) => {
  btn.onclick = () => {
    const tabId = btn.dataset.tab;
    document
      .querySelectorAll(".phone-tab")
      .forEach((tab) => tab.classList.add("hidden"));
    document
      .getElementById(`tab-${tabId}`)
      .classList.remove("hidden");
  };
});

window.addEventListener("keydown", (e) => {
  if (!currentUser) return;
  if (e.key.toLowerCase() === phoneKey) {
    if (phone.classList.contains("hidden")) openPhone();
    else closePhone();
  }
});

// ===============================
// マップ描画
// ===============================
function updateMapSelf(pos, yawDeg) {
  mapSelf.pos = pos;
  mapSelf.yaw = yawDeg;
  drawMap();
}

function updateMapPlayer(id, pos) {
  mapPlayers[id] = pos;
  drawMap();
}

function removeMapPlayer(id) {
  delete mapPlayers[id];
  drawMap();
}

function drawMap() {
  if (!mapCanvas) return;
  const ctx = mapCtx;
  const w = mapCanvas.width;
  const h = mapCanvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0, 20, 40, 0.8)";
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h / 2;
  const scale = 4;
  const mode = mapModeSelect.value;
  const yawRad = (mapSelf.yaw * Math.PI) / 180;

  function worldToMap(x, z) {
    const dx = x - mapSelf.pos.x;
    const dz = z - mapSelf.pos.z;

    let rx = dx;
    let rz = dz;

    if (mode === "heading") {
      const sin = Math.sin(-yawRad);
      const cos = Math.cos(-yawRad);
      const nx = dx * cos - dz * sin;
      const nz = dx * sin + dz * cos;
      rx = nx;
      rz = nz;
    }

    return {
      x: centerX + rx * scale,
      y: centerY + rz * scale
    };
  }

  ctx.fillStyle = "#ffffff";
  for (const id in mapPlayers) {
    const p = mapPlayers[id];
    const m = worldToMap(p.x, p.z);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#00ffff";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#00ffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);

  let arrowX = centerX;
  let arrowY = centerY - 12;

  if (mode === "heading") {
    arrowX = centerX;
    arrowY = centerY - 12;
  } else {
    const sin = Math.sin(-yawRad);
    const cos = Math.cos(-yawRad);
    arrowX = centerX + sin * 12;
    arrowY = centerY - cos * 12;
  }

  ctx.lineTo(arrowX, arrowY);
  ctx.stroke();
}

mapModeSelect.onchange = drawMap;

// ===============================
// エディタ起動
// ===============================
openEditorBtn.onclick = () => {
  if (!currentRoomId) return alert("ルームを選択してね");
  window.editorOpen(currentRoomId, sessionToken);
};

// ===============================
// 移動・ジャンプ・重力
// ===============================
let lastTime = performance.now();

function tick() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (currentUser) updateMovement(dt);
  requestAnimationFrame(tick);
}

function updateMovement(dt) {
  const pos = playerRoot.getAttribute("position");

  playerRoot.setAttribute("rotation", `0 ${yaw} 0`);
  playerCamera.setAttribute("rotation", `${pitch} 0 0`);

  let inputX = 0;
  let inputZ = 0;
  if (keys["w"]) inputZ += 1; // 逆転
  if (keys["s"]) inputZ -= 1; // 逆転
  if (keys["a"]) inputX -= 1;
  if (keys["d"]) inputX += 1;

  const len = Math.hypot(inputX, inputZ);
  if (len > 0) {
    inputX /= len;
    inputZ /= len;
  }

  const rad = (yaw * Math.PI) / 180;
  const forwardX = -Math.sin(rad);
  const forwardZ = -Math.cos(rad);
  const rightX = Math.cos(rad);
  const rightZ = -Math.sin(rad);

  const moveX = (forwardX * inputZ + rightX * inputX) * MOVE_SPEED;
  const moveZ = (forwardZ * inputZ + rightZ * inputX) * MOVE_SPEED;

  velocity.x = moveX;
  velocity.z = moveZ;

  velocity.y += GRAVITY * dt;

  let newY = pos.y + velocity.y * dt;
  if (newY < 1) {
    newY = 1;
    velocity.y = 0;
    isGrounded = true;
  }

  const newX = pos.x + velocity.x * dt;
  const newZ = pos.z + velocity.z * dt;

  playerRoot.setAttribute("position", {
    x: newX,
    y: newY,
    z: newZ
  });

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "move",
        pos: { x: newX, y: newY, z: newZ },
        avatarColor
      })
    );
  }

  updateMapSelf({ x: newX, y: newY, z: newZ }, yaw);
}

tick();
