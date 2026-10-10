"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Field";
import { RadioChip } from "@/components/ui/Chip";
import { INTEREST_CATEGORIES, interestEmoji, interestLabel } from "@/lib/domain";

const WHEN_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "now", label: "Next 3 hrs" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This week" },
];

export function DiscoverFilters({ view, onToggleView }: { view: "list" | "map"; onToggleView: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => router.push(`/discover?${params.toString()}`));
  }

  const category = searchParams.get("category") ?? "";
  const when = searchParams.get("when") ?? "any";
  const hereNowOnly = searchParams.get("here") === "1";

  return (
    <div className="space-y-3.5">
      <div className="flex gap-2">
        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q });
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activities, places…"
            aria-label="Search activities"
          />
        </form>
        <button
          type="button"
          onClick={onToggleView}
          className="shrink-0 rounded-xl border border-line px-4 text-[13px] font-bold text-ink-soft hover:bg-surface-2"
        >
          {view === "list" ? "🗺️ Map" : "☰ List"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {WHEN_OPTIONS.map((opt) => (
          <RadioChip
            key={opt.value}
            label={opt.label}
            checked={when === opt.value}
            onChange={() => update({ when: opt.value === "any" ? null : opt.value })}
          />
        ))}
        <RadioChip
          label="📍 Happening now"
          checked={hereNowOnly}
          onChange={() => update({ here: hereNowOnly ? null : "1" })}
        />
      </div>

      <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar pb-1">
        <RadioChip label="All types" checked={!category} onChange={() => update({ category: null })} />
        {INTEREST_CATEGORIES.map((interest) => (
          <RadioChip
            key={interest}
            label={interestLabel(interest)}
            emoji={interestEmoji(interest)}
            checked={category === interest}
            onChange={() => update({ category: interest })}
          />
        ))}
      </div>
    </div>
  );
}
