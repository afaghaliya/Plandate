"use client";

import { Suspense, useState } from "react";
import { DiscoverFilters } from "@/components/outing/DiscoverFilters";
import { OutingCard } from "@/components/outing/OutingCard";
import { OutingsMap } from "@/components/map/OutingsMap";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import type { OutingCardData } from "@/server/data";

export function DiscoverView({ outings }: { outings: OutingCardData[] }) {
  const [view, setView] = useState<"list" | "map">("list");

  return (
    <div>
      <Suspense>
        <DiscoverFilters view={view} onToggleView={() => setView((v) => (v === "list" ? "map" : "list"))} />
      </Suspense>

      <div className="mt-6">
        {outings.length === 0 ? (
          <EmptyState
            emoji="🧭"
            title="Nothing matches yet"
            body="Try widening the filters, or be the first to post something."
            action={<LinkButton href="/people/new">Post an activity</LinkButton>}
          />
        ) : view === "map" ? (
          <OutingsMap outings={outings} className="h-[32rem] rounded-[var(--radius-card)] overflow-hidden border border-line" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {outings.map((outing) => (
              <OutingCard key={outing.id} outing={outing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
