import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { listMyPlans } from "@/server/data";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { GROUP_EMOJI, GROUP_LABELS, type GroupType } from "@/lib/domain";
import { formatWhen, formatDuration } from "@/lib/time";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "My Plans" };

const STATUS_TONE: Record<string, "brand" | "success" | "danger" | "neutral"> = {
  generating: "brand",
  ready: "neutral",
  saved: "success",
  failed: "danger",
};

export default async function PlansPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?from=%2Fplans");

  const plans = await listMyPlans(userId);

  return (
    <div className="container-page py-8">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">My Plans</h1>
          <p className="text-[13.5px] text-ink-faint mt-1">Everything you&apos;ve planned, generated or saved.</p>
        </div>
        <LinkButton href="/plan">+ New plan</LinkButton>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          emoji="🗺️"
          title="No plans yet"
          body="Tell us where you're going and we'll put together a full itinerary."
          action={<LinkButton href="/plan">Plan an outing</LinkButton>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/plan/${plan.id}`}>
              <Card className="h-full hover:shadow-raised hover:-translate-y-0.5 transition-all">
                <CardBody>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Chip tone={STATUS_TONE[plan.status] ?? "neutral"}>
                      {plan.status === "generating" ? "Generating…" : plan.status}
                    </Chip>
                    <Chip>
                      {GROUP_EMOJI[plan.groupType as GroupType] ?? "✨"} {GROUP_LABELS[plan.groupType as GroupType] ?? plan.groupType}
                    </Chip>
                  </div>
                  <h3 className="font-bold leading-snug line-clamp-2">{plan.title}</h3>
                  <p className="text-[12.5px] text-ink-faint mt-1">📍 {plan.location}</p>
                  <p className="text-[12.5px] text-ink-faint mt-0.5">{formatWhen(new Date(plan.startTime))}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                    <span className="text-[12px] text-ink-soft">
                      {formatDuration(plan.durationMinutes)} · {plan.itemCount} stops
                    </span>
                    {plan.costPerPerson > 0 && (
                      <span className="text-[12px] font-bold text-brand-ink">
                        {formatMoney(plan.costPerPerson)}/person
                      </span>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
