import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getPlanDetail } from "@/server/data";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Notice, Spinner } from "@/components/ui/Feedback";
import { formatWhen, formatDuration } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { GROUP_EMOJI, GROUP_LABELS, interestEmoji, interestLabel, type GroupType } from "@/lib/domain";
import { ItineraryCard } from "@/components/plan/ItineraryCard";
import { PlanAssistant } from "@/components/plan/PlanAssistant";
import { PlanActions } from "./PlanActions";
import { RetryPanel } from "./RetryPanel";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  if (!userId) redirect(`/signin?from=${encodeURIComponent(`/plan/${id}`)}`);

  const plan = await getPlanDetail(id, userId);
  if (!plan) notFound();

  const start = new Date(plan.startTime);

  return (
    <div className="container-page py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Chip tone="brand">
            {GROUP_EMOJI[plan.groupType as GroupType] ?? "✨"} {GROUP_LABELS[plan.groupType as GroupType] ?? plan.groupType}
          </Chip>
          <Chip>📍 {plan.location}</Chip>
          <Chip>🗓️ {formatWhen(start)}</Chip>
          <Chip>⏱ {formatDuration(plan.durationMinutes)}</Chip>
          {plan.itinerary && (
            <Chip tone="success">
              💰 {formatMoney(plan.itinerary.totals.costPerPerson)}/person
            </Chip>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">{plan.title}</h1>
        {plan.itinerary?.summary && (
          <p className="text-[13.5px] text-ink-soft mt-2 max-w-2xl leading-relaxed">{plan.itinerary.summary}</p>
        )}
        <div className="mt-4">
          <PlanActions planId={plan.id} status={plan.status} />
        </div>
      </header>

      {plan.status === "generating" && (
        <Card>
          <CardBody className="flex items-center gap-3 py-10 justify-center">
            <Spinner className="text-brand size-5" />
            <p className="font-semibold text-ink-soft">Building your plan…</p>
          </CardBody>
        </Card>
      )}

      {plan.status === "failed" && <RetryPanel planId={plan.id} />}

      {plan.itinerary && (
        <div className="grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
          <div>
            {plan.itinerary.generator?.includes("deterministic") && (
              <Notice tone="info" className="mb-5">
                This plan was built by Planadate&apos;s offline planner (no AI key configured), so it&apos;s a
                little more mechanical than the AI version — everything else works the same.
              </Notice>
            )}

            {plan.itinerary.warnings.length > 0 && (
              <Notice tone="warning" className="mb-5">
                {plan.itinerary.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </Notice>
            )}

            {plan.itinerary.days.map((day) => (
              <section key={day.index} className="mb-8">
                {plan.itinerary!.days.length > 1 && (
                  <h2 className="font-extrabold text-lg mb-3">{day.label}</h2>
                )}
                {day.items.map((item, index) => (
                  <ItineraryCard
                    key={item.id}
                    planId={plan.id}
                    item={item}
                    alternatives={plan.itinerary!.alternatives}
                    isFirst={index === 0}
                    isLast={index === day.items.length - 1}
                    outing={plan.outingsByItem[item.id]}
                  />
                ))}
              </section>
            ))}

            {plan.itinerary.alternatives.length > 0 && (
              <section>
                <h2 className="font-extrabold text-lg mb-3">Also worth considering</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {plan.itinerary.alternatives.map((alt) => (
                    <Card key={alt.activitySlug}>
                      <CardBody className="py-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[13.5px] flex items-center gap-1.5">
                            <span aria-hidden>{alt.emoji}</span> {alt.title}
                          </span>
                          <Chip>{interestEmoji(alt.category)} {interestLabel(alt.category)}</Chip>
                        </div>
                        <p className="text-[12.5px] text-ink-faint mt-1.5">{alt.why}</p>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {plan.itinerary.tips.length > 0 && (
              <section className="mt-8">
                <h2 className="font-extrabold text-lg mb-3">Tips</h2>
                <ul className="space-y-2">
                  {plan.itinerary.tips.map((tip) => (
                    <li key={tip} className="text-[13px] text-ink-soft flex gap-2">
                      <span aria-hidden>💡</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside>
            <PlanAssistant planId={plan.id} />
          </aside>
        </div>
      )}
    </div>
  );
}
