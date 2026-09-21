/* Ulashilgan yechim sahifasi (share.js) — hech qanday token/foydalanuvchi kerak emas */
function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function loadShared(token) {
  const box = document.getElementById("sharedContent");
  try {
    const r = await fetch(`/api/share/${encodeURIComponent(token)}`).then((x) => x.json());
    if (!r || !r.answer) throw new Error("Yechim topilmadi");

    const sections = (r.answer.sections) || [];
    let html = `<div class="answer-card success">
      <div class="sec-label">Savol</div>
      <div class="sec-text">${esc(r.question)}</div>`;
    for (const s of sections) {
      html += `<div class="ans-section">
        <div class="sec-label">${esc(s.label)}</div>
        <div class="sec-text">${esc(s.text)}</div>
      </div>`;
    }
    const m = r.source || {};
    if (m && m.book_id) {
      const parts = [m.title, m.author, m.year ? m.year + "-yil" : "", m.printed_page ? m.printed_page + "-bet" : ""];
      html += `<div class="ans-manba"><strong>Manba:</strong> ${parts.filter(Boolean).map(esc).join(" · ")}</div>`;
    }
    if (r.answer.message) html += `<div class="ans-text">${esc(r.answer.message)}</div>`;
    html += `</div>`;
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = `<div class="answer-error">❌ ${esc(e.message || "Xato")}</div>`;
  }
}