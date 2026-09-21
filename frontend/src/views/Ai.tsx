import { useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { AnswerCard } from "../components/AnswerCard";
import type { SolveResponse } from "../types";

const EXAMPLES = [
  "Algebra 8-sinf 100-bet №2",
  "Fizika 8-sinf 32-bet 4-masala",
  "Tarixdan O‘zbeklar haqida",
  "O‘zbeklar haqida ma'lumot",
  "Kvadrat tenglamani qanday yechish kerak?",
];

export function Ai() {
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<SolveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const solve = async () => {
    const q = question.trim();
    if (!q) return toast("Savolni yozing");
    setPending(true);
    setError(null);
    setAnswer(null);
    toast("AI ishlamoqda…");
    try {
      const r = await api.solve(q);
      setAnswer(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <h2 className="section-title">🤖 AI Uy vazifasi</h2>
      <p className="section-sub">
        Savolingizni yozing — AI tez javob beradi. Kitobdan aniq topish uchun fan,
        bet va mashq raqamini yozing.
      </p>

      <div className="ai-modes">
        <div className="ai-mode-card book">
          <span className="amc-icon">📖</span>
          <div>
            <b>Kitobdan topish</b>
            <span>Fan + bet + № yoki «kitobdan top» deb yozing. Masalan: «Algebra 8-sinf 100-bet №2»</span>
          </div>
        </div>
        <div className="ai-mode-card general">
          <span className="amc-icon">🌐</span>
          <div>
            <b>Umumiy bilim (internet)</b>
            <span>Faqat savol yozing — AI kitobni qidirmasdan o‘zi javob beradi. Masalan: «O‘zbeklar haqida ma'lumot»</span>
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
        <textarea
          className="input"
          rows={4}
          placeholder={"Masalangizni yozing…\nMisol: «Algebra 8-sinf 100-bet №2»"}
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary big" onClick={solve} disabled={pending}>
            {pending ? "Yechilmoqda…" : "⚡ Yechish"}
          </button>
          <button
            className="btn ghost big"
            onClick={() => {
              setQuestion("");
              setAnswer(null);
              setError(null);
            }}
          >
            Tozalash
          </button>
        </div>
        <p className="ai-note">
          📖 Kitob rejimida javob darslik matnidan olinadi. 🌐 Umumiy rejimda AI
          o‘z bilimidan tez javob beradi.
        </p>
      </div>

      {pending && (
        <div className="answer-card">
          <div className="spinner" />
          <div className="loading">Javob tayyorlanmoqda…</div>
        </div>
      )}

      {error && <div className="error-banner">❌ {error}</div>}

      {answer && (
        <AnswerCard result={answer.result} messageId={answer.message_id} />
      )}
    </div>
  );
}