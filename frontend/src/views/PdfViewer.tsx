import { useEffect, useRef, useState } from "react";

import { api } from "../api";
import { navigate } from "../router";
import { useToast } from "../components/Toast";

import type { Book, SearchHit } from "../types";

interface Props {
  bid: string;
  pageParam?: string;
}

const renderUrl = (bid: string, page: number, scale: number) =>
  `/api/books/${encodeURIComponent(bid)}/pages/${page}/render?scale=${scale}&_=${Date.now()}`;

export function PdfViewer({ bid, pageParam }: Props) {
  const toast = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [scale, setScale] = useState(1.5);

  const [imgSrc, setImgSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showText, setShowText] = useState(false);
  const [pageText, setPageText] = useState("");

  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);

  const requestId = useRef(0);

  /*
   * 1. Kitob ma'lumotlarini yuklash
   */
  useEffect(() => {
    let cancelled = false;

    async function loadBook() {
      try {
        setLoading(true);
        setError("");

        const data = await api.bookInfo(bid);

        if (cancelled) return;

        setBook(data);

        const pages = Number(data.num_pages || 0);

        if (pages <= 0) {
          setError("Kitob sahifalari topilmadi.");
          setLoading(false);
          return;
        }

        setTotal(pages);

        /*
         * URL'dagi page parametrini aniqlash
         */
        let requestedPage = Number(pageParam);

        if (!Number.isFinite(requestedPage) || requestedPage < 1) {
          requestedPage = 1;
        }

        /*
         * Agar pageParam PDF sahifasidan katta bo'lsa,
         * printed page orqali PDF page topiladi.
         */
        if (requestedPage <= pages) {
          setPage(requestedPage);
        } else {
          try {
            const resolved = await api.resolvePrinted(bid, requestedPage);

            if (!cancelled) {
              const resolvedPage = Number(resolved.page_pdf || 1);

              setPage(
                Math.max(
                  1,
                  Math.min(pages, resolvedPage)
                )
              );
            }
          } catch {
            if (!cancelled) {
              setPage(1);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          const message =
            err?.message || "Kitobni yuklashda xatolik yuz berdi.";

          setError(message);
          toast(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBook();

    return () => {
      cancelled = true;
    };
  }, [bid, pageParam]);

  /*
   * 2. PDF sahifasini rasm sifatida yuklash
   */
  useEffect(() => {
    if (!book || total <= 0) return;

    const currentRequest = ++requestId.current;

    setLoading(true);
    setError("");
    setImgSrc("");

    const src = renderUrl(
      bid,
      Math.max(1, Math.min(total, page)),
      scale
    );

    const img = new Image();

    img.onload = () => {
      if (currentRequest !== requestId.current) return;

      setImgSrc(src);
      setLoading(false);
      setError("");
    };

    img.onerror = () => {
      if (currentRequest !== requestId.current) return;

      setLoading(false);
      setImgSrc("");
      setError("PDF sahifasini yuklab bo‘lmadi.");

      toast(
        `Sahifa yuklanmadi. API endpointni tekshiring: /api/books/${bid}/pages/${page}/render`
      );
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [bid, book, total, page, scale]);

  /*
   * 3. Sahifa matnini yuklash
   */
  useEffect(() => {
    if (!showText || !book || total <= 0) {
      setPageText("");
      return;
    }

    let cancelled = false;

    setPageText("Yuklanmoqda…");

    api
      .pageText(bid, page)
      .then((result) => {
        if (cancelled) return;

        setPageText(
          result?.text?.trim()
            ? result.text
            : "(Bu sahifada matn topilmadi)"
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPageText("(Matnni o‘qib bo‘lmadi)");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bid, page, showText, book, total]);

  /*
   * Sahifaga o'tish
   */
  const goto = (value: number) => {
    if (!total) return;

    if (!Number.isFinite(value)) return;

    const next = Math.max(
      1,
      Math.min(total, Math.round(value))
    );

    setPage(next);
  };

  /*
   * Search
   */
  const doSearch = async () => {
    const query = searchQ.trim();

    if (!query) {
      setResults(null);
      return;
    }

    try {
      const data = await api.searchBook(
        bid,
        query,
        20
      );

      setResults(data || []);
    } catch {
      setResults([]);
      toast("Qidirishda xatolik yuz berdi.");
    }
  };

  /*
   * Kitob hali yuklanmagan
   */
  if (!book && loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <div style={{ marginTop: 10 }}>
          Kitob yuklanmoqda…
        </div>
      </div>
    );
  }

  /*
   * Kitob yuklanmadi
   */
  if (!book) {
    return (
      <div className="card">
        <div className="empty">
          {error || "Kitob topilmadi."}
        </div>

        <button
          className="btn ghost"
          onClick={() => navigate("/books")}
          style={{ marginTop: 12 }}
        >
          ← Kitoblar
        </button>
      </div>
    );
  }

  const printed =
    page + Number(book.page_offset || 0);

  return (
    <div>
      {/* Header */}
      <div
        className="row"
        style={{ marginBottom: 14 }}
      >
        <button
          className="btn ghost"
          onClick={() => navigate("/books")}
        >
          ← Kitoblar
        </button>

        <div>
          <strong>{book.title}</strong>

          <span
            className="hint"
            style={{ display: "block" }}
          >
            {[book.author, book.year]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>

      <div className="viewer">
        {/* Toolbar */}
        <div className="viewer-toolbar">
          {/* Page controls */}
          <div className="v-controls">
            <button
              className="v-btn"
              onClick={() => goto(page - 1)}
              disabled={page <= 1 || loading}
            >
              ◀
            </button>

            <input
              className="input-num"
              type="number"
              min={1}
              max={total || 1}
              value={page}
              onChange={(e) => {
                const value = Number(e.target.value);

                if (Number.isFinite(value)) {
                  goto(value);
                }
              }}
            />

            <span>/ {total}</span>

            <button
              className="v-btn"
              onClick={() => goto(page + 1)}
              disabled={
                page >= total ||
                total <= 0 ||
                loading
              }
            >
              ▶
            </button>

            <span className="printed-badge">
              bet {printed}
            </span>
          </div>

          {/* Zoom */}
          <div className="v-controls">
            <button
              className="v-btn"
              onClick={() =>
                setScale((value) =>
                  Math.max(0.5, value - 0.25)
                )
              }
              title="Kichraytirish"
            >
              −
            </button>

            <span
              className="hint"
              style={{
                minWidth: 45,
                textAlign: "center",
              }}
            >
              {Math.round(scale * 100)}%
            </span>

            <button
              className="v-btn"
              onClick={() =>
                setScale((value) =>
                  Math.min(4, value + 0.25)
                )
              }
              title="Kattalashtirish"
            >
              +
            </button>

            <button
              className="v-btn"
              onClick={() => setScale(1.5)}
              title="Standart"
            >
              100%
            </button>

            <button
              className={
                showText
                  ? "v-btn printed-badge"
                  : "v-btn"
              }
              onClick={() =>
                setShowText((value) => !value)
              }
              title="Matn paneli"
            >
              📄
            </button>
          </div>

          {/* Search */}
          <div className="v-controls">
            <input
              className="input"
              style={{
                width: 180,
                padding: "6px 10px",
              }}
              placeholder="Matnni qidirish…"
              value={searchQ}
              onChange={(e) =>
                setSearchQ(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  doSearch();
                }
              }}
            />

            <button
              className="v-btn"
              onClick={doSearch}
            >
              🔍
            </button>
          </div>
        </div>

        {/* Search results */}
        {results !== null && (
          <div
            className="card"
            style={{ margin: "10px 12px" }}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
              }}
            >
              <strong>
                {results.length} ta natija
              </strong>

              <button
                className="v-btn"
                onClick={() => setResults(null)}
              >
                ✕
              </button>
            </div>

            {results.length === 0 ? (
              <div className="empty">
                Hech narsa topilmadi
              </div>
            ) : (
              <div
                className="hist-list"
                style={{ marginTop: 8 }}
              >
                {results.map((result) => (
                  <div
                    key={`${result.page_no}-${result.printed_page}`}
                    className="hist-item"
                    onClick={() => {
                      const target = Number(
                        result.page_no
                      );

                      if (
                        Number.isFinite(target) &&
                        target >= 1
                      ) {
                        goto(target);
                      }

                      setResults(null);
                    }}
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <span className="sr-pg">
                      {result.printed_page}-bet
                    </span>

                    <span className="hist-q">
                      {result.snippet}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PDF page */}
        <div className="viewer-body">
          {loading && (
            <div className="page-loading">
              <div className="spinner" />
              <div style={{ marginTop: 10 }}>
                Sahifa yuklanmoqda…
              </div>
            </div>
          )}

          {!loading && error && (
            <div
              className="empty"
              style={{
                padding: 40,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  marginBottom: 12,
                }}
              >
                ⚠️
              </div>

              <strong>
                PDF sahifasini ochib bo‘lmadi
              </strong>

              <div
                className="hint"
                style={{
                  marginTop: 8,
                }}
              >
                {error}
              </div>

              <button
                className="btn"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setError("");
                  setLoading(true);

                  const current =
                    ++requestId.current;

                  const src = renderUrl(
                    bid,
                    page,
                    scale
                  );

                  const img = new Image();

                  img.onload = () => {
                    if (
                      current !== requestId.current
                    ) {
                      return;
                    }

                    setImgSrc(src);
                    setLoading(false);
                  };

                  img.onerror = () => {
                    if (
                      current !== requestId.current
                    ) {
                      return;
                    }

                    setLoading(false);
                    setError(
                      "PDF sahifasi yana yuklanmadi."
                    );
                  };

                  img.src = src;
                }}
              >
                Qayta urinish
              </button>
            </div>
          )}

          {!loading && !error && imgSrc && (
            <img
              className="page-img"
              src={imgSrc}
              alt={`${page}-sahifa`}
              draggable={false}
            />
          )}
        </div>

        {/* Page text */}
        {showText && (
          <div
            className="viewer-body"
            style={{
              background: "#fff",
              display: "block",
            }}
          >
            <div
              className="sec-label"
              style={{ marginBottom: 8 }}
            >
              📄 Sahifa matni
            </div>

            <pre
              className="sec-text"
              style={{
                whiteSpace: "pre-wrap",
                background: "#f8fafc",
                padding: 16,
                borderRadius: 10,
                overflowX: "auto",
              }}
            >
              {pageText || "Yuklanmoqda…"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
