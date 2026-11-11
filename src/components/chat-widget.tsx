"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Chat bubble on every public page (SPEC.md 6.6). Talks to POST /api/chat,
 * which forwards to the n8n booking agent. Hidden in the admin panel.
 */

type Message = { from: "agent" | "customer"; text: string; failed?: boolean };

const MAX_MESSAGE = 1000;
const SESSION_KEY = "workshop-chat-session";
const GREETING: Message = {
  from: "agent",
  text: "Здравейте! Мога да проверя цена и свободен час за обслужване и да ви запиша. За кой автомобил става дума?",
};

/** One id per browser, so the agent remembers the conversation between pages. */
function sessionId(): string {
  // randomUUID needs HTTPS (or localhost). The id only keys the conversation memory, so a plain random one will do.
  const fresh = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  try {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = fresh();
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return fresh(); // storage blocked: the conversation lasts until the page reloads
  }
}

/** The agent marks prices with **bold**; everything else is shown as plain text. */
function Formatted({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const session = useRef<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, waiting, open]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (pathname.startsWith("/admin")) return null;

  async function send() {
    const text = draft.trim();
    if (!text || waiting) return;
    setDraft("");
    setMessages((all) => [...all, { from: "customer", text }]);
    setWaiting(true);

    let answer: Message;
    try {
      session.current ??= sessionId();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.current, message: text }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      answer =
        response.ok && data.reply
          ? { from: "agent", text: data.reply }
          : { from: "agent", failed: true, text: data.error ?? "Нещо се обърка. Опитайте отново след малко." };
    } catch {
      answer = { from: "agent", failed: true, text: "Няма връзка със сървъра. Проверете интернета и опитайте отново." };
    }
    setMessages((all) => [...all, answer]);
    setWaiting(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn fixed bottom-4 right-4 z-30 min-h-12 px-5 shadow-lg shadow-black/40"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Чат с асистента
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Чат с асистента на сервиза"
      className="fixed bottom-4 right-4 z-30 flex h-[min(34rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col border border-line-strong bg-carbon-raised shadow-2xl shadow-black/60"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <h2 className="label label-accent">Асистент · записване на час</h2>
        <button type="button" className="label px-2 py-1 transition-colors hover:text-paper" onClick={() => setOpen(false)}>
          Затвори
        </button>
      </header>

      <div ref={log} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, i) => (
          <p
            key={i}
            className={
              message.from === "customer"
                ? "ml-8 whitespace-pre-wrap break-words bg-olive px-3 py-2 text-sm"
                : `mr-8 whitespace-pre-wrap break-words border-l-2 px-3 py-2 text-sm ${
                    message.failed ? "border-rust text-sand" : "border-line-strong"
                  }`
            }
          >
            <span className="sr-only">{message.from === "customer" ? "Вие: " : "Асистент: "}</span>
            <Formatted text={message.text} />
          </p>
        ))}
        {waiting && <p className="mr-8 border-l-2 border-line-strong px-3 py-2 text-sm text-muted">Асистентът пише…</p>}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="chat-message" className="sr-only">
          Вашето съобщение
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-message"
            ref={input}
            className="input min-h-12 flex-1 resize-none"
            rows={2}
            maxLength={MAX_MESSAGE}
            placeholder="Напишете съобщение…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button type="submit" className="btn min-h-12 px-4" disabled={waiting || !draft.trim()}>
            Изпрати
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Отговаря AI асистент. Данните се обработват според{" "}
          <Link href="/poveritelnost" className="underline underline-offset-4 hover:text-paper">
            политиката за поверителност
          </Link>
          .
        </p>
      </form>
    </section>
  );
}
