// --- ルームID管理 ---
const roomInput = document.getElementById("roomId");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const url = new URL(window.location.href);
const currentRoom = url.searchParams.get("room") || "lobby";
roomInput.value = currentRoom;

// --- A-Frame エンティティ参照 ---
const playerRoot = document.getElementById("playerRoot");
const playerCamera = document.getElementById("playerCamera");

// --- 移動・重力用の状態 ---
let velocity = { x: 0, y: 0, z: 0 };
const GRAVITY = -9.8; // m/s^2
const MOVE_SPEED = 4; // m/s
const JUMP_SPEED = 5; // 使いたければ
let keys = {};
let yaw = 0; // 左右回転
let pitch = 0; // 上下回転（必要なら）

// キー入力
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
  ws = new WebSocket(`${proto}://${location.host}/?room=${room}`);

  ws.onopen = () => {
    console.log("WS connected");
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === "spawn") {
      let e = document.getElementById(data.id);
      if (!e) {
        e = document.createElement("a-entity");
        e.setAttribute("id", data.id);
        e.setAttribute(
          "geometry",
          "primitive: box; height: 1.6; width: 0.5; depth: 0.5"
        );
        e.setAttribute("material", "color: #00AAFF");
        e.setAttribute("position", "0 0 0");
        document.querySelector("a-scene").appendChild(e);
      }
      e.setAttribute("position", data.pos);
    }
  };
}

connectWS(currentRoom);

// --- ルーム切り替え ---
joinRoomBtn.onclick = () => {
  const room = roomInput.value.trim();
  if (!room) return alert("Room ID を入力してね");
  const u = new URL(window.location.href);
  u.searchParams.set("room", room);
  window.location.href = u.toString();
};

// --- 音声チャット（WebRTC + Socket.IO） ---
const socket = io();
window.socket = socket; // sns.js からも使えるように

const startVoiceBtn = document.getElementById("startVoiceBtn");

let localStream = null;
let peers = {}; // peerId -> RTCPeerConnection

socket.emit("join-room", currentRoom);

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

// --- 毎フレーム更新（重力＋移動＋視点回転＋位置同期） ---
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

  // 視点回転を反映
  playerRoot.setAttribute("rotation", `0 ${yaw} 0`);
  playerCamera.setAttribute("rotation", `${pitch} 0 0`);

  // 入力から移動方向を決定（ローカル座標）
  let inputX = 0;
  let inputZ = 0;
  if (keys["w"]) inputZ -= 1;
  if (keys["s"]) inputZ += 1;
  if (keys["a"]) inputX -= 1;
  if (keys["d"]) inputX += 1;

  // 正規化
  const len = Math.hypot(inputX, inputZ);
  if (len > 0) {
    inputX /= len;
    inputZ /= len;
  }

  // yaw に合わせてワールド座標へ
  const rad = (yaw * Math.PI) / 180;
  const forwardX = -Math.sin(rad);
  const forwardZ = -Math.cos(rad);
  const rightX = Math.cos(rad);
  const rightZ = -Math.sin(rad);

  const moveX = (forwardX * inputZ + rightX * inputX) * MOVE_SPEED;
  const moveZ = (forwardZ * inputZ + rightZ * inputX) * MOVE_SPEED;

  velocity.x = moveX;
  velocity.z = moveZ;

  // 重力
  velocity.y += GRAVITY * dt;

  // 地面との当たり判定（y=0 を地面とする）
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

  // 位置同期（100msごとに送るのでもOKだが、ここでは簡単に毎フレーム）
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "move",
        pos: { x: newX, y: newY, z: newZ }
      })
    );
  }
}

tick();
