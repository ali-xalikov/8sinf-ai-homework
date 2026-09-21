/* ======================================================================
   8-sinf AI Homework — PDF ko'rgich (bookviewer.js)
   ====================================================================== */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const Viewer = {
    book: null,
    page: 1,
    total: 0,
    scale: 1.5,
    offset: 0,
    _fetchId: 0,

    async open(book, page) {
      this.book = book;
      this.offset = book.page_offset || 0;
      try {
        const info = await API.get(`/api/books/${book.id}/info`);
        this.total = info.num_pages || 0;
      } catch {
        this.total = book.num_pages || 0;
      }
      // sahifani aniqlash: pdf yoki bosma rakam
      if (page) {
        if (page <= this.total) this.page = page;
        else {
          try {
            const r = await API.get(`/api/books/${book.id}/print/${page}`);
            this.page = r.page_pdf;
          } catch {
            this.page = 1;
          }
        }
      } else {
        this.page = 1;
      }
      $("#pageTotal").textContent = this.total;
      $("#pageInput").max = this.total;
      $("#viewerTitle").textContent = book.title;
      $("#viewerEdition").textContent = [book.edition, book.year].filter(Boolean).join(" · ");
      $("#offsetInput").value = this.offset;
      this._readOnlyOffset();

      const v = $("#viewer");
      v.classList.remove("hidden");
      this.render();
      // kitoblar gridni yopish
      $$("#bookList .book-grid").length > 0;
      window.open_viewer_cleanup = true;
    },

    close() {
      $("#viewer").classList.add("hidden");
      $("#textPanel").classList.add("hidden");
    },

    _readOnlyOffset() {
      const off = $("#offsetInput");
      if (API.user && API.user.role === "admin") {
        off.disabled = false;
      } else {
        off.disabled = true;
        off.title = "Sahifa farqini faqat administrator o'zgartira oladi";
      }
    },

    async render() {
      if (!this.book) return;
      const id = ++this._fetchId;
      const img = $("#pageImg");
      const load = $("#pageLoading");
      load.hidden = false;
      const scale = this.scale;
      img.onload = () => {
        if (id === this._fetchId) load.hidden = true;
      };
      img.onerror = () => {
        if (id === this._fetchId) {
          load.textContent = "Sahifa yuklanmadi";
          load.hidden = false;
        }
      };
      img.src = `/api/books/${this.book.id}/pages/${this.page}/render?scale=${scale}&_=${Date.now()}`;
      $("#pageInput").value = this.page;
      const printed = this.page + this.offset;
      $("#printedBadge").textContent = "bet " + printed;
      this._loadTextPreview();
    },

    async _loadTextPreview() {
      const panel = $("#textPanel");
      const pre = $("#pageTextPre");
      if (panel.classList.contains("hidden") || !this.book) return;
      try {
        const r = await API.get(`/api/books/${this.book.id}/pages/${this.page}/text`);
        const q = $("#viewerSearch").value.trim().toLowerCase();
        pre.textContent = r.text || "(matn yo'q)";
        if (q) this._highlight(pre, r.text || "", q);
      } catch {
        pre.textContent = "(matn o'qib bo'lmadi)";
      }
    },

    _highlight(pre, text, q) {
      const i = text.toLowerCase().indexOf(q);
      if (i < 0) return;
      const start = Math.max(0, i - 200);
      const end = Math.min(text.length, i + q.length + 400);
      pre.textContent = text.slice(start, end);
    },

    next() {
      if (this.page < this.total) {
        this.page += 1;
        this.render();
      }
    },
    prev() {
      if (this.page > 1) {
        this.page -= 1;
        this.render();
      }
    },
    goto(n) {
      n = parseInt(n, 10) || 1;
      n = Math.max(1, Math.min(this.total || n, n));
      this.page = n;
      this.render();
    },
    zoom(delta) {
      this.scale = Math.max(0.4, Math.min(4, this.scale + delta));
      this.render();
    },
    fit() {
      this.scale = 1.2;
      this.render();
    },

    async searchBook(q) {
      const box = $("#searchResults");
      if (!q.trim()) {
        box.classList.add("hidden");
        return;
      }
      try {
        const r = await API.get(`/api/books/${this.book.id}/search?q=${encodeURIComponent(q)}`);
        if (!r.length) {
          box.innerHTML = '<div class="sr-none">Hech narsa topilmadi</div>';
        } else {
          box.innerHTML = r
            .map(
              (x) =>
                `<div class="sr-item" data-page="${x.page_no}">
                  <span class="sr-pg">${x.printed_page}-bet</span>
                  <span class="sr-snip">${esc(x.snippet)}</span>
                </div>`
            )
            .join("");
        }
        box.classList.remove("hidden");
        $$(".sr-item", box).forEach((el) => {
          el.addEventListener("click", () => {
            this.goto(parseInt(el.dataset.page, 10));
            box.classList.add("hidden");
          });
        });
      } catch {
        box.innerHTML = "<div class='sr-none'>Qidiruv xatosi</div>";
      }
    },
  };

  function esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---- toolbars ---- */
  $("#btnCloseViewer")?.addEventListener("click", () => Viewer.close());
  $("#btnNext")?.addEventListener("click", () => Viewer.next());
  $("#btnPrev")?.addEventListener("click", () => Viewer.prev());
  $("#pageInput")?.addEventListener("change", (e) => Viewer.goto(e.target.value));
  $("#pageInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") Viewer.goto(e.target.value);
  });
  $("#btnZin")?.addEventListener("click", () => Viewer.zoom(0.25));
  $("#btnZout")?.addEventListener("click", () => Viewer.zoom(-0.25));
  $("#btnFit")?.addEventListener("click", () => Viewer.fit());
  $("#btnText")?.addEventListener("click", () => {
    const p = $("#textPanel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) Viewer._loadTextPreview();
  });
  $("#btnCopyText")?.addEventListener("click", async () => {
    const t = $("#pageTextPre").textContent || "";
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(t);
      alert("Nusxalandi");
    } else {
      prompt("Nusxa:", t);
    }
  });
  $("#btnSearchBook")?.addEventListener("click", () =>
    Viewer.searchBook($("#viewerSearch").value)
  );
  $("#viewerSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") Viewer.searchBook(e.target.value);
  });
  $("#offsetInput")?.addEventListener("change", async (e) => {
    const off = parseInt(e.target.value, 10) || 0;
    if (isNaN(off)) return;
    try {
      const r = await API.request("POST", `/api/books/${Viewer.book.id}/offset?offset=${off}`);
      Viewer.offset = off;
      toast_effekt("Ofset saqlandi");
      Viewer.render();
    } catch (err) {
      toast_effekt("Xatolik: " + err.message);
      e.target.value = Viewer.offset;
    }
  });
  document.addEventListener("keydown", (e) => {
    if ($("#viewer").classList.contains("hidden")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight") Viewer.next();
    if (e.key === "ArrowLeft") Viewer.prev();
  });

  function toast_effekt(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 2000);
  }

  window.Viewer = Viewer;
})();