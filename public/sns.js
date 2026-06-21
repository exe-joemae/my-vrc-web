const phoneSnsFeed = document.getElementById("phone-sns-feed");
const phoneSnsText = document.getElementById("phone-sns-text");
const phoneSnsSend = document.getElementById("phone-sns-send");

// client.js で window.socket に入れてある
const snsSocket = window.socket || io();

// スマホ版SNS投稿
phoneSnsSend.onclick = () => {
  const text = phoneSnsText.value.trim();
  if (!text) return;

  // displayName は client.js 側のグローバルを使いたいけど、
  // ここでは簡略化して "MobileUser" とするか、
  // window.displayName を使う前提にしてもOK。
  const displayName = window.displayName || "MobileUser";

  const post = {
    userDisplayName: displayName,
    text,
    time: new Date().toLocaleTimeString()
  };

  snsSocket.emit("sns-post", post);
  phoneSnsText.value = "";
};

// 履歴は socket.on("sns-history") を client.js 側で受けているので、
// ここではリアルタイム分だけ表示
snsSocket.on("sns-feed", (msg) => {
  addSnsItem(phoneSnsFeed, msg);
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
