import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { Icon } from "../components/Icons";
import type { ReactNode } from "react";
import type { AdminAiSettings, AdminStats, AdminUser, Book } from "../types";

type Tab = "overview" | "books" | "users" | "ai";

export function Admin() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [ai, setAi] = useState<AdminAiSettings | null>(null);
  const [aiOffline, setAiOffline] = useState<boolean>(false);

  const loadStats = async () => {
    try {
      setStats(await api.adminStats());
    } catch {
      setAiOffline(true);
    }
  };

  const loadAll = async () => {
    toast("Yuklanmoqda…");
    try {
      const [b, u, a] = await Promise.all([api.adminBooks(), api.adminUsers(), api.adminAi()]);
      setBooks(b);
      setUsers(u);
      setAi(a);
      setAiOffline(false);
      await loadStats();
    } catch (e: any) {
      setAiOffline(true);
      toast(e.message);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabBtn = (id: Tab, label: ReactNode) => (
    <button
      key={id}
      className={`subject-chip ${tab === id ? "active" : ""}`}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="answers-head">
        <div>
          <h2 className="section-title"><Icon.Wrench /> Admin paneli</h2>
          <p className="section-sub">Platforma boshqaruvi</p>
        </div>
        <button className="btn secondary" onClick={() => (location.hash = "#/answers")}>
          <Icon.ClipboardList /> BSB / ChSB javoblar
        </button>
      </div>

      <div className="subject-chips">
        {tabBtn("overview", <><Icon.BarChart3 /> Umumiy</>)}
        {tabBtn("books", <><Icon.Library /> Kitoblar</>)}
        {tabBtn("users", <><Icon.Users /> Foydalanuvchilar</>)}
        {tabBtn("ai", <><Icon.Bot /> AI</>)}
      </div>

      {aiOffline && (
        <div className="error-banner">
          Admin ma'lumotlarini yuklab bo‘lmadi. Sessiya tugagan yoki server ishlamayapti.
        </div>
      )}

      {tab === "overview" && stats && (
        <div>
          <div className="stat-grid">
            <div className="stat-card"><b>{stats.users}</b><span>Foydalanuvchilar</span></div>
            <div className="stat-card"><b>{stats.active_users}</b><span>Faol</span></div>
            <div className="stat-card"><b>{stats.books}</b><span>Kitoblar</span></div>
            <div className="stat-card"><b>{stats.indexed_books}</b><span>Indekslangan</span></div>
            <div className="stat-card"><b>{stats.pages}</b><span>Sahifalar</span></div>
            <div className="stat-card"><b>{stats.chunks}</b><span>Chunklar</span></div>
            <div className="stat-card"><b>{stats.chat_messages}</b><span>Chat savollari</span></div>
            <div className="stat-card"><b>{stats.ai_provider}</b><span>AI provayder</span></div>
          </div>
          <div className="card hint">
            Server: {stats.hostname} · Python {stats.python} · Vektor indeks:{" "}
            {stats.vector_ready ? <><Icon.CheckCircle /> tayyor</> : <><Icon.Hourglass /> tayyor emas</>}
          </div>
        </div>
      )}

      {tab === "books" && (
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <h3><Icon.Library /> Kitoblar</h3>
            <button className="btn small primary" onClick={() => location.hash = "#/books"}><Icon.Plus /> Qo‘shish</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Fan</th><th>Kitob</th><th>Sahifalar</th><th>Indeks</th><th>Amal</th></tr>
              </thead>
              <tbody>
                {books.map(b => (
                  <tr key={b.id}>
                    <td>{b.subject_name}</td>
                    <td>{b.title}</td>
                    <td>{b.num_pages || "?"}</td>
                    <td>{b.indexed ? <span className="badge green"><Icon.CheckCircle /></span> : <span className="badge gray">—</span>}</td>
                    <td>
                      <button className="btn tiny ghost" onClick={async () => {
                        try {
                          const r = await api.reindexBook(b.id);
                          toast(r.error ? "Xatolik: " + r.error : `Indeks: ${r.pages} sahifa`);
                          setBooks(await api.adminBooks());
                        } catch (e: any) {
                          toast(e.message);
                        }
                      }}><Icon.RefreshCw /></button>
                      <button className="btn tiny ghost" onClick={async () => {
                        if (!confirm("O‘chirmoqchimisiz?")) return;
                        try {
                          await api.deleteBook(b.id);
                          setBooks(await api.adminBooks());
                        } catch (e: any) {
                          toast(e.message);
                        }
                      }}><Icon.Trash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}><Icon.Users /> Foydalanuvchilar</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Username</th><th>Ism / Familiya</th><th>Roli</th><th>Holat</th><th>Ro‘yxatdan o‘tgan</th><th>Amal</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{[u.first_name, u.last_name].filter(Boolean).join(" ")}</td>
                    <td>{u.role}</td>
                    <td>{u.is_active ? <span className="badge green">faol</span> : <span className="badge gray">bloklangan</span>}</td>
                    <td>{u.created_at}</td>
                    <td>
                      <button
                        className="btn tiny ghost"
                        onClick={async () => {
                          try {
                            await api.adminSetUserActive(u.id, !u.is_active);
                            setUsers(await api.adminUsers());
                          } catch (e: any) {
                            toast(e.message);
                          }
                        }}
                      >
                        {u.is_active ? <><Icon.Ban /> Bloklash</> : <><Icon.CheckCircle /> Faol qilish</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "ai" && ai && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ marginBottom: 12 }}><Icon.Bot /> AI sozlamalari</h3>
          <div className="profile-row"><b>Provayder</b><span>{ai.provider}</span></div>
          <div className="profile-row"><b>Amaldagi</b><span>{ai.effective_provider}</span></div>
          <div className="profile-row"><b>Ollama</b><span>{ai.ollama_online ? <><Icon.StatusDot style={{ color: "#16a34a" }} /> Online</> : <><Icon.StatusDot style={{ color: "#dc2626" }} /> Offline</>}</span></div>
          <div className="profile-row"><b>Ollama URL</b><span>{ai.ollama_url}</span></div>
          <div className="profile-row"><b>Model</b><span>{ai.ollama_model}</span></div>
          <div className="profile-row"><b>Navbat (concurrency)</b><span>{ai.concurrency}</span></div>
          <div className="profile-row"><b>Chegara (daqiqa)</b><span>{ai.rate_per_minute}</span></div>
          <p className="hint" style={{ marginTop: 12 }}>
            Sozlamalar faqat serverdagi .env faylida o‘zgartiriladi — admin brauzeridan API kalit ko‘rinmaydi.
          </p>
        </div>
      )}
    </div>
  );
}