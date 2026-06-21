const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * 簡易DB（メモリ）
 * users: username -> { username, displayName, avatarColor, phoneKey, groundColor, boxColor }
 * snsMessages: [{ userDisplayName, text, time }]
 * dmMessages: [{ fromUsername, fromDisplayName, toUsername, message, time }]
 */
const db = {
  users: {},
  snsMessages: [],
  dmMessages: []
};

// --- REST API: ユーザーデータ保存/取得 ---

// 保存（アップサート）
app.post("/api/saveUser", (req, res) => {
  const {
    username,
    displayName,
    avatarColor,
    phoneKey,
    groundColor,
    boxColor
  } = req.body || {};

  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  db.users[username] = {
    username,
    displayName: displayName || username,
    avatarColor: avatarColor || "#FFAA00",
    phoneKey: phoneKey || "p",
    groundColor: groundColor || "#7BC8A4",
    boxColor: boxColor || "#4CC3D9"
  };

  res.json({ ok: true, user: db.users[username] });
});

// 取得
app.get("/api/getUser/:username", (req, res) => {
  const username = req.params.username;
  const user = db.users[username];
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }
  res.json({ ok: true, user });
});

// SNS履歴取得
app.get("/api/snsHistory", (req, res) => {
  res.json({ ok: true, messages: db.snsMessages });
});

// DM履歴取得（自分宛）
app.get("/api/dmHistory/:username", (req, res) => {
  const username = req.params.username;
  const messages = db.dmMessages.filter((m) => m.toUsername === username);
  res.json({ ok: true, messages });
});

// --- 位置同期（ルームごとの簡易VRC） ---
let wsClients = new Map(); // ws -> { id, room, username }

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get("room") || "lobby";
  const username = url.searchParams.get("username") || "guest";
  const id = Math.random().toString(36).slice(2);

  wsClients.set(ws, { id, room, username });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "move") {
      const me = wsClients.get(ws);
      if (!me) return;

      const user = db.users[me.username] || {
        username: me.username,
        displayName: me.username,
        avatarColor: data.avatarColor || "#00AAFF"
      };

      for (const [client, info] of wsClients) {
        if (client !== ws && info.room === me.room) {
          client.send(
            JSON.stringify({
              type: "spawn",
              id: me.id,
              pos: data.pos,
              avatarColor: data.avatarColor || user.avatarColor || "#00AAFF",
              displayName: user.displayName || me.username
            })
          );
        }
      }
    }
  });

  ws.on("close", () => wsClients.delete(ws));
});

// --- 音声チャット（WebRTC シグナリング）＋SNS＋DM ---
io.on("connection", (socket) => {
  socket.on("join-room", (payload) => {
    const { roomId, username } = payload || {};
    socket.join(roomId || "lobby");
    socket.roomId = roomId || "lobby";
    socket.username = username || "guest";

    // 接続時にSNS履歴を送る
    socket.emit("sns-history", db.snsMessages);

    // 接続時にDM履歴（自分宛）を送る
    const myDm = db.dmMessages.filter(
      (m) => m.toUsername === socket.username
    );
    socket.emit("dm-history", myDm);
  });

  // WebRTC シグナリング
  socket.on("signal", (payload) => {
    const { to, data } = payload;
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("get-peers", (roomId, cb) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const peers = room ? Array.from(room).filter((id) => id !== socket.id) : [];
    cb(peers);
  });

  // SNS投稿（履歴に保存）
  socket.on("sns-post", (post) => {
    const msg = {
      userDisplayName: post.userDisplayName || post.user || "名無し",
      text: post.text,
      time: post.time
    };
    db.snsMessages.push(msg);
    io.emit("sns-feed", msg);
  });

  // DM（履歴に保存）
  socket.on("dm-send", (payload) => {
    const {
      toSocketId,
      message,
      fromUsername,
      fromDisplayName,
      toUsername
    } = payload;

    const dm = {
      fromUsername: fromUsername || socket.username || "guest",
      fromDisplayName: fromDisplayName || fromUsername || "guest",
      toUsername: toUsername || "guest",
      message,
      time: new Date().toISOString()
    };

    db.dmMessages.push(dm);

    io.to(toSocketId).emit("dm-receive", {
      from: socket.id,
      fromUsername: dm.fromUsername,
      fromDisplayName: dm.fromDisplayName,
      message: dm.message,
      time: dm.time
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
