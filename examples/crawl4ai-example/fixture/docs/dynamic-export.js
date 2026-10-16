// export.html の最後の節を、読み込みの少しあとに追加する。
// この節の文字列は export.html には書かれていない。通信・保存・計測はしない。
// 追加し終えたら main#guide の data-ready を "true" にする（取得側はこの印を待つ）。
(function () {
  "use strict";

  var HEADING = "書き出す前に確かめる";
  var KEYPOINT = "フォルダ名を日付と会場名にし、参加者の顔や連絡先が写った写真を除きます。";
  var NOTE = "この節は dynamic-export.js が追加しました。";

  function addSection() {
    var guide = document.getElementById("guide");
    if (!guide || guide.querySelector('[data-origin="script"]')) return;

    var article = document.createElement("article");
    article.className = "doc-section";
    article.setAttribute("data-origin", "script");

    var heading = document.createElement("h2");
    heading.textContent = HEADING;
    var keypoint = document.createElement("p");
    keypoint.className = "keypoint";
    keypoint.textContent = KEYPOINT;
    var note = document.createElement("p");
    note.className = "note";
    note.textContent = NOTE;

    article.appendChild(heading);
    article.appendChild(keypoint);
    article.appendChild(note);
    guide.appendChild(article);
    guide.setAttribute("data-ready", "true");
  }

  // 読み込み直後のHTMLにはまだ無い状態を作るため、少し遅らせて追加する。
  window.setTimeout(addSection, 400);
})();
