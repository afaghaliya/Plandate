"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { respondToRequest } from "@/server/outings";
import type { OutingDetail } from "@/server/data";

export function RequestsList({ requests }: { requests: OutingDetail["requests"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  function respond(id: string, decision: "accept" | "decline") {
    startTransition(async () => {
      const result = await respondToRequest(id, decision);
      if (!result.ok && result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <div key={req.participantId} className="rounded-xl border border-line p-3">
          <div className="flex items-start gap-2.5">
            <Link href={`/profile/${req.userId}`}>
              <Avatar name={req.name} image={req.image} size={38} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/profile/${req.userId}`} className="font-bold text-[13.5px] hover:underline">
                  {req.name}
                </Link>
                {req.verification !== "none" && <Chip tone="success">✓</Chip>}
                <Chip tone="teal">{req.matchScore}% match</Chip>
              </div>
              {req.matchWhy.length > 0 && (
                <p className="text-[11.5px] text-ink-faint mt-0.5">{req.matchWhy.join(" · ")}</p>
              )}
              {req.message && <p className="text-[12.5px] text-ink-soft mt-1.5">&ldquo;{req.message}&rdquo;</p>}
              <p className="text-[11px] text-ink-faint mt-1">{req.outingsDone} outings on Planadate</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2.5">
            <Button size="sm" disabled={pending} onClick={() => respond(req.participantId, "accept")}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => respond(req.participantId, "decline")}>
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
