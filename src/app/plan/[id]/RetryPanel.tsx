"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { regeneratePlan } from "@/server/plans";

export function RetryPanel({ planId, message }: { planId: string; message?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <EmptyState
      emoji="🌧️"
      title="We couldn't generate this plan"
      body={message ?? "Something went wrong while planning. You can try again."}
      action={
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await regeneratePlan(planId);
              router.refresh();
            })
          }
        >
          {pending ? "Trying again…" : "Try again"}
        </Button>
      }
    />
  );
}
