import { useEffect, useState } from "react";

export interface Route {
  name: string;
  params: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const h = (hash || "").replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  const name = parts[0] || "home";
  const params: Record<string, string> = {};
  if (name === "book" && parts.length >= 2) params.id = parts[1];
  if (name === "share" && parts.length >= 2) params.token = parts[1];
  if (name === "chat" && parts.length >= 2) params.id = parts[1];
  if (name === "history" && parts.length >= 2) params.id = parts[1];
  if (parts.includes("page")) {
    const i = parts.indexOf("page");
    if (parts[i + 1]) params.page = parts[i + 1];
  }
  return { name, params };
}

export function navigate(path: string) {
  window.location.hash = path.startsWith("#") ? path : "#/" + path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}