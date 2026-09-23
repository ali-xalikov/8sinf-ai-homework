import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { navigate } from "../router";
import { useToast } from "../components/Toast";
import { Icon } from "../components/Icons";
import { useLang } from "../i18n";
import { useSpeech } from "../components/Voice";
import type { ChatConv, ChatMsg } from "../types";

export function Chat({ initialId = "" }: { initialId?: string }) {
  const toast = useToast();
  const { lang, t } = useLang();
  const [convs, setConvs] = useState<ChatConv[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      setConvs(await api.chatList());
    } catch {}
  }, []);

  const open = useCallback(async (id: string) => {
    navigate(`/chat/${id}`);
    setActiveId(id);
    try {
      const d = await api.chatGet(id);
      setMessages(d.messages || []);
    } catch (e: any) {
      toast(e.message);
    }
  }, [toast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (initialId) open(initialId);
  }, [initialId, open]);

  useEffect(() => {
    if (activeId) loadList();
  }, [activeId, loadList]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages.length, pending]);

  const speech = useSpeech(lang, (text) => setInput(text.trim()));

  const createChat = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const d = await api.chatCreate("");
      setConvs(await api.chatList());
      navigate(`/chat/${d.conversation.id}`);
      setActiveId(d.conversation.id);
      setMessages([]);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setCreating(false);
    }
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || pending) return;
    setInput("");
    setPending(true);
    try {
      let d;
      if (!activeId) {
        d = await api.chatCreate(msg);
        setActiveId(d.conversation.id);
        navigate(`/chat/${d.conversation.id}`);
      } else {
        d = await api.chatSend(activeId, msg);
      }
      setMessages(d.messages || []);
      setConvs(await api.chatList());
    } catch (err: any) {
      toast(err.message);
      const d = await api.chatGet(activeId).catch(() => null);
      if (d) setMessages(d.messages || []);
    } finally {
      setPending(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    try {
      await api.chatDelete(id);
      if (id === activeId) {
        setActiveId("");
        setMessages([]);
        navigate("/chat");
      }
      setConvs(await api.chatList());
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <div>
      <h2 className="section-title"><Icon.MessageSquare /> {t("chat_title")}</h2>
      <p className="section-sub">{t("chat_sub")}</p>

      <div className="chat-layout">
        <div className="chat-side">
          <button className="btn primary big full" onClick={createChat} disabled={creating}>
            <Icon.Plus /> {t("new_chat")}
          </button>
          <div className="chat-list">
            {convs.length === 0 && <div className="empty">{t("no_chats")}</div>}
            {convs.map(c => (
              <div
                key={c.id}
                className={`chat-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => open(c.id)}
              >
                {c.subject && <span className="chat-subject chip">{c.subject}</span>}
                <span className="chat-title">{c.title || "…"}</span>
                <button
                  className="icon-btn chat-del"
                  title={t("delete_chat")}
                  onClick={(e) => {
                    e.stopPropagation();
                    del(c.id);
                  }}
                >
                  <Icon.Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="chat-main card">
          {!activeId && (
            <div className="chat-empty">
              <Icon.MessageSquare size={40} />
              <p>{t("empty_chat")}</p>
            </div>
          )}
          {activeId && (
            <>
              <div className="chat-body" ref={bodyRef}>
                {messages.map(m => (
                  <div key={m.id} className={`bubble ${m.role}`}>
                    <div className="bubble-text">{m.content}</div>
                  </div>
                ))}
                {pending && (
                  <div className="bubble assistant">
                    <div className="bubble-text typing"><span /> <span /> <span /></div>
                  </div>
                )}
              </div>
              <form className="chat-input" onSubmit={send}>
                <textarea
                  className="input"
                  rows={2}
                  value={input}
                  placeholder={t("enter_message")}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  type="button"
                  className={`btn ghost big mic-btn ${speech.listening ? "on" : ""}`}
                  title={t("mic_hint")}
                  onClick={() => (speech.listening ? speech.stop() : speech.start())}
                  disabled={!speech.supported}
                >
                  {speech.listening ? <Icon.MicOff /> : <Icon.Mic />}
                </button>
                <button type="submit" className="btn primary big" disabled={pending || !input.trim()}>
                  <Icon.Send /> {t("send")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}