import { useRef, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { AnswerCard } from "../components/AnswerCard";
import { Icon } from "../components/Icons";
import { useLang } from "../i18n";
import { useSpeech } from "../components/Voice";
import type { SolveImageResponse, SolveResponse } from "../types";

const EXAMPLES = [
  "Algebra 8-sinf 100-bet №2",
  "Fizika 8-sinf 32-bet 4-masala",
  "Tarixdan O‘zbeklar haqida",
  "Kvadrat tenglamani qanday yechish kerak?",
];

type Mode = "text" | "image";

export function Ai() {
  const toast = useToast();
  const { lang, t } = useLang();

  // Text mode
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<SolveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Image mode
  const [mode, setMode] = useState<Mode>("text");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgMode, setImgMode] = useState<"homework" | "handwriting">("homework");
  const [imgPending, setImgPending] = useState(false);
  const [imageResult, setImageResult] = useState<SolveImageResponse | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const speech = useSpeech(lang, (text) => setQuestion((prev) => (prev ? prev + " " : "") + text));

  const solve = async () => {
    const q = question.trim();
    if (!q) return toast(t("write_question"));
    setPending(true);
    setError(null);
    setAnswer(null);
    toast(t("toast_working"));
    try {
      const r = await api.solve(q);
      setAnswer(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast(t("image_required"));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setImageResult(null);
    setImageError(null);
  };

  const solveImage = async () => {
    if (!imageFile) return toast(t("image_required"));
    setImgPending(true);
    setImageError(null);
    setImageResult(null);
    toast(t("recognizing"));
    try {
      const r = await api.solveImage(imageFile, question.trim(), imgMode);
      setImageResult(r);
    } catch (e: any) {
      setImageError(e.message);
    } finally {
      setImgPending(false);
    }
  };

  const clearAll = () => {
    setQuestion("");
    setAnswer(null);
    setError(null);
    setImageFile(null);
    setImageResult(null);
    setImageError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <div>
      <h2 className="section-title"><Icon.Bot /> {t("ai_title")}</h2>
      <p className="section-sub">{t("ai_sub")}</p>

      <div className="ai-tabs">
        <button className={`ai-tab ${mode === "text" ? "active" : ""}`} onClick={() => setMode("text")}>
          <Icon.FileText /> {t("mode_text")}
        </button>
        <button className={`ai-tab ${mode === "image" ? "active" : ""}`} onClick={() => setMode("image")}>
          <Icon.Image /> {t("mode_image")}
        </button>
      </div>

      {mode === "text" && (
        <>
          <div className="ai-modes">
            <div className="ai-mode-card book">
              <span className="amc-icon"><Icon.BookOpen size={22} /></span>
              <div>
                <b>Kitobdan topish</b>
                <span>Fan + bet + № yoki «kitobdan top» deb yozing. Masalan: «Algebra 8-sinf 100-bet №2»</span>
              </div>
            </div>
            <div className="ai-mode-card general">
              <span className="amc-icon"><Icon.Globe size={22} /></span>
              <div>
                <b>Umumiy bilim (internet)</b>
                <span>Faqat savol yozing — AI kitobni qidirmasdan o‘zi javob beradi.</span>
              </div>
            </div>
          </div>

          <div className="card ai-input-card">
            <div className="example-chips">
              {EXAMPLES.map(ex => (
                <button key={ex} className="chip" onClick={() => setQuestion(ex)}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="input-with-mic">
              <textarea
                className="input"
                rows={4}
                placeholder={t("write_question")}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) solve();
                }}
              />
              <button
                className={`btn ghost mic-btn ${speech.listening ? "on" : ""}`}
                title={t("mic_hint")}
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                disabled={!speech.supported}
              >
                {speech.listening ? <Icon.MicOff size={18} /> : <Icon.Mic size={18} />}
              </button>
            </div>
            {speech.listening && <p className="ai-note listening-note"><Icon.Mic /> {t("listening")}…</p>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary big" onClick={solve} disabled={pending}>
                {pending ? t("solving") : <><Icon.Zap /> {t("solve")}</>}
              </button>
              <button className="btn ghost big" onClick={clearAll}>
                {t("clear")}
              </button>
            </div>
          </div>
        </>
      )}

      {mode === "image" && (
        <>
          <div className="card ai-input-card">
            <div className="img-mode-toggle">
              <button
                className={`chip ${imgMode === "homework" ? "chip-on" : ""}`}
                onClick={() => setImgMode("homework")}
              >
                <Icon.Image /> {t("homework_photo")}
              </button>
              <button
                className={`chip ${imgMode === "handwriting" ? "chip-on" : ""}`}
                onClick={() => setImgMode("handwriting")}
              >
                <Icon.Pencil /> {t("handwriting_mode")}
              </button>
            </div>
            <p className="ai-note">
              {imgMode === "handwriting" ? t("handwriting_desc") : t("mode_image_desc")}
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => onFile(e.target.files?.[0])}
            />
            <div className="img-upload-row">
              <button className="btn primary big" onClick={() => fileRef.current?.click()}>
                <Icon.Image /> {t("upload_image")}
              </button>
              <button className="btn ghost big" onClick={() => fileRef.current?.click()}>
                <Icon.Camera /> {t("take_photo")}
              </button>
            </div>
            <p className="ai-note">
              {imgMode === "handwriting"
                ? "Daftar sahifasini suratga oling — AI yozmani taniy oladi va tozalab qayta yozib beradi."
                : "Darslik/baza yuzasidan topshiriq suratini yuklang — AI matnni taniy oladi, fan va topshiriqlarni aniqlaydi."}
            </p>

            {previewUrl && (
              <div className="img-preview">
                <img src={previewUrl} alt="preview" />
                <button className="btn small ghost" onClick={() => fileRef.current?.click()}>
                  <Icon.RefreshCw /> {t("change_image")}
                </button>
              </div>
            )}

            <textarea
              className="input"
              rows={2}
              placeholder={t("add_question")}
              value={question}
              onChange={e => setQuestion(e.target.value)}
            />

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary big" onClick={solveImage} disabled={imgPending || !imageFile}>
                {imgPending ? t("recognizing") : <><Icon.Zap /> {t("solve")}</>}
              </button>
              <button className="btn ghost big" onClick={clearAll}>
                {t("clear")}
              </button>
            </div>
          </div>

          {imgPending && (
            <div className="answer-card">
              <div className="spinner" />
              <div className="loading">{t("recognizing")}…</div>
            </div>
          )}

          {imageError && <div className="error-banner"><><Icon.XCircle /> {imageError}</></div>}

          {imageResult && (
            <AnswerCard result={imageResult.result} messageId={imageResult.message_id} />
          )}
        </>
      )}

      {mode === "text" && pending && (
        <div className="answer-card">
          <div className="spinner" />
          <div className="loading">{t("toast_working")}…</div>
        </div>
      )}

      {mode === "text" && error && <div className="error-banner"><><Icon.XCircle /> {error}</></div>}

      {mode === "text" && answer && (
        <AnswerCard result={answer.result} messageId={answer.message_id} />
      )}
    </div>
  );
}