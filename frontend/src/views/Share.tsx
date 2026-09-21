import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import type { Manba, SolveResult } from "../types";

export function Share({ token }: { token: string }) {
  const toast = useToast();
  const [data, setData] = useState<{ question: string; answer: SolveResult; source: Manba } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .shareGet(token)
      .then(r => {
        setData({
          question: r.question,
          answer: (r.answer || {}) as SolveResult,
          source: r.source || {},
        });
      })
      .catch((e: any) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="share-page">
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>🔗 Ulashilgan yechim</h2>
        {error && <div className="error-banner">{error}</div>}
        {!data && !error && (
          <div className="loading">
            <div className="spinner" />
            Yuklanmoqda…
          </div>
        )}
        {data && (
          <div>
            <div className="ans-section">
              <div className="sec-label">Savol</div>
              <div className="sec-text">{data.question}</div>
            </div>
            {(data.answer.sections || []).map((s, i) => (
              <div key={i} className="ans-section">
                <div className="sec-label">{s.label}</div>
                <div className="sec-text">{s.text}</div>
              </div>
            ))}
            {!data.answer.sections?.length && data.answer.message && (
              <div className="sec-text">{data.answer.message}</div>
            )}
            <div className="ans-manba">
              <strong>Manba:</strong>{" "}
              {[data.source.title, data.source.author, data.source.printed_page ? data.source.printed_page + "-bet" : ""]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}