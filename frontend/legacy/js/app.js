/* ======================================================================
   8-sinf AI Homework — Asosiy frontend (app.js)
   ====================================================================== */
(function () {
  "use strict";

  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg, ms = 3500) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
  }

  /* ------------------------------------------------------------------ */
  /* Tabs                                                                */
  /* ------------------------------------------------------------------ */
  let currentTab = "books";
  function switchTab(name) {
    currentTab = name;
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $$(".tabpane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
    if (name === "history") loadHistory();
  }
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("tab")) switchTab(e.target.dataset.tab);
  });

  /* ------------------------------------------------------------------ */
  /* Auth                                                                */
  /* ------------------------------------------------------------------ */
  function showAuth() {
    $("#authCover").classList.remove("hidden");
    $("#app").classList.add("hidden");
  }
  function showApp() {
    $("#authCover").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#userName").textContent = API.user?.first_name || API.user?.username || "—";
    if (API.user?.role === "admin") {
      $("#adminLink").classList.remove("hidden");
      $("#btnAddBook").classList.remove("hidden");
      $("#btnReindex").classList.remove("hidden");
    }
    initBooks();
    initAI();
    loadIndexStatus();
  }

  // Auth tab toggle
  $$("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      $$("[data-mode]").forEach((b) => b.classList.toggle("active", b === btn));
      $("#authLogin").classList.toggle("hidden", mode !== "login");
      $("#authRegister").classList.toggle("hidden", mode !== "register");
      $("#authMsg").textContent = "";
    });
  });

  $$("[data-goto]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const mode = a.dataset.goto;
      $$("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
      $("#authLogin").classList.toggle("hidden", mode !== "login");
      $("#authRegister").classList.toggle("hidden", mode !== "register");
      $("#authMsg").textContent = "";
    });
  });

  async function doLogin() {
    const u = $("#inLoginUser").value.trim();
    const p = $("#inLoginPass").value;
    if (!u || !p) return void ($("#authMsg").textContent = "Username va parolni kiriting");
    try {
      const r = await API.post("/api/auth/login", { username: u, password: p });
      API.token = r.token;
      API.user = r.user;
      showApp();
    } catch (e) {
      $("#authMsg").textContent = e.message;
    }
  }
  async function doRegister() {
    const first = $("#inRegFirst").value.trim();
    const last = $("#inRegLast").value.trim();
    const u = $("#inRegUser").value.trim();
    const p = $("#inRegPass").value;
    if (!u || !p) return void ($("#authMsg").textContent = "Username va parol kiriting");
    if (u.length < 3) return void ($("#authMsg").textContent = "Username kamida 3 ta belgi");
    if (p.length < 4) return void ($("#authMsg").textContent = "Parol kamida 4 ta belgi");
    try {
      const r = await API.post("/api/auth/register", { username: u, password: p, first_name: first, last_name: last });
      API.token = r.token;
      API.user = r.user;
      showApp();
      toast("Ro'yxatdan o'tildi — xush kelibsiz!");
    } catch (e) {
      $("#authMsg").textContent = e.message;
    }
  }
  $("#btnLogin").addEventListener("click", doLogin);
  $("#btnRegister").addEventListener("click", doRegister);
  $("#btnLogout").addEventListener("click", () => {
    API.post("/api/auth/logout").catch(() => {});
    API.token = "";
    API.user = null;
    location.reload();
  });
  window.addEventListener("auth:expired", () => {
    toast("Sessiya tugagan — qayta kiring");
    showAuth();
  });

  /* ------------------------------------------------------------------ */
  /* Subjects & Books                                                    */
  /* ------------------------------------------------------------------ */
  let subjects = [];
  let allBooks = [];
  let selectedSubject = null;

  async function initBooks() {
    if (!subjects.length) {
      try {
        subjects = await API.get("/api/subjects");
        allBooks = await API.get("/api/books");
      } catch {
        subjects = [];
        allBooks = [];
      }
    }
    renderSubjects();
    renderBooks();
  }

  function renderSubjects() {
    const el = $("#subjectList");
    const all = [{ id: null, name: "📚 Barchasi", n: allBooks.length }];
    const bySubject = {};
    for (const b of allBooks) {
      bySubject[b.subject_id] = (bySubject[b.subject_id] || 0) + 1;
    }
    for (const s of subjects) {
      const n = bySubject[s.id] || 0;
      if (n > 0) all.push({ id: s.id, name: s.name, n });
    }
    el.innerHTML = all
      .map(
        (s) =>
          `<button class="subj-btn${selectedSubject === s.id ? " active" : ""}" data-subj="${s.id || ""}">
            ${s.name} <span class="n">${s.n}</span>
          </button>`
      )
      .join("");
  }

  function renderBooks() {
    const list = selectedSubject
      ? allBooks.filter((b) => b.subject_id === selectedSubject)
      : allBooks;
    const el = $("#bookList");
    const title = selectedSubject
      ? subjects.find((s) => s.id === selectedSubject)?.name || "8-sinf kitoblar"
      : "8-sinf kitoblar";
    $("#subjectTitle").textContent = title;

    if (!list.length) {
      el.innerHTML =
        '<div class="empty">📭 Bu fanda kitob yo\'q. <button class="btn small primary open-modal" data-target="addBookModal">➕ Kitob qo\'shish</button></div>';
      return;
    }
    el.innerHTML = list
      .map(
        (b) =>
          `<div class="book-card">
            <div class="bc-head">
              <span class="bc-icon">${b.subject_name.split(" ")[0] || "📚"}</span>
              <div>
                <div class="bc-title">${esc(b.title)}</div>
                <div class="bc-meta">${esc(b.subject_name.split(" ").slice(1).join(" "))} ${b.year ? "· " + esc(b.year) : ""} · ${b.num_pages || "?"} sahifa</div>
                ${b.edition ? `<div class="bc-meta">Nashr: ${esc(b.edition)}</div>` : ""}
              </div>
            </div>
            <div class="bc-actions">
              <button class="btn primary small open-book" data-bid="${b.id}">📖 Ochish</button>
              ${
                b.indexed
                  ? '<span class="badge green">indekslangan</span>'
                  : '<button class="btn tiny ghost idx-book" data-bid="' + b.id + '">Indekslash</button>'
              }
            </div>
          </div>`
      )
      .join("");
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-subj]")) {
      const btn = e.target.closest("[data-subj]");
      selectedSubject = btn.dataset.subj || null;
      renderSubjects();
      renderBooks();
    }
    if (e.target.closest(".open-book")) {
      const bid = e.target.closest(".open-book").dataset.bid;
      openViewer(bid);
    }
    if (e.target.closest(".idx-book")) {
      const bid = e.target.closest(".idx-book").dataset.bid;
      reindexBook(bid);
    }
  });

  async function reindexBook(bid) {
    toast("Indekslanmoqda…");
    try {
      const r = await API.post("/api/books/" + bid + "/index");
      toast("Tayyor — sahifalar: " + (r.pages || "?") + ", chunk: " + (r.chunks || "?"));
      allBooks = await API.get("/api/books");
      renderBooks();
      loadIndexStatus();
    } catch (e) {
      toast("Xatolik: " + e.message);
    }
  }
  async function reindexAll() {
    toast("Barchasi qayta indekslanmoqda…");
    try {
      const r = await API.post("/api/books/reindex-all");
      toast("Tayyor: " + JSON.stringify(r.vector || {}));
      allBooks = await API.get("/api/books");
      renderBooks();
      loadIndexStatus();
    } catch (e) {
      toast("Xatolik: " + e.message);
    }
  }
  async function loadIndexStatus() {
    try {
      const r = await API.get("/api/index/status");
      const t = $("#indexInfo");
      t.textContent = `Indeks: ${r.chunks || 0} chunk · ${r.books || 0} kitob`;
    } catch {
      $("#indexInfo").textContent = "Indeks holati noma'lum";
    }
  }

  /* ------------------------------------------------------------------ */
  /* Add book modal                                                      */
  /* ------------------------------------------------------------------ */
  $$(".open-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.target;
      if (m) {
        const el = document.getElementById(m);
        if (el) el.classList.remove("hidden");
      }
    });
  });
  $$("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.close;
      if (m) {
        const el = document.getElementById(m);
        if (el) el.classList.add("hidden");
      }
    });
  });
  $$("[data-close]").forEach((btn) => {
    if (btn.classList.contains("modal-backdrop")) {
      btn.addEventListener("click", () => btn.closest(".modal")?.classList.add("hidden"));
    }
  });

  async function populateAddBookModal() {
    const sel = $("#fbSubject");
    if (!sel.options.length) {
      const subs = subjects.length ? subjects : await API.get("/api/subjects");
      if (!subs.length) {
        try {
          // no subjects yet from db
        } catch {}
      }
      // fallback subjects
      const defaultSubjects = [
        ["algebra", "Algebra"], ["geometriya", "Geometriya"], ["fizika", "Fizika"],
        ["kimyo", "Kimyo"], ["biologiya", "Biologiya"], ["ona-tili", "Ona tili"],
        ["adabiyot", "Adabiyot"], ["uzbekiston-tarixi", "O'zbekiston tarixi"],
        ["jahon-tarixi", "Jahon tarixi"], ["ingliz-tili", "Ingliz tili"],
        ["rus-tili", "Rus tili"], ["geografiya", "Geografiya"],
        ["informatika", "Informatika"], ["texnologiya", "Texnologiya"],
      ];
      const all = subs.length ? subs : defaultSubjects.map(([id, name]) => ({ id, name: name }));
      sel.innerHTML = all.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    }
  }

  $("#btnAddBook").addEventListener("click", async () => {
    await populateAddBookModal();
    $("#addBookModal").classList.remove("hidden");
  });

  // drag-drop
  $("#dropZone").addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add("dragover");
  });
  $("#dropZone").addEventListener("dragleave", (e) => {
    e.currentTarget.classList.remove("dragover");
  });
  $("#dropZone").addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("dragover");
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".pdf")) {
      $("#pdfFile").files = e.dataTransfer.files;
      $("#dropText").textContent = f.name;
    } else {
      toast("Faqat PDF fayllar qabul qilinadi");
    }
  });
  $("#pdfFile").addEventListener("change", () => {
    const f = $("#pdfFile").files[0];
    if (f) $("#dropText").textContent = f.name;
  });

  $("#addBookForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = $("#pdfFile").files[0];
    if (!f) return toast("PDF fayl tanlang");
    const fd = new FormData();
    fd.append("file", f);
    fd.append("subject_id", $("#fbSubject").value);
    fd.append("title", $("#fbTitle").value);
    fd.append("author", $("#fbAuthor").value);
    fd.append("edition", $("#fbEdition").value);
    fd.append("publisher", $("#fbPublisher").value);
    fd.append("year", $("#fbYear").value);
    fd.append("language", "uz");
    fd.append("auto_index", "1");
    try {
      const r = await API.upload("/api/books/add", fd);
      toast("Kitob qo'shildi — sahifalar: " + (r.pages || "?") + ", chunk: " + (r.chunks || "?"));
      $("#addBookModal").classList.add("hidden");
      $("#addBookForm").reset();
      $("#dropText").textContent = "📄 PDF faylni tanlang yoki shu yerga tashlang";
      allBooks = await API.get("/api/books");
      renderSubjects();
      renderBooks();
      loadIndexStatus();
    } catch (err) {
      toast("Xatolik: " + err.message);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Viewer                                                              */
  /* ------------------------------------------------------------------ */
  function openViewer(bid, page) {
    switchTab("books");
    const b = allBooks.find((x) => x.id === bid);
    if (!b) return;
    Viewer.open(b, page);
  }

  /* ------------------------------------------------------------------ */
  /* AI                                                                  */
  /* ------------------------------------------------------------------ */
  let aiPending = false;

  function initAI() {}

  async function solve() {
    if (aiPending) return;
    const q = $("#aiQuestion").value.trim();
    if (!q) return toast("Savolni yozing");
    aiPending = true;
    $("#btnSolve").disabled = true;
    $("#aiStatus").textContent = "AI ishlamoqda…";
    $("#aiStatus").classList.remove("hidden");
    $("#answerArea").innerHTML = '<div class="answer-empty"><div class="spinner"></div><p>Javob tayyorlanmoqda…</p></div>';
    try {
      const r = await API.post("/api/ai/solve", { question: q });
      renderAnswer(r.result, r.message_id);
      loadHistory();
    } catch (e) {
      $("#answerArea").innerHTML = `<div class="answer-error">❌ ${esc(e.message)}</div>`;
      $("#aiStatus").textContent = "";
    } finally {
      aiPending = false;
      $("#btnSolve").disabled = false;
    }
  }

  function renderAnswer(r, mid) {
    if (!r) return;
    const statusClasses = { ok: "success", blocked: "blocked", clarify: "clarify", no_llm: "no-llm", error: "error" };
    const statusText = {
      ok: "✅ Yechim tayyor",
      blocked: "⚠️ Cheklov",
      clarify: "ℹ️ Aniqlashtiring",
      no_llm: "⚠️ AI sozlanmagan",
      error: "❌ Xatolik",
    };
    let html = `<div class="answer-card ${statusClasses[r.status] || ""}">
      <div class="ans-status">${statusText[r.status] || ""} — ${esc(r.message || "")}</div>`;
    if (r.sections) {
      for (const s of r.sections) {
        html += `<div class="ans-section">
          <div class="sec-label">${esc(s.label)}</div>
          <div class="sec-text">${esc(s.text)}</div>
        </div>`;
      }
    }
    if (r.message && !r.sections) {
      html += `<div class="ans-text">${esc(r.message)}</div>`;
    }
    // Manba
    const m = r.manba || {};
    if (m.book_id) {
      const manbaParts = [m.title, m.author, m.year ? m.year + "-yil" : "", m.printed_page ? m.printed_page + "-bet" : ""];
      html += `<div class="ans-manba">
        <strong>Manba:</strong> ${manbaParts.filter(Boolean).map(esc).join(" · ")}
        ${m.has_pdf ? `<button class="btn tiny primary open-page" data-bid="${m.book_id}" data-page="${m.printed_page}">📖 Sahifani ochish</button>` : ""}
      </div>`;
    }
    // Harakatlar tugmalari
    html += `<div class="ans-actions">
      <button class="btn tiny primary save-msg" data-mid="${mid}">⭐ Saqlash</button>
      <button class="btn tiny ghost share-msg" data-mid="${mid}">🔗 Ulashish</button>
    </div>`;
    html += `</div>`;
    $("#answerArea").innerHTML = html;
    $("#aiStatus").textContent = "";
  }

  document.addEventListener("click", async (e) => {
    if (e.target.closest(".save-msg")) {
      const mid = e.target.closest(".save-msg").dataset.mid;
      try {
        await API.post("/api/ai/save/" + mid);
        toast("Saqlandi!");
      } catch (err) {
        toast(err.message);
      }
    }
    if (e.target.closest(".share-msg")) {
      const mid = e.target.closest(".share-msg").dataset.mid;
      try {
        const r = await API.post("/api/ai/share/" + mid);
        const url = r.url || "";
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          toast("Havola nusxalandi: " + url);
        } else {
          prompt("Ulashish havolasi:", url);
        }
      } catch (err) {
        toast(err.message);
      }
    }
    if (e.target.closest(".open-page")) {
      const btn = e.target.closest(".open-page");
      openViewer(btn.dataset.bid, parseInt(btn.dataset.page) || undefined);
    }
  });

  $("#btnSolve").addEventListener("click", solve);
  $("#btnClearAnswer").addEventListener("click", () => {
    $("#aiQuestion").value = "";
    $("#answerArea").innerHTML = '<div class="answer-empty"><div class="ae-icon">🧠</div><p>AI yechim kutilmoqda…</p></div>';
    $("#aiStatus").textContent = "";
  });
  $$("[data-q]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("#aiQuestion").value = btn.dataset.q;
    });
  });

  /* ------------------------------------------------------------------ */
  /* Tarix                                                               */
  /* ------------------------------------------------------------------ */
  async function loadHistory() {
    try {
      const [hist, saved] = await Promise.all([API.get("/api/ai/history"), API.get("/api/ai/saved")]);
      renderHistory(hist);
      renderSaved(saved);
    } catch {
      // ignore
    }
  }

  function renderHistory(rows) {
    const el = $("#historyList");
    if (!rows.length) {
      el.innerHTML = '<div class="empty">Hali savollar yo\'q.</div>';
      return;
    }
    el.innerHTML = rows
      .map(
        (r) =>
          `<div class="hist-item" data-mid="${r.id}">
            <span class="hist-q">${esc(r.question)}</span>
            <span class="hist-date">${r.created_at || ""}</span>
          </div>`
      )
      .join("");
  }

  function renderSaved(rows) {
    const el = $("#savedList");
    if (!rows.length) {
      el.innerHTML = '<div class="empty">Hali saqlangan yechim yo\'q.</div>';
      return;
    }
    el.innerHTML = rows
      .map((r) => {
        let q = "";
        try {
          const s = r.source || {};
          q = r.question || "";
        } catch {
          q = r.question || "";
        }
        return `<div class="hist-item saved-item" data-sid="${r.id}">
          <span class="hist-q">⭐ ${esc(r.question)}</span>
          <span class="hist-date">${r.created_at || ""}</span>
        </div>`;
      })
      .join("");
  }

  document.addEventListener("click", async (e) => {
    if (e.target.closest(".hist-item")) {
      const el = e.target.closest(".hist-item");
      const mid = el.dataset.mid;
      const sid = el.dataset.sid;
      if (mid) {
        try {
          const r = await API.get("/api/ai/history/" + mid);
          showSavedDetail(r);
        } catch (err) {
          toast(err.message);
        }
      } else if (sid) {
        try {
          const r = await API.get("/api/ai/saved/" + sid);
          showSavedDetail(r);
        } catch (err) {
          toast(err.message);
        }
      }
    }
  });

  function showSavedDetail(r) {
    const el = $("#savedDetail");
    if (!el) return;
    const sections = (r.answer && r.answer.sections) || [];
    let html = `<div class="answer-card success">
      <div class="sec-label">Savol</div>
      <div class="sec-text">${esc(r.question)}</div>`;
    for (const s of sections) {
      html += `<div class="ans-section"><div class="sec-label">${esc(s.label)}</div><div class="sec-text">${esc(s.text)}</div></div>`;
    }
    const m = (r.answer && r.answer.manba) || r.source || {};
    if (m && m.book_id) {
      const parts = [m.title, m.author, m.year ? m.year + "-yil" : "", m.printed_page ? m.printed_page + "-bet" : ""];
      html += `<div class="ans-manba"><strong>Manba:</strong> ${parts.filter(Boolean).map(esc).join(" · ")}</div>`;
    }
    if (r.answer && r.answer.message) {
      html += `<div class="ans-text">${esc(r.answer.message)}</div>`;
    }
    if (r.id) {
      html += `<div class="ans-actions">
        <button class="btn tiny ghost del-saved" data-id="${r.id}">🗑 O'chirish</button>
      </div>`;
    }
    html += `</div>`;
    el.innerHTML = html;
  }

  document.addEventListener("click", async (e) => {
    if (e.target.closest(".del-saved")) {
      const sid = e.target.closest(".del-saved").dataset.id;
      if (!confirm("Haqiqatan o'chirmoqchimisiz?")) return;
      try {
        await API.del("/api/ai/saved/" + sid);
        toast("O'chirildi");
        loadHistory();
        $("#savedDetail").innerHTML = "";
      } catch (err) {
        toast(err.message);
      }
    }
  });

  /* ------------------------------------------------------------------ */
  /* init                                                                */
  /* ------------------------------------------------------------------ */
  function esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // AI badge
  async function loadAIBadge() {
    try {
      const r = await API.get("/api/ai/status");
      const el = $("#aiBadge");
      el.textContent = r.configured ? `AI: ${r.model}` : "AI: o'chirilgan";
      el.title = r.note || "";
      el.classList.toggle("ai-off", !r.configured);
    } catch {}
  }

  function init() {
    if (API.token && API.user) {
      showApp();
    } else {
      showAuth();
    }
    loadAIBadge();
  }
  init();
})();