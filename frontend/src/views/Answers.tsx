import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../store";
import { useToast } from "../components/Toast";
import { Modal } from "../components/Modal";
import type { Answer, AnswerKind, AnswerPayload } from "../types";

const SUBJECTS: [string, string][] = [
  ["", "Barcha fanlar"],
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

const KINDS: { id: AnswerKind | ""; label: string; icon: string }[] = [
  { id: "", label: "Hammasi", icon: "🗂" },
  { id: "bsb", label: "BSB", icon: "📘" },
  { id: "chsb", label: "ChSB", icon: "📗" },
  { id: "other", label: "Boshqa", icon: "📄" },
];

const KIND_LABEL: Record<string, string> = { bsb: "BSB", chsb: "ChSB", other: "Boshqa" };

const EMPTY: AnswerPayload = { subject_id: "", kind: "bsb", title: "", content: "" };

export function Answers() {
  const { user } = useApp();
  const toast = useToast();
  const isAdmin = user?.role === "admin";

  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<AnswerKind | "">("");
  const [subject, setSubject] = useState("");

  const [viewing, setViewing] = useState<Answer | null>(null);
  const [editing, setEditing] = useState<Answer | "new" | null>(null);
  const [form, setForm] = useState<AnswerPayload>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAnswers(await api.answers(subject || null, kind || null));
    } catch (e: any) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm({ ...EMPTY, subject_id: subject || "algebra" });
    setEditing("new");
  };

  const openEdit = (a: Answer) => {
    setForm({ subject_id: a.subject_id, kind: a.kind, title: a.title, content: a.content });
    setEditing(a);
  };

  const save = async () => {
    if (!form.title.trim()) return toast("Sarlavhani yozing");
    setSaving(true);
    try {
      if (editing && editing !== "new") {
        await api.updateAnswer(editing.id, form);
        toast("Yangilandi");
      } else {
        await api.createAnswer(form);
        toast("Qo‘shildi");
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Answer) => {
    if (!confirm("O‘chirmoqchimisiz?")) return;
    try {
      await api.deleteAnswer(a.id);
      toast("O‘chirildi");
      setViewing(null);
      await load();
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <div>
      <div className="answers-head">
        <div>
          <h2 className="section-title">📋 BSB / ChSB javoblar</h2>
          <p className="section-sub">Nazorat va chorak ishlari uchun tayyor javoblar</p>
        </div>
        {isAdmin && (
          <button className="btn primary" onClick={openNew}>
            ➕ Javob qo‘shish
          </button>
        )}
      </div>

      <div className="answers-filters">
        <div className="subject-chips">
          {KINDS.map(k => (
            <button
              key={k.id || "all"}
              className={`subject-chip ${kind === k.id ? "active" : ""}`}
              onClick={() => setKind(k.id)}
            >
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <select className="input answers-select" value={subject} onChange={e => setSubject(e.target.value)}>
          {SUBJECTS.map(([id, name]) => (
            <option key={id || "all"} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : answers.length === 0 ? (
        <div className="empty">
          📭 Hozircha javob qo‘shilmagan.
          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <button className="btn small primary" onClick={openNew}>
                ➕ Javob qo‘shish
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="answers-grid">
          {answers.map(a => (
            <div key={a.id} className="answer-item" onClick={() => setViewing(a)}>
              <div className="answer-item-head">
                <span className={`kind-badge ${a.kind}`}>{KIND_LABEL[a.kind] || "Boshqa"}</span>
                {a.subject_name && <span className="subject-tag">{a.subject_name}</span>}
              </div>
              <div className="answer-item-title">{a.title}</div>
              <div className="answer-item-preview">
                {(a.content || "").replace(/\s+/g, " ").slice(0, 140) || "—"}
              </div>
              <div className="answer-item-foot">
                <span className="hint">{a.updated_at || a.created_at}</span>
                {isAdmin && (
                  <div className="answer-item-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn tiny ghost" onClick={() => openEdit(a)}>
                      ✏️
                    </button>
                    <button className="btn tiny ghost" onClick={() => remove(a)}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || ""}>
        {viewing && (
          <div>
            <div className="answer-item-head" style={{ marginBottom: 12 }}>
              <span className={`kind-badge ${viewing.kind}`}>{KIND_LABEL[viewing.kind] || "Boshqa"}</span>
              {viewing.subject_name && <span className="subject-tag">{viewing.subject_name}</span>}
            </div>
            <div className="answer-content">{viewing.content || "—"}</div>
            {isAdmin && (
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn primary" onClick={() => { const a = viewing; setViewing(null); openEdit(a); }}>
                  ✏️ Tahrirlash
                </button>
                <button className="btn ghost" onClick={() => remove(viewing)}>
                  🗑 O‘chirish
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "➕ Javob qo‘shish" : "✏️ Javobni tahrirlash"}
      >
        <div className="grid-2">
          <div className="field">
            <label>Fan</label>
            <select
              className="input"
              value={form.subject_id}
              onChange={e => setForm({ ...form, subject_id: e.target.value })}
            >
              {SUBJECTS.filter(([id]) => id).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Turi</label>
            <select
              className="input"
              value={form.kind}
              onChange={e => setForm({ ...form, kind: e.target.value as AnswerKind })}
            >
              <option value="bsb">BSB</option>
              <option value="chsb">ChSB</option>
              <option value="other">Boshqa</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Sarlavha</label>
          <input
            className="input"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Masalan: Algebra BSB — 1-bob javoblari"
          />
        </div>
        <div className="field">
          <label>Javob matni</label>
          <textarea
            className="input"
            rows={10}
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder={"1) ...\n2) ...\n3) ..."}
          />
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setEditing(null)}>
            Bekor
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
