import { useCallback, useEffect, useState } from "react";
import { api, manbaText } from "../api";
import { useToast } from "../components/Toast";
import { AnswerCard } from "../components/AnswerCard";
import type { HistoryDetail, HistoryRow, Manba, SavedRow } from "../types";

export function History({ savedOnly = false, initialId = "" }: { savedOnly?: boolean; initialId?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.history(100));
      setSaved(await api.saved());
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load, savedOnly]);

  useEffect(() => {
    if (initialId) open(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const open = async (mid: string) => {
    setSavedId(null);
    try {
      setDetail(await api.historyDetail(mid));
    } catch (e: any) {
      toast(e.message);
    }
  };

  const openSaved = async (sid: string) => {
    setDetail(null);
    setSavedId(sid);
    try {
      const d = await api.savedDetail(sid);
      setDetail({
        id: d.id,
        question: d.question,
        answer: d.answer,
        source: d.source,
        created_at: d.created_at,
      });
    } catch (e: any) {
      toast(e.message);
    }
  };

  const del = async (mid: string) => {
    if (!confirm("Haqiqatan o‘chirmoqchimisiz?")) return;
    try {
      await api.deleteHistory(mid);
      toast("O‘chirildi");
      setDetail(null);
      load();
    } catch (e: any) {
      toast(e.message);
    }
  };

  const unSave = async (sid: string) => {
    if (!confirm("Saqlanganlardan o‘chiraymi?")) return;
    try {
      await api.deleteSaved(sid);
      toast("O‘chirildi");
      setDetail(null);
      load();
    } catch (e: any) {
      toast(e.message);
    }
  };

  const src = (source: Manba | null | undefined) => {
    if (!source) return "";
    return manbaText(source);
  };

  return (
    <div className="grid-2">
      <div>
        <h2 className="section-title">{savedOnly ? "⭐ Saqlangan masalalar" : "🕘 Savollarim"}</h2>
        <p className="section-sub">{savedOnly ? "Yechimlaringiz" : "So‘nggi savollar va yechimlar"}</p>

        <div className="hist-list">
          {savedOnly
            ? saved.map(r => (
                <div key={r.id} className="hist-item" onClick={() => openSaved(r.id)}>
                  <span className="hist-q">⭐ {r.question}</span>
                  <span className="hist-meta">
                    <span className="hist-source">{src(r.source)}</span>
                    <span>{r.created_at}</span>
                  </span>
                </div>
              ))
            : rows.map(r => (
                <div key={r.id} className="hist-item" onClick={() => open(r.id)}>
                  <span className="hist-q">{r.question}</span>
                  <span className="hist-meta">
                    <span>{r.created_at}</span>
                  </span>
                </div>
              ))}
          {(savedOnly ? saved.length : rows.length) === 0 && (
            <div className="empty">
              {savedOnly ? "Hali saqlangan yechim yo‘q." : "Hali savollar yo‘q."}
            </div>
          )}
        </div>
      </div>

      <div>
        {detail && (
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 8 }}>Savol</h3>
              <div className="sec-text">{detail.question}</div>
              <div className="ans-actions">
                <button className="btn small ghost" onClick={() => del(detail.id)}>🗑 O‘chirish</button>
                {savedId && (
                  <button className="btn small ghost" onClick={() => unSave(savedId)}>⭐ Saqlanganlardan o‘chirish</button>
                )}
              </div>
            </div>
            <AnswerCard result={detail.answer} messageId={detail.id} />
          </div>
        )}
        {!detail && (
          <div className="card empty">
            <div className="spinner" style={{ marginTop: 0 }} />
            Savolni tanlang — yechim shu yerda chiqadi.
          </div>
        )}
      </div>
    </div>
  );
}