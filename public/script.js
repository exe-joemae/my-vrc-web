const ws = new WebSocket(location.origin.replace("http", "ws"));

ws.onopen = () => console.log("connected");

const player = document.getElementById("player");

setInterval(() => {
  const pos = player.getAttribute("position");
  ws.send(JSON.stringify({ type: "move", pos }));
}, 100);

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === "spawn") {
    let e = document.getElementById(data.id);
    if (!e) {
      e = document.createElement("a-sphere");
      e.setAttribute("id", data.id);
      e.setAttribute("radius", "0.2");
      e.setAttribute("color", "#FFC65D");
      document.querySelector("a-scene").appendChild(e);
    }
    e.setAttribute("position", data.pos);
  }
};
