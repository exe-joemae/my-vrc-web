// --- DOM参照 ---
const roomInput = document.getElementById("roomId");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const usernameInput = document.getElementById("username");
const displayNameInput = document.getElementById("displayName");
const phoneUsernameInput = document.getElementById("phoneUsername");
const phoneDisplayNameInput = document.getElementById("phoneDisplayName");
const accountSaveBtn = document.getElementById("accountSaveBtn");
const accountLoadBtn = document.getElementById("accountLoadBtn");

const socketIdLabel = document.getElementById("socketIdLabel");

const playerRoot = document.getElementById("playerRoot");
const playerCamera = document.getElementById("playerCamera");
const playerAvatar = document.getElementById("playerAvatar");
const playerNameTag = document.getElementById("playerNameTag");
const ground = document.getElementById("ground");
const box1 = document.getElementById("box1");

const phone = document.getElementById("phone");
const phoneClose = document.getElementById("phone-close");
const phoneTabs = document.querySelectorAll("#phone-tabs button");

const phoneKeyInput = document.getElementById("phoneKeyInput");
const phoneKeySave = document.getElementById("phoneKeySave");
const phoneKeyLabel = document.getElementById("phoneKeyLabel");

const roomGroundColorInput = document.getElementById("roomGroundColor");
const roomBoxColorInput = document.getElementById("roomBoxColor");
const roomApplyBtn = document.getElementById("roomApply");

const avatarColorInput = document.getElementById("avatarColorInput");
const avatarApplyBtn = document.getElementById("avatarApply");

const dmToUsernameInput = document.getElementById("dm-to-username");
const dmToSocketInput = document.getElementById("dm-to-socket");
const dmTextInput = document.getElementById("dm-text");
const dmSendBtn = document.getElementById("dm-send");
const dmLog = document.getElementById("dm-log");

const startVoiceBtn = document.getElementById("startVoiceBtn");

// --- SNS（HUD側） ---
const snsTextInput = document.getElementById("sns-text");
const snsSendBtn = document.getElementById("sns-send");
const snsFeed = document.getElementById("sns-feed");

// --- SNS（スマホ側）は sns.js で扱う ---

// --- 状態 ---
const url = new URL(window.location.href);
const currentRoom = url.searchParams.get("room") || "lobby";
roomInput.value = currentRoom;

let username = "guest";
let displayName = "Guest";
let avatarColor = "#FFAA00";
let phoneKey = "p";

let velocity = { x: 0, y: 0, z: 0 };
const GRAVITY = -9.8;
const MOVE_SPEED = 4;
let keys = {};
let yaw = 0;
let pitch = 0;

// --- キー入力 ---
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// マウスドラッグで視点回転
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

// 矢印キーで視点回転
window.addEventListener("keydown", (e) => {
  const sensitivity = 2;
  if (e.key === "ArrowLeft") yaw += sensitivity;
  if (e.key === "ArrowRight") yaw -= sensitivity;
  if (e.key === "ArrowUp") pitch -= sensitivity;
  if (e.key === "ArrowDown") pitch += sensitivity;
  pitch = Math.max(-80, Math.min(80, pitch));
});

// --- WebSocket（位置同期） ---
let ws;
function connectWS(room) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(
    `${proto}://${location.host}/?room=${room}&username=${encodeURIComponent(
      username
    )}`
  );

  ws.onopen = () => {
    console.log("WS connected");
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === "spawn") {
      let e = document.getElementById(data.id);
      let nameTag;
      if (!e) {
        e = document.createElement("a-entity");
        e.setAttribute("id", data.id);
        e.setAttribute(
          "geometry",
          "primitive: box; height: 1.6; width: 0.5; depth: 0.5"
        );
        e.setAttribute(
          "material",
          `color: ${data.avatarColor || "#00AAFF"}`
        );
        e.setAttribute("position", "0 0 0");

        nameTag = document.createElement("a-entity");
        nameTag.setAttribute(
          "text",
          `value: ${data.displayName || "Guest"}; align: center; color: #00FFFF; width: 4`
        );
        nameTag.setAttribute("position", "0 2.2 0");
        nameTag.setAttribute("id", `name-${data.id}`);

        e.appendChild(nameTag);
        document.querySelector("a-scene").appendChild(e);
      } else {
        nameTag = document.getElementById(`name-${data.id}`);
      }

      e.setAttribute("position", data.pos);
      if (data.avatarColor) {
        e.setAttribute("material", `color: ${data.avatarColor}`);
      }
      if (nameTag && data.displayName) {
        nameTag.setAttribute(
          "text",
          `value: ${data.displayName}; align: center; color: #00FFFF; width: 4`
        );
      }
    }
  };
}

// --- Socket.IO（音声＋SNS履歴＋DM履歴） ---
const socket = io();
window.socket = socket;

let localStream = null;
let peers = {};

socket.on("connect", () => {
  socketIdLabel.textContent = socket.id;

  socket.emit("join-room", {
    roomId: currentRoom,
    username
  });
});

