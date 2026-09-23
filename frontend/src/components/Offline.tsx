import { useEffect, useState } from "react";
import { Icon } from "./Icons";

export function useOnline() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function OfflineScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="offline-screen">
      <div className="offline-card card">
        <div className="of-icon"><Icon.RadioTower size={64} /></div>
        <h2 style={{ margin: "12px 0 6px" }}>Internet yo‘q</h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Internet yoki server bilan ulanish mavjud emas.
          <br />
          Ulanishni tekshirib qayta urinib ko‘ring.
        </p>
        <div style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={onRetry}>
            <Icon.RefreshCw /> Qayta urinish
          </button>
        </div>
      </div>
    </div>
  );
}