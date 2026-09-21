import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { User } from "./types";

interface AppContextValue {
  user: User | null;
  initialized: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue>({
  user: null,
  initialized: false,
  login: () => {},
  logout: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  const login = (token: string, u: User) => {
    api.setSession(token, u);
    setUser(u);
  };

  const logout = () => {
    api.logout();
    api.clearSession();
    setUser(null);
    navigateHome();
  };

  const value = useMemo(() => ({ user, initialized, login, logout }), [user, initialized]);

  useEffect(() => {
    async function init() {
      if (api.token && api.user) {
        try {
          const r = await api.me();
          if (r.user) {
            api.setSession(api.token, r.user);
            setUser(r.user);
          } else {
            api.clearSession();
          }
        } catch {
          api.clearSession();
        }
      }
      setInitialized(true);
    }
    init();
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function navigateHome() {
  window.location.hash = "#/";
}

export function useApp() {
  return useContext(AppContext);
}