import { useCallback, useEffect, useRef, useState } from "react";
import { langOfSpeechRecognition, Lang } from "../i18n";

type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

function getSpeech(): { new (): SR } | null {
  const w = window as unknown as { SpeechRecognition?: { new (): SR }; webkitSpeechRecognition?: { new (): SR } };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeech(lang: Lang, onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SR | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeech();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    try {
      recRef.current?.stop();
    } catch {}
    const rec = new Ctor();
    rec.lang = langOfSpeechRecognition(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last && last[0]) onResultRef.current(last[0].transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [lang]);

  useEffect(() => stop, [stop]);

  return { listening, supported, start, stop };
}