const snsFeed = document.getElementById("sns-feed");
const snsName = document.getElementById("sns-name");
const snsText = document.getElementById("sns-text");
const snsSend = document.getElementById("sns-send");

const phoneSnsFeed = document.getElementById("phone-sns-feed");
const phoneSnsName = document.getElementById("phone-sns-name");
const phoneSnsText = document.getElementById("phone-sns-text");
const phoneSnsSend = document.getElementById("phone-sns-send");

// client.js で window.socket に入れてある
const snsSocket = window.socket || io();

// HUD版SNS投稿
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

// スマホ版SNS投稿
phoneSnsSend.onclick = () => {
  const user = phoneSnsName.value.trim() || "名無し";
  const text = phoneSnsText.value.trim();
  if (!text) return;

  const post = {
    user,
    text,
    time: new Date().toLocaleTimeString()
  };

  snsSocket.emit("sns-post", post);
  phoneSnsText.value = "";
};

// 受信（両方に表示）
snsSocket.on("sns-feed", (post) => {
  addSnsItem(snsFeed, post);
  addSnsItem(phoneSnsFeed, post);
});

function addSnsItem(container, post) {
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

  container.prepend(div);
}
