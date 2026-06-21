const express = require("express");
const app = express();
const server = require("http").createServer(app);
const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

let clients = new Map();

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2);
  clients.set(ws, id);

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "move") {
      for (const [client, cid] of clients) {
        if (client !== ws) {
          client.send(JSON.stringify({ type: "spawn", id, pos: data.pos }));
        }
      }
    }
  });

  ws.on("close", () => clients.delete(ws));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("running on " + PORT));
