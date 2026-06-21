// ===============================
//  sns.js
//  スマホ版 SNS 投稿・表示
// ===============================

const phoneSnsFeed = document.getElementById("phone-sns-feed");
const phoneSnsText = document.getElementById("phone-sns-text");
const phoneSnsSend = document.getElementById("phone-sns-send");

const snsSocket = window.socket;

// -------------------------------
// SNS投稿（スマホ）
// -------------------------------
phoneSnsSend.onclick = () => {
  const text = phoneSnsText.value.trim();
  if (!text || !window.currentUser) return;

  const post = {
    userDisplayName: window.currentUser.displayName,
    text,
    time: new Date().toLocaleTimeString()
  };

  snsSocket.emit("sns-post", post);
  phoneSnsText.value = "";
};

// -------------------------------
// SNSリアルタイム受信（スマホ）
// -------------------------------
snsSocket.on("sns-feed", (msg) => {
  addSnsItem(phoneSnsFeed, msg);
});

// -------------------------------
// SNSアイテム追加（スマホ）
// -------------------------------
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
