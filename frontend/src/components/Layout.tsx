import { ReactNode, useState } from "react";
import { api } from "../api";
import { navigate, Route } from "../router";
import { useApp } from "../store";

const TABS = [
  { name: "home", icon: "🏠", label: "Bosh sahifa" },
  { name: "books", icon: "📚", label: "Kitoblar" },
  { name: "ai", icon: "🤖", label: "AI" },
  { name: "answers", icon: "📋", label: "Javoblar" },
  { name: "history", icon: "🕘", label: "Tarix" },
  { name: "profile", icon: "👤", label: "Profil" },
];

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { user, logout } = useApp();
  const [badge, setBadge] = useState<string>("");

  useState(() => {
    api.aiStatus().then(r => setBadge(r.configured ? r.model : "o‘chirilgan")).catch(() => {});
  });

  const current = TABS.find(t => t.name === route.name)?.name || "home";
  const isAdmin = user?.role === "admin";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">📚</span>
          <span>8-sinf AI Homework</span>
        </div>
        <nav className="desktop-nav">
          {TABS.map(t => (
            <button
              key={t.name}
              className={`nav-link ${current === t.name ? "active" : ""}`}
              onClick={() => navigate("/" + t.name)}
            >
              {t.icon} {t.label}
            </button>
          ))}
          {isAdmin && (
            <button className="nav-link" onClick={() => navigate("/admin")}>
              🛠 Admin
            </button>
          )}
        </nav>
        <div className="spacer" />
        <div className="topbar-actions">
          <span className={`ai-badge ${!badge || badge === "o‘chirilgan" ? "off" : ""}`}>
            {badge ? `AI: ${badge}` : "AI: ..."}
          </span>
          <span className="username">{user?.first_name || user?.username}</span>
          <button className="icon-btn" onClick={logout} title="Chiqish">
            ⏻
          </button>
        </div>
      </header>

      <main className="main-content">{children}</main>

      <nav className="bottom-nav">
        {TABS.map(t => (
          <button
            key={t.name}
            className={`bn-item ${current === t.name ? "active" : ""}`}
            onClick={() => navigate("/" + t.name)}
          >
            <span className="bn-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}