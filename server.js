const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = {
  users: {},
  rooms: {},
  snsMessages: [],
  dmMessages: []
};

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function ensureLobby() {
  if (!db.rooms["lobby"]) {
    db.rooms["lobby"] = {
      owner: "system",
      name: "Lobby",
      environment: {
        skyColor: "#000022",
        fogColor: "#000000",
        fogDensity: 0.02,
        ambientColor: "#FFFFFF"
      },
      bounds: {
        width: 50,
        depth: 50
      },
      objects: []
    };
  }
}
ensureLobby();

// 認証
app.post("/api/register", (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  if (db.users[username]) {
    return res.status(400).json({ error: "username already exists" });
  }

  db.users[username] = {
    username,
    passwordHash: hashPassword(password),
    displayName: displayName || username,
    avatarColor: "#FFAA00",
    phoneKey: "p",
    sessionToken: null
  };

  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const user = db.users[username];
  if (!user) {
    return res.status(400).json({ error: "user not found" });
  }
  if (user.passwordHash !== hashPassword(password)) {
    return res.status(400).json({ error: "invalid password" });
  }

  const token = crypto.randomBytes(16).toString("hex");
  user.sessionToken = token;

  res.json({
    ok: true,
    token,
    user: {
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      phoneKey: user.phoneKey
    }
  });
});

app.get("/api/me", (req, res) => {
  const token = req.headers["x-session-token"];
  const user = Object.values(db.users).find((u) => u.sessionToken === token);
  if (!user) return res.status(401).json({ error: "invalid session" });

  res.json({
    ok: true,
    user: {
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      phoneKey: user.phoneKey
    }
  });
});

app.post("/api/updateUser", (req, res) => {
  const token = req.headers["x-session-token"];
  const user = Object.values(db.users).find((u) => u.sessionToken === token);
  if (!user) return res.status(401).json({ error: "invalid session" });

  const { displayName, avatarColor, phoneKey } = req.body || {};
  if (displayName) user.displayName = displayName;
  if (avatarColor) user.avatarColor = avatarColor;
  if (phoneKey) user.phoneKey = phoneKey;

  res.json({ ok: true });
});

// ルーム
app.get("/api/myRooms", (req, res) => {
  const token = req.headers["x-session-token"];
  const user = Object.values(db.users).find((u) => u.sessionToken === token);
  if (!user) return res.status(401).json({ error: "invalid session" });

  const rooms = Object.entries(db.rooms)
    .filter(([id, room]) => room.owner === user.username)
    .map(([id, room]) => ({
      id,
      name: room.name,
      environment: room.environment,
      bounds: room.bounds,
      objects: room.objects
    }));

  res.json({ ok: true, rooms });
});

app.post("/api/createRoom", (req, res) => {
  const token = req.headers["x-session-token"];
  const user = Object.values(db.users).find((u) => u.sessionToken === token);
  if (!user) return res.status(401).json({ error: "invalid session" });

  const { roomId, name } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId required" });
  if (db.rooms[roomId]) {
    return res.status(400).json({ error: "roomId already exists" });
  }

  db.rooms[roomId] = {
    owner: user.username,
    name: name || roomId,
    environment: {
      skyColor: "#000022",
      fogColor: "#000000",
      fogDensity: 0.02,
      ambientColor: "#FFFFFF"
    },
    bounds: {
      width: 50,
      depth: 50
    },
    objects: []
  };

  res.json({ ok: true, room: db.rooms[roomId] });
});

app.get("/api/getRoom/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const room = db.rooms[roomId];
  if (!room) return res.status(404).json({ error: "room not found" });
  res.json({ ok: true, room });
});

app.post("/api/updateRoom/:roomId", (req, res) => {
  const token = req.headers["x-session-token"];
  const user = Object.values(db.users).find((u) => u.sessionToken === token);
  if (!user) return res.status(401).json({ error: "invalid session" });

  const roomId = req.params.roomId;
  const room = db.rooms[roomId];
  if (!room) return res.status(404).json({ error: "room not found" });
  if (room.owner !== user.username) {
    return res.status(403).json({ error: "not owner" });
  }

  const { environment, bounds, objects } = req.body || {};
  if (environment) room.environment = environment;
  if (bounds) room.bounds = bounds;
  if (Array.isArray(objects)) room.objects = objects;

  res.json({ ok: true, room });
});

// SNS / DM
app.get("/api/snsHistory", (req, res) => {
  res.json({ ok: true, messages: db.snsMessages });
});

app.get("/api/dmHistory", (req, res) => {
  const token = req.headers["x-session-token"];
  const user = Object.values(db.users).find((u) => u.sessionToken === token);
  if (!user) return res.status(401).json({ error: "invalid session" });

  const messages = db.dmMessages.filter(
    (m) => m.toUsername === user.username
  );
  res.json({ ok: true, messages });
});

// WebSocket（位置同期）
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
        if (info.room !== me.room) continue;
        if (client === ws) continue;

        client.send(
          JSON.stringify({
            type: "spawn",
            id: me.id,
            pos: data.pos,
            avatarColor: data.avatarColor || user.avatarColor,
            displayName: user.displayName,
            mapPos: data.pos
          })
        );
      }
    }
  });

  ws.on("close", () => {
    const me = wsClients.get(ws);
    wsClients.delete(ws);
    if (!me) return;

    // 他クライアントに despawn 通知
    for (const [client, info] of wsClients) {
      if (info.room !== me.room) continue;
      client.send(
        JSON.stringify({
          type: "despawn",
          id: me.id
        })
      );
    }
  });
});

// Socket.IO
io.on("connection", (socket) => {
  socket.on("join-room", (payload) => {
    const { roomId, username } = payload || {};
    socket.join(roomId || "lobby");
    socket.roomId = roomId || "lobby";
    socket.username = username || "guest";

    socket.emit("sns-history", db.snsMessages);

    const myDm = db.dmMessages.filter(
      (m) => m.toUsername === socket.username
    );
    socket.emit("dm-history", myDm);
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

  socket.on("sns-post", (post) => {
    const msg = {
      userDisplayName: post.userDisplayName || "名無し",
      text: post.text,
      time: post.time
    };
    db.snsMessages.push(msg);
    io.emit("sns-feed", msg);
  });

  socket.on("dm-send", (payload) => {
    const {
      toSocketId,
      message,
      fromUsername,
      fromDisplayName,
      toUsername
    } = payload;

    const dm = {
      fromUsername: fromUsername || socket.username,
      fromDisplayName: fromDisplayName || fromUsername,
      toUsername: toUsername || "guest",
      message,
      time: new Date().toISOString(),
      read: false
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
