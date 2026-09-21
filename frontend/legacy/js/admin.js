/* ======================================================================
   8-sinf AI Homework — Admin panel (admin.js)
   ====================================================================== */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 3500);
  }

  let books = [];

  async function ensureAdmin() {
    if (!API.token) {
      location.href = "/";
    }
    if (API.user && API.user.role !== "admin") {
      location.href = "/";
    }
  }

  async function loadOverview() {
    try {
      const r = await API.get("/api/admin/stats");
      const map = [
        ["users", "Foydalanuvchilar"], ["active_users", "Faol foydalanuvchilar"],
        ["books", "Kitoblar"], ["indexed_books", "Indekslangan kitoblar"],
        ["pages", "Indekslangan sahifalar"], ["chunks", "Chunklar"],
        ["chat_messages", "Chat savollari"], ["ai_provider", "AI provayder"],
      ];
      const cards = $$("#statGrid .stat-card");
      map.forEach(([k, label], i) => {
        if (cards[i]) {
          cards[i].querySelector("b").textContent = r[k] ?? "?";
          cards[i].querySelector("span").textContent = label;
        }
      });
      $("#serverStatus").innerHTML =
        `<div class="status-row">
           <span class="badge green">🟢 Server: Online</span>
           <span class="badge">AI: ${esc(r.ai_provider || "?")}</span>
           <span class="badge">Vector: ${r.vector_ready ? "tayyor" : "yo'q"}</span>
           <span class="badge">Host: ${esc(r.hostname)}</span>
           <span class="badge">Ishlagan: ${esc(r.started_at)}</span>
         </div>`;
    } catch (e) {
      toast(e.message);
    }
  }

  async function loadAdminBooks() {
    try {
      books = await API.get("/api/admin/books");
      const rows = books
        .map(
          (b) => `<tr>
            <td>${esc(b.subject_name)}</td>
            <td>${esc(b.title)} <div class="tiny-meta">${esc(b.author || "")}</div></td>
            <td>${esc(b.edition || "")} ${esc(b.year || "")}</td>
            <td>${b.num_pages || "—"}</td>
            <td>${b.indexed ? '<span class="badge green">✓</span>' : '<span class="badge">—</span>'}</td>
            <td>
              <button class="btn tiny ghost adIdx" data-bid="${b.id}">Indeks</button>
              <button class="btn tiny danger adDel" data-bid="${b.id}">O'chirish</button>
            </td>
          </tr>`
        )
        .join("");
      $("#adminBookRows").innerHTML = rows;
    } catch (e) {
      toast(e.message);
    }
  }

  $("#adminBookRows")?.addEventListener("click", async (e) => {
    const del = e.target.closest(".adDel");
    const idx = e.target.closest(".adIdx");
    if (del) {
      if (!confirm("Kitobni va uning indeksini o'chirishni tasdiqlaysizmi?")) return;
      try {
        await API.del("/api/books/" + del.dataset.bid);
        toast("O'chirildi");
        loadAdminBooks();
        loadOverview();
      } catch (err) {
        toast(err.message);
      }
    }
    if (idx) {
      try {
        const r = await API.post("/api/books/" + idx.dataset.bid + "/index");
        toast("Indekslandi: " + r.pages + " sahifa");
        loadAdminBooks();
        loadIndex();
        loadOverview();
      } catch (err) {
        toast(err.message);
      }
    }
  });

  async function loadAdminUsers() {
    try {
      const users = await API.get("/api/admin/users");
      const rows = users
        .map(
          (u) => `<tr>
            <td>${esc(u.username)}</td>
            <td>${esc(u.first_name + " " + u.last_name)}</td>
            <td>${u.role === "admin" ? "🛠 admin" : "🎓 student"}</td>
            <td>${u.is_active ? '<span class="badge green">faol</span>' : '<span class="badge red">bloklangan</span>'}</td>
            <td>${esc((u.created_at || "").slice(0, 16))}</td>
            <td>
              <button class="btn tiny ghost adToggle" data-uid="${u.id}" data-active="${u.is_active ? 1 : 0}">
                ${u.is_active ? "Bloklash" : "Faollashtirish"}
              </button>
            </td>
          </tr>`
        )
        .join("");
      $("#adminUserRows").innerHTML = rows;
    } catch (e) {
      toast(e.message);
    }
  }

  $("#adminUserRows")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".adToggle");
    if (!btn) return;
    const active = btn.dataset.active === "1" ? false : true;
    try {
      await API.request("PATCH", "/api/admin/users/" + btn.dataset.uid, active ? { is_active: 1 } : { is_active: 0 });
      toast("Holat o'zgartirildi");
      loadAdminUsers();
    } catch (err) {
      toast(err.message);
    }
  });

  async function loadAiSettings() {
    try {
      const r = await API.get("/api/admin/ai");
      const ollama = r.ollama_online ? '<span class="badge green">online</span>' : '<span class="badge red">oflayn</span>';
      $("#aiSettingsBox").innerHTML = `<table class="kv-table">
        <tr><td>Provayder (sozlama)</td><td><code>${esc(r.provider)}</code></td></tr>
        <tr><td>Amalda ishlayotgan</td><td><code>${esc(r.effective_provider)}</code></td></tr>
        <tr><td>OpenAI model</td><td><code>${esc(r.openai_model)}</code></td></tr>
        <tr><td>OpenAI base URL</td><td><code>${esc(r.openai_base)}</code></td></tr>
        <tr><td>Ollama URL</td><td><code>${esc(r.ollama_url)}</code> ${ollama}</td></tr>
        <tr><td>Ollama model</td><td><code>${esc(r.ollama_model)}</code></td></tr>
        <tr><td>Navbat (concurrent)</td><td><code>${r.concurrency}</code></td></tr>
        <tr><td>Chegara (so'rov/dak)</td><td><code>${r.rate_per_minute}</code></td></tr>
      </table>`;
    } catch (e) {
      toast(e.message);
    }
  }

  async function loadIndex() {
    try {
      const r = await API.get("/api/admin/index");
      const vec = r.vector || {};
      $("#indexInfoBox").innerHTML =
        `<div class="badge">Chunklar: ${vec.chunks || 0}</div>
         <div class="badge">Kitoblar: ${vec.books || 0}</div>
         <div class="badge">Vector: ${vec.ready ? "tayyor" : "yo'q"}</div>`;
      $$("#indexRows").innerHTML = "";
      const rowsHtml = r.books
        .map(
          (b) => `<tr>
            <td>${esc(b.title)}</td>
            <td>${b.num_pages || "—"}</td>
            <td>${b.indexed ? '<span class="badge green">✓</span>' : '<span class="badge">—</span>'}</td>
            <td>${b.page_offset ?? 0}</td>
            <td><button class="btn tiny ghost adIdx" data-bid="${b.id}">Indeks</button></td>
          </tr>`
        )
        .join("");
      $$("#indexRows").innerHTML = rowsHtml;
    } catch (e) {
      toast(e.message);
    }
  }
  document.querySelector("#indexRows")?.addEventListener("click", async (e) => {
    const idx = e.target.closest(".adIdx");
    if (!idx) return;
    try {
      const r = await API.post("/api/books/" + idx.dataset.bid + "/index");
      toast("Indekslandi: " + r.pages + " sahifa");
      loadIndex();
      loadOverview();
    } catch (err) {
      toast(err.message);
    }
  });

  $("#adBtnReindex")?.addEventListener("click", async () => {
    try {
      toast("Barchasi qayta indekslanmoqda…");
      const r = await API.post("/api/books/reindex-all");
      toast("Tayyor: " + (r.vector?.chunks || 0) + " chunk");
      loadIndex();
      loadOverview();
    } catch (e) {
      toast(e.message);
    }
  });

  $("#adBtnAdd")?.addEventListener("click", () => {
    location.href = "/";
  });

  // panel switching
  $$("[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("[data-panel]").forEach((b) => b.classList.toggle("active", b === btn));
      $$(".apane").forEach((p) => p.classList.toggle("active", p.id === "panel-" + btn.dataset.panel));
      const panel = btn.dataset.panel;
      if (panel === "overview") loadOverview();
      if (panel === "books") loadAdminBooks();
      if (panel === "users") loadAdminUsers();
      if (panel === "ai") loadAiSettings();
      if (panel === "index") loadIndex();
    });
  });

  async function init() {
    await ensureAdmin();
    loadOverview();
    loadAdminBooks();
    loadAdminUsers();
    loadAiSettings();
    loadIndex();
  }
  init();
})();