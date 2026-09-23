export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "student" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface Subject {
  id: string | null;
  name: string;
  n: number;
}

export interface Book {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  author: string;
  edition: string;
  publisher: string;
  year: string;
  class_no: number;
  pdf_path: string;
  exists: boolean;
  num_pages: number;
  page_offset: number;
  detected_offset: number | null;
  indexed: boolean;
  indexed_at: string;
}

export interface IndexStatus {
  chunks: number;
  books: number;
  ready: boolean;
}

export interface AnswerSection {
  label: string;
  text: string;
}

export interface Manba {
  book_id?: string;
  subject?: string;
  title?: string;
  edition?: string;
  publisher?: string;
  year?: string;
  author?: string;
  printed_page?: number | null;
  page_pdf?: number | null;
  headings?: string[];
  exercise_no?: number | null;
  exercise_text?: string;
  has_pdf?: boolean;
}

export type AnswerKind = "bsb" | "chsb" | "other";

export interface Answer {
  id: string;
  subject_id: string;
  subject_name: string;
  kind: AnswerKind;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnswerPayload {
  subject_id: string;
  kind: AnswerKind;
  title: string;
  content: string;
}

export interface SolveResult {
  status: "ok" | "blocked" | "clarify" | "no_llm" | "error";
  message: string;
  sections?: AnswerSection[];
  manba?: Manba;
  plan?: string;
  raw?: string;
  suggestions?: string[];
  subject?: string;
  image_text?: string;
}

export interface SolveResponse {
  result: SolveResult;
  message_id: string;
  remaining: number;
}

export interface SolveImageResponse {
  result: SolveResult;
  message_id: string;
  remaining: number;
  recognized: string;
}

export interface HistoryRow {
  id: string;
  question: string;
  created_at: string;
}

export interface HistoryDetail {
  id: string;
  question: string;
  answer: SolveResult;
  source: Manba;
  created_at: string;
}

export interface SavedRow {
  id: string;
  message_id: string;
  question: string;
  source: Manba;
  created_at: string;
}

export interface SavedDetail {
  id: string;
  question: string;
  answer: SolveResult;
  source: Manba;
  created_at: string;
}

export interface AiStatus {
  provider: string;
  configured: boolean;
  model: string;
  endpoint: string;
  note?: string;
}

export interface DashboardStats {
  total: number;
  saved: number;
  by_subject: { subject: string; count: number }[];
  recent: HistoryRow[];
}

export interface ChatConv {
  id: string;
  title: string;
  subject: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatDetail {
  conversation: ChatConv;
  messages: ChatMsg[];
}

export interface ChatSendResponse {
  conversation: ChatConv;
  messages: ChatMsg[];
  reply: string;
  remaining: number;
}

export interface PageInfo {
  book_id: string;
  num_pages: number;
  page_offset: number;
  pages: { page: number; printed: number; chars: number }[];
}

export interface SearchHit {
  page_no: number;
  printed_page: number;
  score: number;
  snippet: string;
}

export interface AdminStats {
  users: number;
  active_users: number;
  books: number;
  indexed_books: number;
  pages: number;
  chunks: number;
  chat_messages: number;
  ai_provider: string;
  vector_ready: boolean;
  server_online: boolean;
  hostname: string;
  python: string;
  started_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminAiSettings {
  provider: string;
  effective_provider: string;
  openai_model: string;
  openai_base: string;
  ollama_url: string;
  ollama_model: string;
  ollama_online: boolean;
  concurrency: number;
  rate_per_minute: number;
  note: string;
}

export interface HealthResponse {
  status: string;
}

export interface HealthAiResponse {
  status: string;
  provider: string;
  model: string;
}

export interface HealthDbResponse {
  status: string;
  engine: string;
}

export interface PageTextResponse {
  page_no: number;
  printed_page: number;
  text: string;
}