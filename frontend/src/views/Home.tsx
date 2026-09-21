import { useEffect, useState } from "react";
import { api } from "../api";
import { navigate } from "../router";
import { useApp } from "../store";
import type { HistoryRow } from "../types";

const QUICK = [
  { icon: "📚", label: "Kitoblar", path: "/books" },
  { icon: "🤖", label: "AI Homework", path: "/ai" },
  { icon: "📋", label: "BSB / ChSB javoblar", path: "/answers" },
  { icon: "🕘", label: "Tarix", path: "/history" },
  { icon: "⭐", label: "Saqlanganlar", path: "/saved" },
];

export function Home() {
  const { user } = useApp();
  const [recent, setRecent] = useState<HistoryRow[]>([]);

  useEffect(() => {
    api
      .history(6)
      .then(setRecent)
      .catch(() => {});
  }, []);

  const firstName = user?.first_name || user?.username || "do‘st";

  return (
    <div>
      <div className="home-hero">
        <h2>Salom, {firstName} 👋</h2>
        <p>Bugun nimani o‘rganamiz?</p>
      </div>

      <div className="quick-grid">
        {QUICK.map(q => (
          <button key={q.path} className="quick-action" onClick={() => navigate(q.path)}>
            <span className="qa-icon">{q.icon}</span>
            {q.label}
          </button>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>🕘 So‘nggi savollar</h3>
        {recent.length === 0 ? (
          <div className="empty">Hali savollar yo‘q. AI bo‘limiga o‘ting!</div>
        ) : (
          <div className="recent-list">
            {recent.map(r => (
              <div
                key={r.id}
                className="hist-item"
                onClick={() => navigate(`/history/${r.id}`)}
              >
                <span className="hist-q">{r.question}</span>
                <span className="hist-meta">{r.created_at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}