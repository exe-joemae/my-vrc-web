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

// --- 位置同期（ルームごとの簡易VRC） ---
let wsClients = new Map(); // ws -> { id, room }

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = url.searchParams.get("room") || "lobby";
  const id = Math.random().toString(36).slice(2);

  wsClients.set(ws, { id, room });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "move") {
      const me = wsClients.get(ws);
      for (const [client, info] of wsClients) {
        if (client !== ws && info.room === me.room) {
          client.send(
            JSON.stringify({
              type: "spawn",
              id: me.id,
              pos: data.pos
            })
          );
        }
      }
    }
  });

  ws.on("close", () => wsClients.delete(ws));
});

// --- 音声チャット（WebRTC シグナリング） ---
io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
  });

  socket.on("signal", (payload) => {
    const { to, data } = payload;
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("get-peers", (roomId, cb) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const peers = room ? Array.from(room).filter((id) => id !== socket.id) : [];
    cb(peers);
  });

  // --- 全ルーム共通SNS ---
  socket.on("sns-post", (post) => {
    io.emit("sns-feed", post);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
