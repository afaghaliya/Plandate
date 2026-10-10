"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { askPlanAssistant } from "@/server/plans";

const SUGGESTIONS = [
  "Make it cheaper",
  "We have a 5-year-old with us",
  "More food options",
  "Remove the busiest stop",
  "Don't want an early start",
  "Add more adventure",
];

export function PlanAssistant({ planId }: { planId: string }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await askPlanAssistant(planId, trimmed);
      if (!result.ok) {
        setFeedback({ tone: "danger", text: result.error });
        return;
      }
      setInstruction("");
      setFeedback({
        tone: "success",
        text: result.data.changeSummary ?? "Updated your plan.",
      });
      router.refresh();
    });
  }

  return (
    <Card className="sticky top-20">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            💬
          </span>
          <h3 className="font-bold">Tweak this plan</h3>
        </div>
        <p className="text-[12.5px] text-ink-faint -mt-2">
          Tell the assistant what to change — it edits only what you ask.
        </p>

        {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(instruction);
          }}
          className="flex gap-2"
        >
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Make it cheaper"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !instruction.trim()}>
            {pending ? "…" : "Go"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => send(s)}
              className="text-[11.5px] font-semibold rounded-full border border-line px-2.5 py-1 text-ink-soft hover:border-brand hover:text-brand transition-colors disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
