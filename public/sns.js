// ===============================
//  sns.js
//  スマホ版 SNS 投稿のみ
// ===============================

const phoneSnsFeed = document.getElementById("phone-sns-feed");
const phoneSnsText = document.getElementById("phone-sns-text");
const phoneSnsSend = document.getElementById("phone-sns-send");

const snsSocket = window.socket;

// スマホからSNS投稿
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
