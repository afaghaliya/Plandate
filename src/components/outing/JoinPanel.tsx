"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { cancelOuting, leaveOuting, requestToJoin } from "@/server/outings";

export function JoinPanel({
  outingId,
  viewerStatus,
  full,
}: {
  outingId: string;
  viewerStatus: "host" | "accepted" | "pending" | "declined" | "none";
  full: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  if (viewerStatus === "host") {
    return (
      <Button
        variant="danger"
        className="w-full"
        disabled={pending}
        onClick={() => act(() => cancelOuting(outingId), "Cancel this activity for everyone?")}
      >
        Cancel activity
      </Button>
    );
  }

  if (viewerStatus === "accepted") {
    return (
      <Button
        variant="secondary"
        className="w-full"
        disabled={pending}
        onClick={() => act(() => leaveOuting(outingId), "Leave this activity?")}
      >
        Leave activity
      </Button>
    );
  }

  if (viewerStatus === "pending") {
    return <Notice tone="info">Your request is with the host — you&apos;ll see it here once they respond.</Notice>;
  }

  if (viewerStatus === "declined") {
    return <Notice tone="warning">The host declined this request.</Notice>;
  }

  return (
    <div className="space-y-3">
      {error && <Notice tone="danger">{error}</Notice>}
      {full ? (
        <Notice tone="warning">This activity is full.</Notice>
      ) : (
        <>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say hi — anything the host should know? (optional)"
            maxLength={400}
          />
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => act(() => requestToJoin(outingId, message))}
          >
            {pending ? "Sending…" : "Request to join"}
          </Button>
        </>
      )}
    </div>
  );
}
