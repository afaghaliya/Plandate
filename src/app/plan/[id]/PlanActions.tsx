"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deletePlan, regeneratePlan, savePlan } from "@/server/plans";

export function PlanActions({ planId, status }: { planId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function run(action: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(action);
    startTransition(async () => {
      const result = await fn();
      setBusy(null);
      if (!result.ok && result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "saved" && (
        <Button size="sm" onClick={() => run("save", () => savePlan(planId))} disabled={pending}>
          {busy === "save" ? "Saving…" : "💾 Save plan"}
        </Button>
      )}
      {status === "saved" && <Button size="sm" disabled variant="secondary">✓ Saved</Button>}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => run("regenerate", () => regeneratePlan(planId))}
        disabled={pending}
      >
        {busy === "regenerate" ? "Regenerating…" : "🔄 Regenerate"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-danger"
        onClick={() => {
          if (confirm("Delete this plan? This can't be undone.")) {
            setBusy("delete");
            startTransition(async () => {
              const result = await deletePlan(planId);
              if (!result.ok && result.error) alert(result.error);
              else router.push("/plans");
            });
          }
        }}
        disabled={pending}
      >
        {busy === "delete" ? "Deleting…" : "Delete"}
      </Button>
    </div>
  );
}
