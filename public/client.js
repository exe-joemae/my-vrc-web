// --- ルームID管理 ---
const roomInput = document.getElementById("roomId");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const url = new URL(window.location.href);
const currentRoom = url.searchParams.get("room") || "lobby";
roomInput.value = currentRoom;

// --- WebSocket（位置同期） ---
let ws;
function connectWS(room) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/?room=${room}`);

  const player = document.getElementById("player");

  ws.onopen = () => {
    console.log("WS connected");
    setInterval(() => {
      const pos = player.getAttribute("position");
      ws.send(JSON.stringify({ type: "move", pos }));
    }, 100);
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === "spawn") {
      let e = document.getElementById(data.id);
      if (!e) {
        e = document.createElement("a-entity");
        e.setAttribute("id", data.id);
        e.setAttribute("geometry", "primitive: sphere; radius: 0.2");
        e.setAttribute("material", "color: #FFC65D");
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

  // 既存のピア一覧を取得して、こちらから offer を投げる
  socket.emit("get-peers", currentRoom, async (peerIds) => {
    for (const peerId of peerIds) {
      await createPeerConnection(peerId, true);
    }
  });
};

// シグナリング受信
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

  // 自分の音声を乗せる
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