socket.on("sns-history", (messages) => {
  // HUD側
  messages.forEach((m) => {
    addSnsItem(snsFeed, {
      userDisplayName: m.userDisplayName,
      text: m.text,
      time: m.time
    });
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

  socket.emit("get-peers", currentRoom, async (peerIds) => {
    for (const peerId of peerIds) {
      await createPeerConnection(peerId, true);
    }
  });
};

socket.on("signal", async ({ from, data }) => {
  let pc = peers[from];
  if (!pc) {
    pc = await createPeerConnection(from, false);
  }

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

// --- アカウント名・表示名更新 ---
function applyAccount(usernameVal, displayNameVal) {
  username = usernameVal || "guest";
  displayName = displayNameVal || username;

  usernameInput.value = username;
  displayNameInput.value = displayName;
  phoneUsernameInput.value = username;
  phoneDisplayNameInput.value = displayName;

  playerNameTag.setAttribute(
    "text",
    `value: ${displayName}; align: center; color: #00FFFF; width: 4`
  );
}

// HUD側変更
usernameInput.addEventListener("change", () => {
  applyAccount(usernameInput.value.trim(), displayNameInput.value.trim());
});
displayNameInput.addEventListener("change", () => {
  applyAccount(usernameInput.value.trim(), displayNameInput.value.trim());
});

// スマホ側変更
phoneAccountApply.onclick = () => {
  applyAccount(
    phoneUsernameInput.value.trim(),
    phoneDisplayNameInput.value.trim()
  );
};

// サーバに保存
accountSaveBtn.onclick = async () => {
  if (!usernameInput.value.trim()) {
    alert("ユーザー名を入力してね");
    return;
  }
  applyAccount(usernameInput.value.trim(), displayNameInput.value.trim());

  const body = {
    username,
    displayName,
    avatarColor,
    phoneKey,
    groundColor: ground.getAttribute("color"),
    boxColor: box1.getAttribute("color")
  };

  try {
    const res = await fetch("/api/saveUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "save failed");
    alert("サーバに保存しました");
  } catch (e) {
    console.error(e);
    alert("保存に失敗しました");
  }
};

// サーバからロード
accountLoadBtn.onclick = async () => {
  const u = usernameInput.value.trim();
  if (!u) {
    alert("ユーザー名を入力してね");
    return;
  }
  try {
    const res = await fetch(`/api/getUser/${encodeURIComponent(u)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "load failed");
    const user = json.user;

    applyAccount(user.username, user.displayName);
    avatarColor = user.avatarColor || "#FFAA00";
    avatarColorInput.value = avatarColor;
    playerAvatar.setAttribute("material", `color: ${avatarColor}`);

    phoneKey = user.phoneKey || "p";
    setPhoneKeyLabel();

    ground.setAttribute("color", user.groundColor || "#7BC8A4");
    box1.setAttribute("color", user.boxColor || "#4CC3D9");
    roomGroundColorInput.value = user.groundColor || "#7BC8A4";
    roomBoxColorInput.value = user.boxColor || "#4CC3D9";

    alert("サーバからロードしました");
  } catch (e) {
    console.error(e);
    alert("ロードに失敗しました");
  }
};

// --- スマホUI ---
function setPhoneKeyLabel() {
  phoneKeyLabel.textContent = phoneKey.toUpperCase();
}
setPhoneKeyLabel();

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

// スマホキー保存
phoneKeySave.onclick = () => {
  const v = phoneKeyInput.value.trim().toLowerCase();
  if (!v || v.length !== 1) {
    alert("1文字のキーを入力してね");
    return;
  }
  phoneKey = v;
  setPhoneKeyLabel();
  alert(`スマホキーを "${phoneKey.toUpperCase()}" に変更しました`);
};

// スマホ開閉キー
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === phoneKey) {
    if (phone.classList.contains("hidden")) {
      openPhone();
    } else {
      closePhone();
    }
  }
});

// --- ルーム模様替え ---
roomApplyBtn.onclick = () => {
  const gColor = roomGroundColorInput.value || "#7BC8A4";
  const bColor = roomBoxColorInput.value || "#4CC3D9";
  ground.setAttribute("color", gColor);
  box1.setAttribute("color", bColor);
};

// --- アバター設定 ---
avatarApplyBtn.onclick = () => {
  avatarColor = avatarColorInput.value || "#FFAA00";
  playerAvatar.setAttribute("material", `color: ${avatarColor}`);
};

// --- DM ---
dmSendBtn.onclick = () => {
  const toUsername = dmToUsernameInput.value.trim();
  const toSocketId = dmToSocketInput.value.trim();
  const message = dmTextInput.value.trim();
  if (!toUsername || !toSocketId || !message) return;

  socket.emit("dm-send", {
    toSocketId,
    message,
    fromUsername: username,
    fromDisplayName: displayName,
    toUsername
  });

  addDmLog(`自分 (${displayName}/${username}) → ${toUsername}`, message);
  dmTextInput.value = "";
};

socket.on("dm-receive", ({ from, fromUsername, fromDisplayName, message, time }) => {
  const label = `${fromDisplayName || fromUsername} (${fromUsername})`;
  addDmLog(`受信 ← ${label}`, `${message} (${time})`);
});

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

// --- SNS（HUD側） ---
snsSendBtn.onclick = () => {
  const text = snsTextInput.value.trim();
  if (!text) return;

  const post = {
    userDisplayName: displayName,
    text,
    time: new Date().toLocaleTimeString()
  };

  socket.emit("sns-post", post);
  snsTextInput.value = "";
};

socket.on("sns-feed", (msg) => {
  addSnsItem(snsFeed, msg);
});

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

// --- ルーム切り替え ---
joinRoomBtn.onclick = () => {
  const room = roomInput.value.trim();
  if (!room) return alert("Room ID を入力してね");
  const u = new URL(window.location.href);
  u.searchParams.set("room", room);
  window.location.href = u.toString();
};

// --- 移動・重力・同期 ---
let lastTime = performance.now();

function tick() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  updateMovement(dt);
  requestAnimationFrame(tick);
}

function updateMovement(dt) {
  const pos = playerRoot.getAttribute("position");

  playerRoot.setAttribute("rotation", `0 ${yaw} 0`);
  playerCamera.setAttribute("rotation", `${pitch} 0 0`);

  let inputX = 0;
  let inputZ = 0;
  if (keys["w"]) inputZ -= 1;
  if (keys["s"]) inputZ += 1;
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
}

// 初期接続
connectWS(currentRoom);
tick();
