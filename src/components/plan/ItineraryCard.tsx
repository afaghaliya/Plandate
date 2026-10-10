"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatClock } from "@/lib/time";
import { formatPerPerson } from "@/lib/money";
import { interestLabel } from "@/lib/domain";
import type { Itinerary } from "@/lib/ai/schema";
import { editPlanItem } from "@/server/plans";
import { createOutingFromPlanItem } from "@/server/outings";

type ItineraryItem = Itinerary["days"][number]["items"][number];

export function ItineraryCard({
  planId,
  item,
  alternatives,
  isFirst,
  isLast,
  outing,
}: {
  planId: string;
  item: ItineraryItem;
  alternatives: Itinerary["alternatives"];
  isFirst: boolean;
  isLast: boolean;
  outing?: { id: string; goingCount: number; capacity: number; status: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [replacing, setReplacing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  function run(action: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyAction(action);
    startTransition(async () => {
      const result = await fn();
      setBusyAction(null);
      if (!result.ok && result.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <div className="relative pl-14 sm:pl-20">
      <div className="absolute left-0 top-0 w-14 sm:w-20 flex flex-col items-center">
        <span className="text-[11px] sm:text-[12.5px] font-bold text-ink-soft tabular-nums pt-4">
          {formatClock(new Date(item.startTime))}
        </span>
        <span className="mt-1.5 size-3 rounded-full bg-brand ring-4 ring-paper" aria-hidden />
        {!isLast && <span className="w-px flex-1 timeline-rail opacity-30 mt-1" aria-hidden />}
      </div>

      <Card className="mb-4 animate-fade">
        <CardBody>
          {item.travelMinutesFromPrevious > 0 && (
            <p className="text-[11.5px] text-ink-faint mb-2 flex items-center gap-1">
              🚗 {item.travelMinutesFromPrevious} min travel ({item.distanceKmFromPrevious} km)
            </p>
          )}

          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none" aria-hidden>
              {item.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold leading-snug">{item.title}</h3>
              <p className="text-[12.5px] text-ink-faint mt-0.5">📍 {item.locationName}</p>
            </div>
            <span className="text-[12.5px] font-bold text-ink-soft shrink-0">
              {item.durationMinutes >= 60
                ? `${(item.durationMinutes / 60).toFixed(item.durationMinutes % 60 ? 1 : 0)} hr`
                : `${item.durationMinutes} min`}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <Chip tone="brand">{formatPerPerson(item.costPerPerson, item.currency)}</Chip>
            {item.tags.slice(0, 3).map((tag) => (
              <Chip key={tag}>{interestLabel(tag)}</Chip>
            ))}
            {item.bookingRequired && <Chip tone="amber">Booking required</Chip>}
          </div>

          <p className="text-[13px] text-ink-soft mt-3 leading-relaxed">
            <span className="font-semibold text-ink">Why: </span>
            {item.why}
          </p>
          {item.note && <p className="text-[12.5px] text-ink-faint mt-1.5 italic">{item.note}</p>}

          {(item.kind === "activity" || item.kind === "food") && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-line">
              <Button
                size="sm"
                variant="teal"
                disabled={pending}
                onClick={() =>
                  outing
                    ? router.push(`/outings/${outing.id}`)
                    : run("find", async () => {
                        const result = await createOutingFromPlanItem(planId, item.id);
                        if (result.ok) router.push(`/outings/${result.data.outingId}`);
                        return result;
                      })
                }
              >
                {busyAction === "find" ? "Opening…" : outing ? `👥 ${outing.goingCount}/${outing.capacity} going` : "👥 Find people"}
              </Button>
              {alternatives.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setReplacing(true)} disabled={pending}>
                  🔁 Replace
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={pending || isFirst}
                onClick={() => run("up", () => editPlanItem(planId, { type: "move", itemId: item.id, direction: "up" }))}
              >
                ↑ Move
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending || isLast}
                onClick={() => run("down", () => editPlanItem(planId, { type: "move", itemId: item.id, direction: "down" }))}
              >
                ↓ Move
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Remove ${item.title} from the plan?`)) {
                    run("remove", () => editPlanItem(planId, { type: "remove", itemId: item.id }));
                  }
                }}
              >
                ✕ Remove
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={replacing} onClose={() => setReplacing(false)} title={`Replace ${item.title}`}>
        <div className="space-y-2">
          {alternatives.map((alt) => (
            <button
              key={alt.activitySlug}
              disabled={pending}
              onClick={() => {
                setReplacing(false);
                run("replace", () =>
                  editPlanItem(planId, { type: "replace", itemId: item.id, withSlug: alt.activitySlug }),
                );
              }}
              className="w-full text-left rounded-xl border border-line p-3 hover:border-brand hover:bg-brand-soft/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[13.5px] flex items-center gap-1.5">
                  <span aria-hidden>{alt.emoji}</span> {alt.title}
                </span>
                <span className="text-[12px] font-bold text-ink-soft">
                  {formatPerPerson(alt.costPerPerson, alt.currency)}
                </span>
              </div>
              <p className="text-[12.5px] text-ink-faint mt-1">{alt.why}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
