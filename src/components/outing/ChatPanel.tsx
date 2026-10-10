"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { formatRelative } from "@/lib/time";
import { sendMessage } from "@/server/chat";
import type { ChatMessage } from "@/server/data";

const POLL_MS = 4000;

export function ChatPanel({
  outingId,
  initialMessages,
  closed,
}: {
  outingId: string;
  initialMessages: ChatMessage[];
  closed: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [isClosed, setIsClosed] = useState(closed);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/outings/${outingId}/messages`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setMessages(data.messages);
        setIsClosed(data.closed);
      } catch {
        // Transient network hiccup -- next poll will retry.
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [outingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const result = await sendMessage(outingId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft("");
      const res = await fetch(`/api/outings/${outingId}/messages`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    });
  }

  return (
    <div className="flex flex-col h-[28rem]">
      <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2">
        {messages.map((message) =>
          message.isSystem ? (
            <p key={message.id} className="text-center text-[11.5px] text-ink-faint">
              {message.body}
            </p>
          ) : (
            <div key={message.id} className="flex items-start gap-2">
              <Avatar name={message.sender?.name ?? "?"} image={message.sender?.image} size={26} />
              <div className="min-w-0">
                <p className="text-[12px] font-bold">
                  {message.sender?.name}{" "}
                  <span className="font-normal text-ink-faint">{formatRelative(new Date(message.createdAt))}</span>
                </p>
                <p className="text-[13px] text-ink-soft break-words">{message.body}</p>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {error && <Notice tone="danger" className="mb-2">{error}</Notice>}

      {isClosed ? (
        <Notice tone="warning">This chat is closed — the activity has ended.</Notice>
      ) : (
        <form
          className="flex gap-2 pt-2 border-t border-line"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the group…"
            disabled={pending}
            maxLength={1000}
          />
          <Button type="submit" disabled={pending || !draft.trim()}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
