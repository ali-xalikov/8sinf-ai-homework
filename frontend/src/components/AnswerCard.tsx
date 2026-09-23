import { api, manbaText } from "../api";
import { navigate } from "../router";
import { useToast } from "./Toast";
import { Icon } from "./Icons";
import { useLang, translate } from "../i18n";
import type { ReactNode } from "react";
import type { SolveResult } from "../types";

function resultToPlain(result: SolveResult): string {
  const lines: string[] = [];
  for (const s of result.sections || []) {
    lines.push(`${s.label}\n${s.text}`);
  }
  if (!lines.length && result.message) lines.push(result.message);
  return lines.join("\n\n");
}

function resultToHtml(result: SolveResult, lang: "uz" | "ru" | "en", question?: string): string {
  const parts: string[] = [
    "<html><head><meta charset='utf-8'><style>",
    "body{font-family:Times New Roman,serif;font-size:14pt;max-width:720px;margin:24px auto;color:#111;}",
    "h2{font-size:18pt;} .sec{margin:14px 0;} .label{font-weight:bold;font-size:13pt;color:#333;margin-bottom:4px;}",
    "p{line-height:1.5;white-space:pre-wrap;margin:0;} .src{margin-top:18px;color:#555;font-size:11pt;}",
    "</style></head><body>",
  ];
  if (question) parts.push(`<h2>${escapeHtml(question)}</h2>`);
  for (const s of result.sections || []) {
    parts.push(
      `<div class="sec"><div class="label">${escapeHtml(s.label)}</div><p>${escapeHtml(s.text)}</p></div>`,
    );
  }
  if (!(result.sections?.length) && result.message) {
    parts.push(`<p>${escapeHtml(result.message)}</p>`);
  }
  if (result.manba) {
    parts.push(`<div class="src"><b>${translate(lang, "src_manba", {}) || "Manba:"}</b> ${escapeHtml(manbaText(result.manba))}</div>`);
  }
  parts.push("</body></html>");
  return parts.join("");
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

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
  const { lang, t } = useLang();

  const statusClass: Record<string, string> = {
    ok: "ok",
    blocked: "blocked",
    clarify: "clarify",
    no_llm: "no-llm",
    error: "error",
  };

  const statusText: Record<string, ReactNode> = {
    ok: <><Icon.CheckCircle /> {t("status_ready")}</>,
    blocked: <><Icon.Ban /> {t("status_blocked")}</>,
    clarify: <><Icon.Info /> {t("status_clarify")}</>,
    no_llm: <><Icon.AlertTriangle /> {t("status_no_llm")}</>,
    error: <><Icon.AlertTriangle /> {t("status_error")}</>,
  };

  const handleSave = async () => {
    try {
      await api.save(messageId);
      toast(t("saved"));
    } catch (e: any) {
      toast(e.message);
    }
  };

  const handleShare = async () => {
    try {
      const r = await api.share(messageId);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(r.url);
        toast(t("copied"));
      }
    } catch (e: any) {
      toast(e.message);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resultToPlain(result));
      toast(t("copied"));
    } catch {
      toast(t("err_generic"));
    }
  };

  const handleWord = () => {
    const html = resultToHtml(result, lang);
    const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uyvazifa_${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return toast(t("err_generic"));
    w.document.write(resultToHtml(result, lang) + "<script>window.onload=function(){window.print();setTimeout(function(){window.close();},400)}</script>");
    w.document.close();
  };

  const planBadge: { cls: string; label: ReactNode } | null =
    result.plan === "general"
      ? { cls: "general", label: <><Icon.Globe /> {t("plan_general")}</> }
      : result.plan === "exact_exercise" || result.plan === "semantic"
        ? { cls: "book", label: <><Icon.BookOpen /> {t("plan_book")}</> }
        : result.plan === "image"
          ? { cls: "image", label: <><Icon.Camera /> {t("plan_image")}</> }
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

      {result.subject && (
        <div className="subject-detected">
          <b>{t("detected_subject")}:</b> <span className="subject-chip">{result.subject}</span>
        </div>
      )}

      {result.image_text && (
        <div className="ans-section recognized">
          <div className="sec-label">{t("recognized_text")}</div>
          <div className="sec-text">{result.image_text}</div>
        </div>
      )}

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
              <Icon.BookOpen /> Sahifani ochish
            </button>
          )}
        </div>
      )}

      <div className="ans-actions">
        <button className="btn small primary" onClick={handleSave}>
          <Icon.Save /> {t("save")}
        </button>
        <button className="btn small ghost" onClick={handleShare}>
          <Icon.Share /> {t("share")}
        </button>
        <button className="btn small ghost" onClick={handleCopy}>
          <Icon.FileText /> {t("copy")}
        </button>
        <button className="btn small ghost" onClick={handleWord}>
          <Icon.FileText /> {t("export_word")}
        </button>
        <button className="btn small ghost" onClick={handlePrint}>
          <Icon.FileText /> {t("export_pdf")} / {t("export_print")}
        </button>
      </div>
    </div>
  );
}