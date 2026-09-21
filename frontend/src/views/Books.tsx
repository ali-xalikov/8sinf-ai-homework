import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { navigate } from "../router";
import { useApp } from "../store";
import { useToast } from "../components/Toast";
import { Modal } from "../components/Modal";
import type { Book, Subject } from "../types";

const DEFAULT_SUBJECTS: [string, string][] = [
  ["algebra", "Algebra"],
  ["geometriya", "Geometriya"],
  ["fizika", "Fizika"],
  ["kimyo", "Kimyo"],
  ["biologiya", "Biologiya"],
  ["ona-tili", "Ona tili"],
  ["adabiyot", "Adabiyot"],
  ["uzbekiston-tarixi", "O‘zbekiston tarixi"],
  ["jahon-tarixi", "Jahon tarixi"],
  ["ingliz-tili", "Ingliz tili"],
  ["rus-tili", "Rus tili"],
  ["geografiya", "Geografiya"],
  ["informatika", "Informatika"],
  ["texnologiya", "Texnologiya"],
  ["chizmachilik", "Chizmachilik"],
];

export function Books() {
  const { user } = useApp();
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // add form
  const [file, setFile] = useState<File | null>(null);
  const [fSubject, setFSubject] = useState("algebra");
  const [fTitle, setFTitle] = useState("");
  const [fAuthor, setFAuthor] = useState("");
  const [fPublisher, setFPublisher] = useState("");
  const [fYear, setFYear] = useState("");

  const isAdmin = user?.role === "admin";

  const load = useCallback(
    async (subjectId: string | null | undefined) => {
      setLoading(true);
      try {
        const subj = subjects.length ? subjects : await api.subjects();
        if (!subjects.length) setSubjects(subj);
        const bks = await api.books(subjectId);
        setBooks(bks);
      } catch (e: any) {
        toast(e.message);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjects],
  );

  useEffect(() => {
    load(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const addBook = async () => {
    if (!file) return toast("PDF fayl tanlang");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject_id", fSubject);
    fd.append("title", fTitle);
    fd.append("author", fAuthor);
    fd.append("publisher", fPublisher);
    fd.append("year", fYear);
    fd.append("language", "uz");
    fd.append("auto_index", "1");
    try {
      const r = await api.addBook(fd);
      toast(`Kitob qo‘shildi — ${r.pages ?? "?"} sahifa`);
      setShowAdd(false);
      setFile(null);
      setFTitle("");
      setFAuthor("");
      setFPublisher("");
      setFYear("");
      setSubjects((await api.subjects()));
      setBooks(await api.books(selected));
    } catch (e: any) {
      toast(e.message);
    }
  };

  const reindexBook = async (bid: string) => {
    toast("Indekslanmoqda…");
    try {
      const r = await api.reindexBook(bid);
      toast(`Tayyor — sahifalar: ${r.pages ?? "?"}, chunk: ${r.chunks ?? "?"}`);
      setBooks(await api.books(selected));
    } catch (e: any) {
      toast(e.message);
    }
  };

  const deleteBook = async (bid: string) => {
    if (!confirm("Haqiqatan o‘chirmoqchimisiz?")) return;
    try {
      await api.deleteBook(bid);
      toast("O‘chirildi");
      setBooks(await api.books(selected));
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <div>
      <h2 className="section-title">8-sinf darsliklari</h2>
      <p className="section-sub">Kitobni tanlang va oching</p>

      <div className="subject-chips">
        <button
          className={`subject-chip ${selected === undefined ? "active" : ""}`}
          onClick={() => setSelected(undefined)}
        >
          📚 Barchasi
        </button>
        {subjects.map(s => (
          <button
            key={s.id}
            className={`subject-chip ${selected === s.id ? "active" : ""}`}
            onClick={() => setSelected(s.id)}
          >
            {s.name} <span className="hint">({s.n})</span>
          </button>
        ))}
      </div>

      {isAdmin && (
        <button className="btn primary small" style={{ marginBottom: 14 }} onClick={() => setShowAdd(true)}>
          ➕ Kitob qo‘shish
        </button>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : books.length === 0 ? (
        <div className="empty">
          📭 Bu fanda kitob yo‘q.
          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <button className="btn small primary" onClick={() => setShowAdd(true)}>➕ Kitob qo‘shish</button>
            </div>
          )}
        </div>
      ) : (
        <div className="book-grid">
          {books.map(b => (
            <div key={b.id} className="book-card">
              <div className="bc-head">
                <span className="bc-icon">📘</span>
                <div>
                  <div className="bc-title">{b.title}</div>
                  <div className="bc-meta">
                    {b.subject_name} {b.year ? "· " + b.year : ""} · {b.num_pages || "?"} sahifa
                  </div>
                  {b.edition && <div className="bc-meta">Nashr: {b.edition}</div>}
                </div>
              </div>
              <div className="bc-actions">
                <button className="btn small primary" onClick={() => navigate(`/book/${b.id}`)}>
                  📖 Ochish
                </button>
                {b.indexed ? (
                  <span className="badge green">indekslangan</span>
                ) : (
                  <button className="btn tiny ghost" onClick={() => reindexBook(b.id)}>Indekslash</button>
                )}
                {isAdmin && (
                  <button className="btn tiny ghost" title="O‘chirish" onClick={() => deleteBook(b.id)}>🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="➕ 8-sinf kitob qo‘shish (admin)">
        <label style={{ display: "flex", flexDirection: "column", gap: 8, border: "2px dashed var(--border)", borderRadius: 12, padding: 18, textAlign: "center", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}>
          <input
            type="file"
            accept=".pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
            id="pdfFileInput"
          />
          📄 {file ? file.name : "PDF faylni tanlang"}
        </label>

        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Fan</label>
            <select className="input" value={fSubject} onChange={e => setFSubject(e.target.value)}>
              {DEFAULT_SUBJECTS.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Yil</label>
            <input className="input" value={fYear} onChange={e => setFYear(e.target.value)} placeholder="2022" />
          </div>
        </div>
        <div className="field">
          <label>Kitob nomi</label>
          <input className="input" value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Algebra – 8-sinf" />
        </div>
        <div className="field">
          <label>Muallif</label>
          <input className="input" value={fAuthor} onChange={e => setFAuthor(e.target.value)} placeholder="A. Bobomurodov, …" />
        </div>
        <div className="field">
          <label>Nashriyot</label>
          <input className="input" value={fPublisher} onChange={e => setFPublisher(e.target.value)} placeholder="Respublika ta'lim markazi" />
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setShowAdd(false)}>Bekor</button>
          <button className="btn primary" onClick={addBook} disabled={!file}>Qo‘shish</button>
        </div>
      </Modal>
    </div>
  );
}