import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { navigate } from "../router";
import { useApp } from "../store";
import { useLang } from "../i18n";
import { Icon } from "../components/Icons";
import type { DashboardStats } from "../types";

export function Home() {
  const { user } = useApp();
  const { t } = useLang();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const load = useCallback(() => {
    api.dashboard().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = user?.first_name || user?.username || "do‘st";
  const recent = stats?.recent || [];

  return (
    <div>
      <div className="home-hero">
        <h2>{t("hi", { name: firstName })}</h2>
        <p>{t("hi_sub")}</p>
      </div>

      <button className="quick-solve-btn" onClick={() => navigate("/ai")}>
        <Icon.Zap size={20} /> {t("quick_solve")} 🚀
      </button>

      <div className="dash-stats">
        <div className="dash-stat">
          <span className="ds-icon solved"><Icon.CheckCircle size={18} /></span>
          <div>
            <b>{stats?.total ?? "…"}</b>
            <span>{t("stat_solved")}</span>
          </div>
        </div>
        <div className="dash-stat">
          <span className="ds-icon saved"><Icon.Save size={18} /></span>
          <div>
            <b>{stats?.saved ?? "…"}</b>
            <span>{t("stat_saved")}</span>
          </div>
        </div>
        <div className="dash-stat">
          <span className="ds-icon subs"><Icon.GraduationCap size={18} /></span>
          <div>
            <b>{stats?.by_subject.length ?? "…"}</b>
            <span>{t("stat_subjects")}</span>
          </div>
        </div>
      </div>

      <div className="quick-grid">
        <button className="quick-action" onClick={() => navigate("/books")}>
          <span className="qa-icon">📚</span>{t("nav_books")}
        </button>
        <button className="quick-action" onClick={() => navigate("/ai")}>
          <span className="qa-icon">🤖</span>{t("nav_ai")}
        </button>
        <button className="quick-action" onClick={() => navigate("/chat")}>
          <span className="qa-icon">💬</span>{t("nav_chat")}
        </button>
        <button className="quick-action" onClick={() => navigate("/answers")}>
          <span className="qa-icon">📋</span>{t("nav_answers")}
        </button>
        <button className="quick-action" onClick={() => navigate("/history")}>
          <span className="qa-icon">🕘</span>{t("nav_history")}
        </button>
        <button className="quick-action" onClick={() => navigate("/saved")}>
          <span className="qa-icon">⭐</span>{t("nav_saved")}
        </button>
      </div>

      {stats && stats.by_subject.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}><Icon.GraduationCap /> {t("subjects_label")}</h3>
          <div className="subject-chips">
            {stats.by_subject.map(s => (
              <button key={s.subject} className="subject-chip" onClick={() => navigate("/history")}>
                <b>{s.subject}</b> <span>{s.count}</span>
              </button>
            ))}
            <button className="chip" onClick={() => navigate("/books")}>{t("browse_books")}</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>🕘 {t("recent_title")}</h3>
        {recent.length === 0 ? (
          <div className="empty">{t("no_recent")}</div>
        ) : (
          <div className="recent-list">
            {recent.map(r => (
              <div key={r.id} className="hist-item" onClick={() => navigate(`/history/${r.id}`)}>
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