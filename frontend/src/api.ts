import type {
  AdminAiSettings,
  AdminStats,
  AdminUser,
  AiStatus,
  Answer,
  AnswerPayload,
  Book,
  HealthAiResponse,
  HealthDbResponse,
  HealthResponse,
  HistoryDetail,
  HistoryRow,
  IndexStatus,
  Manba,
  PageInfo,
  PageTextResponse,
  SavedDetail,
  SavedRow,
  SearchHit,
  SolveResponse,
  Subject,
  User,
} from "./types";

const TOKEN_KEY = "sinf8_token";
const USER_KEY = "sinf8_user";

// Prodda frontend (Vercel) va backend turli domenlarda bo'lishi mumkin.
// VITE_API_BASE_URL berilmasa — nisbiy (bir xil origin) ishlaydi.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export interface ApiError extends Error {
  code: string;
  status: number;
}

class ApiClient {
  private tokenValue = "";
  private userValue: User | null = null;

  constructor() {
    this.tokenValue = localStorage.getItem(TOKEN_KEY) || "";
    try {
      this.userValue = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      this.userValue = null;
    }
  }

  get token(): string {
    return this.tokenValue;
  }

  get user(): User | null {
    return this.userValue;
  }

  setSession(token: string, user: User) {
    this.tokenValue = token;
    this.userValue = user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearSession() {
    this.tokenValue = "";
    this.userValue = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async request<T>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.tokenValue) headers["Authorization"] = "Bearer " + this.tokenValue;
    let payload: BodyInit | undefined;
    if (body !== undefined && body !== null) {
      if (isForm) {
        payload = body as BodyInit;
      } else {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
    }
    let res: Response;
    try {
      res = await fetch(API_BASE + url, { method, headers, body: payload });
    } catch {
      const err = new Error("Internet yoki server bilan ulanish mavjud emas.") as ApiError;
      err.code = "NETWORK_OFFLINE";
      err.status = 0;
      throw err;
    }
    if (res.status === 401) {
      this.clearSession();
      window.dispatchEvent(new CustomEvent("auth:expired"));
      const err = new Error("Sessiya tugagan — qayta kiring.") as ApiError;
      err.code = "AUTH_REQUIRED";
      err.status = 401;
      throw err;
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(this.extractMessage(data)) as ApiError;
      err.code = this.extractCode(data);
      err.status = res.status;
      throw err;
    }
    return data as T;
  }

  private extractMessage(data: unknown): string {
    if (!data) return "Xatolik yuz berdi";
    const d = data as {
      detail?: unknown;
      message?: unknown;
      error?: { message?: string; code?: string };
    };
    if (d.error?.message) return d.error.message;
    if (typeof d.detail === "string") return d.detail;
    if (typeof d.message === "string") return d.message;
    return "Xatolik yuz berdi";
  }

  private extractCode(data: unknown): string {
    const d = data as { error?: { code?: string } };
    return d.error?.code || "SERVER_ERROR";
  }

  get<T>(url: string) {
    return this.request<T>("GET", url);
  }

  post<T>(url: string, body?: unknown) {
    return this.request<T>("POST", url, body ?? {});
  }

  patch<T>(url: string, body?: unknown) {
    return this.request<T>("PATCH", url, body ?? {});
  }

  delete<T>(url: string) {
    return this.request<T>("DELETE", url);
  }

  upload<T>(url: string, formData: FormData) {
    return this.request<T>("POST", url, formData, true);
  }

  json<T>(value: string | null): T | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  // ---------------- Auth ----------------
  login(username: string, password: string) {
    return this.post<{ token: string; user: User }>("/api/auth/login", { username, password });
  }

  register(payload: { first_name: string; last_name: string; username: string; password: string }) {
    return this.post<{ token: string; user: User }>("/api/auth/register", payload);
  }

  logout() {
    return this.post<{ ok: boolean }>("/api/auth/logout").catch(() => ({ ok: true }));
  }

  me() {
    return this.get<{ user: User }>("/api/auth/me");
  }

  // ---------------- Books ----------------
  subjects() {
    return this.get<Subject[]>("/api/subjects");
  }

  books(subjectId?: string | null) {
    const q = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : "";
    return this.get<Book[]>(`/api/books${q}`);
  }

  book(bid: string) {
    return this.get<Book>(`/api/books/${bid}`);
  }

  bookInfo(bid: string) {
    return this.get<Book>(`/api/books/${bid}/info`);
  }

  pageIndex(bid: string) {
    return this.get<PageInfo>(`/api/books/${bid}/page-index`);
  }

  pageText(bid: string, pageNo: number) {
    return this.get<PageTextResponse>(`/api/books/${bid}/pages/${pageNo}/text`);
  }

  searchBook(bid: string, q: string, limit = 20) {
    return this.get<SearchHit[]>(`/api/books/${bid}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  }

  resolvePrinted(bid: string, printed: number) {
    return this.get<{ page_pdf: number; printed: number; offset: number }>(
      `/api/books/${bid}/print/${printed}`,
    );
  }

  indexStatus() {
    return this.get<IndexStatus>("/api/index/status");
  }

  reindexBook(bid: string) {
    return this.post<{ book_id: string; pages: number; chunks: number; error?: string }>(
      `/api/books/${bid}/index`,
    );
  }

  reindexAll() {
    return this.post<{ indexed: unknown[]; vector: { chunks: number; books: number; ready: boolean } }>(
      "/api/books/reindex-all",
    );
  }

  addBook(formData: FormData) {
    return this.upload<{ added: boolean; book: Book; pages?: number; chunks?: number; index_error?: string }>(
      "/api/books/add",
      formData,
    );
  }

  deleteBook(bid: string) {
    return this.delete<{ ok: boolean }>(`/api/books/${bid}`);
  }

  setOffset(bid: string, offset: number) {
    return this.post<{ ok: boolean; offset: number }>(`/api/books/${bid}/offset?offset=${offset}`);
  }

  folderScan() {
    return this.get<{ found: { path: string; subject_hint: string; filename: string }[] }>(
      "/api/books/folder-scan",
    );
  }

  // ---------------- AI ----------------
  solve(question: string) {
    return this.post<SolveResponse>("/api/ai/solve", { question });
  }

  aiStatus() {
    return this.get<AiStatus>("/api/ai/status");
  }

  history(limit = 100) {
    return this.get<HistoryRow[]>(`/api/ai/history?limit=${limit}`);
  }

  historyDetail(mid: string) {
    return this.get<HistoryDetail>(`/api/ai/history/${mid}`);
  }

  deleteHistory(mid: string) {
    return this.delete<{ ok: boolean }>(`/api/ai/history/${mid}`);
  }

  save(mid: string) {
    return this.post<{ ok: boolean; already?: boolean }>(`/api/ai/save/${mid}`);
  }

  saved() {
    return this.get<SavedRow[]>("/api/ai/saved");
  }

  savedDetail(sid: string) {
    return this.get<SavedDetail>(`/api/ai/saved/${sid}`);
  }

  deleteSaved(sid: string) {
    return this.delete<{ ok: boolean }>(`/api/ai/saved/${sid}`);
  }

  share(mid: string) {
    return this.post<{ ok: boolean; url: string }>(`/api/ai/share/${mid}`);
  }

  shareGet(token: string) {
    return this.get<{ question: string; answer: unknown; source: Manba; created_at: string }>(
      `/api/share/${token}`,
    );
  }

  // ---------------- Answers (BSB / ChSB) ----------------
  answers(subjectId?: string | null, kind?: string | null) {
    const params = new URLSearchParams();
    if (subjectId) params.set("subject_id", subjectId);
    if (kind) params.set("kind", kind);
    const q = params.toString();
    return this.get<Answer[]>(`/api/answers${q ? `?${q}` : ""}`);
  }

  answer(aid: string) {
    return this.get<Answer>(`/api/answers/${aid}`);
  }

  adminAnswers() {
    return this.get<Answer[]>("/api/admin/answers");
  }

  createAnswer(payload: AnswerPayload) {
    return this.post<Answer>("/api/admin/answers", payload);
  }

  updateAnswer(aid: string, payload: AnswerPayload) {
    return this.request<Answer>("PUT", `/api/admin/answers/${aid}`, payload);
  }

  deleteAnswer(aid: string) {
    return this.delete<{ ok: boolean }>(`/api/admin/answers/${aid}`);
  }

  // ---------------- Admin ----------------
  adminStats() {
    return this.get<AdminStats>("/api/admin/stats");
  }

  adminBooks() {
    return this.get<Book[]>("/api/admin/books");
  }

  adminStatus() {
    return this.get<{ ollama: boolean; db: string; books_dir: string; uptime_s: number }>(
      "/api/admin/status",
    );
  }

  adminUsers() {
    return this.get<AdminUser[]>("/api/admin/users");
  }

  adminSetUserActive(uid: string, isActive: boolean) {
    return this.patch<{ ok: boolean }>(`/api/admin/users/${uid}`, { is_active: isActive });
  }

  adminAi() {
    return this.get<AdminAiSettings>("/api/admin/ai");
  }

  // ---------------- Health ----------------
  health() {
    return this.get<HealthResponse>("/api/health");
  }

  healthAi() {
    return this.get<HealthAiResponse>("/api/health/ai");
  }

  healthDb() {
    return this.get<HealthDbResponse>("/api/health/database");
  }
}

export const api = new ApiClient();

export const baseUrl = API_BASE || window.location.origin;

export function manbaText(m?: Manba | null): string {
  if (!m) return "";
  const parts = [
    m.title,
    m.author,
    m.year ? m.year + "-yil" : "",
    m.printed_page ? m.printed_page + "-bet" : "",
  ].filter(Boolean);
  return parts.join(" · ");
}