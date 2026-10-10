import { currentUserId } from "@/lib/auth";
import { listOutings } from "@/server/data";
import { LinkButton } from "@/components/ui/Button";
import { DiscoverView } from "./DiscoverView";

export const metadata = { title: "Discover" };

type SearchParams = Record<string, string | undefined>;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const userId = await currentUserId();

  const outings = await listOutings(
    {
      q: params.q,
      category: params.category,
      when: (params.when as "now" | "today" | "tomorrow" | "week" | undefined) ?? "any",
      hereNowOnly: params.here === "1",
    },
    userId,
  );

  return (
    <div className="container-page py-8">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Discover</h1>
          <p className="text-[13.5px] text-ink-faint mt-1">Activities happening near you, hosted by real people.</p>
        </div>
        <LinkButton href="/people/new" size="sm">
          + Post an activity
        </LinkButton>
      </div>

      <DiscoverView outings={outings} />
    </div>
  );
}
