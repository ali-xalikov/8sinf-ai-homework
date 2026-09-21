import { useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useApp } from "../store";

export function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "error" | "ok" } | null>(null);
  const { login } = useApp();
  const toast = useToast();

  // login
  const [lUser, setLUser] = useState("");
  const [lPass, setLPass] = useState("");
  // register
  const [rFirst, setRFirst] = useState("");
  const [rLast, setRLast] = useState("");
  const [rUser, setRUser] = useState("");
  const [rPass, setRPass] = useState("");

  const doLogin = async () => {
    setMsg(null);
    if (!lUser.trim() || !lPass) {
      setMsg({ text: "Username va parolni kiriting", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const r = await api.login(lUser.trim(), lPass);
      login(r.token, r.user);
      toast("Xush kelibsiz!");
    } catch (e: any) {
      setMsg({ text: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async () => {
    setMsg(null);
    if (rUser.trim().length < 3) {
      setMsg({ text: "Username kamida 3 ta belgi", type: "error" });
      return;
    }
    if (rPass.length < 4) {
      setMsg({ text: "Parol kamida 4 ta belgi", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const r = await api.register({
        first_name: rFirst.trim(),
        last_name: rLast.trim(),
        username: rUser.trim(),
        password: rPass,
      });
      login(r.token, r.user);
      toast("Ro‘yxatdan o‘tildi — xush kelibsiz!");
    } catch (e: any) {
      setMsg({ text: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo">📚</div>
          <h1>8-sinf AI Homework</h1>
          <p>O‘z darsliklaring asosida AI yordamchi</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            👤 Kirish
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            📝 Ro‘yxatdan o‘tish
          </button>
        </div>

        {mode === "login" ? (
          <>
            <div className="field">
              <label>Username</label>
              <input className="input" value={lUser} onChange={e => setLUser(e.target.value)} placeholder="username" autoComplete="username" />
            </div>
            <div className="field">
              <label>Parol</label>
              <input className="input" type="password" value={lPass} onChange={e => setLPass(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e => e.key === "Enter" && doLogin()} />
            </div>
            <button className="btn primary big block" onClick={doLogin} disabled={loading}>
              {loading ? "Kutilmoqda…" : "Kirish"}
            </button>
            <p className="auth-switch">
              Hisobingiz yo‘qmi?{" "}
              <a
                href="#"
                onClick={e => {
                  e.preventDefault();
                  setMode("register");
                }}
              >
                Ro‘yxatdan o‘tish
              </a>
            </p>
          </>
        ) : (
          <>
            <div className="grid-2" style={{ marginBottom: 0 }}>
              <div className="field">
                <label>Ism</label>
                <input className="input" value={rFirst} onChange={e => setRFirst(e.target.value)} placeholder="Ism" />
              </div>
              <div className="field">
                <label>Familiya</label>
                <input className="input" value={rLast} onChange={e => setRLast(e.target.value)} placeholder="Familiya" />
              </div>
            </div>
            <div className="field">
              <label>Username</label>
              <input className="input" value={rUser} onChange={e => setRUser(e.target.value)} placeholder="masalan: aziz2009" autoComplete="username" />
            </div>
            <div className="field">
              <label>Parol</label>
              <input className="input" type="password" value={rPass} onChange={e => setRPass(e.target.value)} placeholder="kamida 4 ta belgi" autoComplete="new-password" />
            </div>
            <button className="btn primary big block" onClick={doRegister} disabled={loading}>
              {loading ? "Kutilmoqda…" : "Ro‘yxatdan o‘tish"}
            </button>
            <p className="hint" style={{ textAlign: "center", marginTop: 10 }}>
              Shaxsiy aloqa ma'lumotlari so‘ralmaydi.
            </p>
          </>
        )}

        {msg && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}
      </div>
    </div>
  );
}