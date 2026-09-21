import { api } from "../api";
import { navigate } from "../router";
import { useApp } from "../store";

export function Profile() {
  const { user, logout } = useApp();
  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <div>
      <h2 className="section-title">👤 Profil</h2>
      <p className="section-sub">Shaxsiy ma'lumotlaringiz</p>

      <div className="card" style={{ maxWidth: 460 }}>
        <div className="profile-avatar">
          {(user.first_name?.[0] || user.username?.[0] || "U").toUpperCase()}
        </div>
        <h3>
          {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}
        </h3>
        <p className="hint">@{user.username}</p>

        <div className="divider" />

        <div className="profile-row">
          <b>Roli</b>
          <span>{isAdmin ? "🛠 Administrator" : "🎓 O‘quvchi"}</span>
        </div>
        <div className="profile-row">
          <b>Qo‘shilgan sana</b>
          <span>{user.created_at}</span>
        </div>

        {isAdmin && (
          <div style={{ marginTop: 16 }}>
            <button className="btn secondary block" onClick={() => navigate("/admin")}>
              🛠 Admin paneli
            </button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn danger block" onClick={logout}>
            ⏻ Chiqish
          </button>
        </div>
      </div>
    </div>
  );
}