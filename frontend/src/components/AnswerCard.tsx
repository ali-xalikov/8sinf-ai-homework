import { api, manbaText } from "../api";
import { navigate } from "../router";
import { useToast } from "./Toast";
import type { SolveResult } from "../types";

export function AnswerCard({
  result,
  messageId,
  onRefresh,
}: {
  result: SolveResult;
  messageId: string;
  onRefresh?: () => void;
}) {
  const toast = useToast();

  const statusClass: Record<string, string> = {
    ok: "ok",
    blocked: "blocked",
    clarify: "clarify",
    no_llm: "no-llm",
    error: "error",
  };

  const statusText: Record<string, string> = {
    ok: "✅ Yechim tayyor",
    blocked: "⚠️ Cheklov",
    clarify: "ℹ️ Aniqlashtiring",
    no_llm: "⚠️ AI sozlanmagan",
    error: "❌ Xatolik",
  };

  const handleSave = async () => {
    try {
      await api.save(messageId);
      toast("Saqlandi!");
    } catch (e: any) {
      toast(e.message);
    }
  };

  const handleShare = async () => {
    try {
      const r = await api.share(messageId);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(r.url);
        toast("Havola nusxalandi");
      }
    } catch (e: any) {
      toast(e.message);
    }
  };

  const planBadge =
    result.plan === "general"
      ? { cls: "general", label: "🌐 Umumiy bilim" }
      : result.plan === "exact_exercise" || result.plan === "semantic"
        ? { cls: "book", label: "📖 Kitobdan topildi" }
        : null;

  return (
    <div className="answer-card">
      <div className="ans-head">
        <div className={`ans-status ${statusClass[result.status] || ""}`}>
          {statusText[result.status] || ""}
          {result.message ? ` — ${result.message}` : ""}
        </div>
        {planBadge && <span className={`plan-badge ${planBadge.cls}`}>{planBadge.label}</span>}
      </div>

      {result.sections?.map((s, i) => (
        <div key={i} className="ans-section">
          <div className="sec-label">{s.label}</div>
          <div className="sec-text">{s.text}</div>
        </div>
      ))}

      {!result.sections && result.message && (
        <div className="sec-text">{result.message}</div>
      )}

      {result.manba && (
        <div className="ans-manba">
          <strong>Manba:</strong> {manbaText(result.manba)}
          {result.manba.book_id && result.manba.has_pdf && (
            <button
              className="btn small primary"
              onClick={() =>
                navigate(
                  `/book/${result.manba!.book_id}/page/${result.manba!.printed_page || 1}`,
                )
              }
            >
              📖 Sahifani ochish
            </button>
          )}
        </div>
      )}

      <div className="ans-actions">
        <button className="btn small primary" onClick={handleSave}>
          ⭐ Saqlash
        </button>
        <button className="btn small ghost" onClick={handleShare}>
          🔗 Ulashish
        </button>
      </div>
    </div>
  );
}