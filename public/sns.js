const snsFeed = document.getElementById("sns-feed");
const snsName = document.getElementById("sns-name");
const snsText = document.getElementById("sns-text");
const snsSend = document.getElementById("sns-send");

// client.js で window.socket に入れてある
const snsSocket = window.socket || io();

snsSend.onclick = () => {
  const user = snsName.value.trim() || "名無し";
  const text = snsText.value.trim();
  if (!text) return;

  const post = {
    user,
    text,
    time: new Date().toLocaleTimeString()
  };

  snsSocket.emit("sns-post", post);
  snsText.value = "";
};

snsSocket.on("sns-feed", (post) => {
  const div = document.createElement("div");
  div.className = "sns-item";

  const nameEl = document.createElement("div");
  nameEl.className = "sns-name";
  nameEl.textContent = post.user;

  const textEl = document.createElement("div");
  textEl.textContent = post.text;

  const timeEl = document.createElement("div");
  timeEl.className = "sns-time";
  timeEl.textContent = post.time;

  div.appendChild(nameEl);
  div.appendChild(textEl);
  div.appendChild(timeEl);

  snsFeed.prepend(div);
});
