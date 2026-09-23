import { ReactNode, useState } from "react";
import { api } from "../api";
import { navigate, Route } from "../router";
import { useApp } from "../store";
import { Icon } from "./Icons";
import { useLang, Lang } from "../i18n";

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { user, logout } = useApp();
  const { lang, setLang, t } = useLang();
  const [badge, setBadge] = useState<string>("");

  useState(() => {
    api.aiStatus().then(r => setBadge(r.configured ? r.model : t("ai_off"))).catch(() => {});
  });

  const TABS = [
    { name: "home", icon: <Icon.Home />, label: t("nav_home") },
    { name: "books", icon: <Icon.Library />, label: t("nav_books") },
    { name: "ai", icon: <Icon.Bot />, label: t("nav_ai") },
    { name: "chat", icon: <Icon.MessageSquare />, label: t("nav_chat") },
    { name: "answers", icon: <Icon.ClipboardList />, label: t("nav_answers") },
    { name: "history", icon: <Icon.History />, label: t("nav_history") },
    { name: "profile", icon: <Icon.User />, label: t("nav_profile") },
  ];

  const current = TABS.find(tb => tb.name === route.name)?.name || "home";
  const isAdmin = user?.role === "admin";

  const cycleLang = () => {
    const next: Record<Lang, Lang> = { uz: "ru", ru: "en", en: "uz" };
    setLang(next[lang]);
  };

  const langLabels: Record<Lang, string> = { uz: "O‘zbek", ru: "Русский", en: "English" };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo"><Icon.Library size={18} /></span>
          <span>{t("app_title")}</span>
        </div>
        <nav className="desktop-nav">
          {TABS.map(tb => (
            <button
              key={tb.name}
              className={`nav-link ${current === tb.name ? "active" : ""}`}
              onClick={() => navigate("/" + tb.name)}
            >
              {tb.icon} {tb.label}
            </button>
          ))}
          {isAdmin && (
            <button className="nav-link" onClick={() => navigate("/admin")}>
              <Icon.Wrench /> Admin
            </button>
          )}
        </nav>
        <div className="spacer" />
        <div className="topbar-actions">
          <button className="lang-btn" onClick={cycleLang} title="Til / Language / Язык">
            <Icon.Languages /> {langLabels[lang]}
          </button>
          <span className={`ai-badge ${!badge || badge === t("ai_off") ? "off" : ""}`}>
            {badge ? `AI: ${badge}` : "AI: ..."}
          </span>
          <span className="username">{user?.first_name || user?.username}</span>
          <button className="icon-btn" onClick={logout} title="Chiqish">
            <Icon.Power />
          </button>
        </div>
      </header>

      <main className="main-content">{children}</main>

      <nav className="bottom-nav">
        {TABS.map(tb => (
          <button
            key={tb.name}
            className={`bn-item ${current === tb.name ? "active" : ""}`}
            onClick={() => navigate("/" + tb.name)}
          >
            <span className="bn-icon">{tb.icon}</span>
            {tb.label}
          </button>
        ))}
      </nav>
    </div>
  );
}