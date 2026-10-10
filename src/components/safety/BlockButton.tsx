"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { blockUser, unblockUser } from "@/server/safety";

export function BlockButton({ targetUserId, blocked }: { targetUserId: string; blocked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={blocked ? "secondary" : "ghost"}
      size="sm"
      className={blocked ? "" : "text-danger"}
      disabled={pending}
      onClick={() => {
        if (!blocked && !confirm("Block this person? You won't see each other's activities.")) return;
        startTransition(async () => {
          await (blocked ? unblockUser(targetUserId) : blockUser(targetUserId));
          router.refresh();
        });
      }}
    >
      {blocked ? "Unblock" : "🚫 Block"}
    </Button>
  );
}
