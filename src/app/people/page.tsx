import { currentUserId } from "@/lib/auth";
import { listOutings } from "@/server/data";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { DiscoverView } from "@/app/discover/DiscoverView";

export const metadata = { title: "Find People" };

export default async function PeoplePage() {
  const userId = await currentUserId();
  const outings = await listOutings({ when: "week" }, userId);

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Find people</h1>
          <p className="text-[13.5px] text-ink-faint mt-1 max-w-xl">
            Company for the things you want to do — from a sunset trek to a coffee in twenty
            minutes. Join what&apos;s already happening, or post your own.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <LinkButton href="/here" variant="secondary">
            📍 I&apos;m here now
          </LinkButton>
          <LinkButton href="/people/new">+ Post an activity</LinkButton>
        </div>
      </div>

      <Card className="mb-6 bg-teal-soft/50 border-teal/20">
        <CardBody className="text-[13px] text-teal-ink flex items-center gap-3">
          <span className="text-xl" aria-hidden>
            🛟
          </span>
          <p>
            Activity-based, not permanent — join, chat while it&apos;s live, meet in public. See our{" "}
            <a href="/safety" className="font-bold underline">
              safety guidelines
            </a>
            .
          </p>
        </CardBody>
      </Card>

      <DiscoverView outings={outings} />
    </div>
  );
}
