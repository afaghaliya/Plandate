import type { Activity } from "@prisma/client";
import { parseStringList } from "@/lib/json";
import { addMinutes, minutesBetween } from "@/lib/time";
import { distanceKm, travelMinutes } from "@/lib/geo";
import type { PlanInput, Candidate } from "./catalog";
import { groupSize } from "./catalog";
import type {
  Itinerary,
  ItineraryAlternative,
  ItineraryDay,
  ItineraryItem,
  PlanDraft,
  PlanDraftEntry,
} from "./schema";

const KIND_DEFAULT_MINUTES: Record<string, number> = {
  activity: 90,
  food: 75,
  break: 30,
  travel: 20,
  custom: 60,
};

const KIND_EMOJI: Record<string, string> = {
  activity: "🎯",
  food: "🍽️",
  break: "☕",
  travel: "🚗",
  custom: "📍",
};

const DAY_DEFAULT_START_HOUR = 9;
const DAY_DEFAULT_END_HOUR = 21;

/**
 * Turns a model draft into the stored itinerary. All clock arithmetic, travel
 * estimates, costs and window clamping happen here -- deterministically -- so
 * a plausible-but-wrong number can never reach the user.
 */
export function assembleItinerary(
  draft: PlanDraft,
  candidates: Candidate[],
  input: PlanInput,
  generator: string,
): Itinerary {
  const bySlug = new Map(candidates.map((c) => [c.activity.slug, c.activity]));
  const warnings = [...draft.warnings];
  const days: ItineraryDay[] = [];

  let activityMinutes = 0;
  let travelTotal = 0;
  let costPerPerson = 0;
  let itemCount = 0;

  const dayCount = Math.max(1, draft.days.length);

  draft.days.forEach((draftDay, dayIndex) => {
    const { dayStart, dayEnd } = dayWindow(input, dayIndex, dayCount);
    let cursor = new Date(dayStart);
    let previous: Activity | null = null;
    const items: ItineraryItem[] = [];
    let droppedInDay = 0;

    draftDay.entries.forEach((entry, entryIndex) => {
      const activity = entry.slug ? bySlug.get(entry.slug) ?? null : null;
      if (entry.slug && !activity) {
        // The model referenced something outside the candidate set: drop it
        // rather than fabricating a venue.
        droppedInDay += 1;
        return;
      }

      const requested = entry.durationMinutes ?? activity?.durationMinutes ?? KIND_DEFAULT_MINUTES[entry.kind] ?? 60;

      const travel =
        previous && activity
          ? travelMinutes(
              distanceKm(
                { lat: previous.lat, lng: previous.lng },
                { lat: activity.lat, lng: activity.lng },
              ),
            )
          : 0;
      const distance =
        previous && activity
          ? distanceKm(
              { lat: previous.lat, lng: previous.lng },
              { lat: activity.lat, lng: activity.lng },
            )
          : 0;

      const remaining = minutesBetween(addMinutes(cursor, travel), dayEnd);
      if (remaining <= 15) {
        droppedInDay += 1;
        return;
      }
      const duration = Math.min(requested, remaining);

      const start = addMinutes(cursor, travel);
      const end = addMinutes(start, duration);

      const cost = activity?.costPerPerson ?? 0;
      const tags = activity ? parseStringList(activity.tags) : [];

      items.push({
        id: `d${dayIndex}-i${entryIndex}-${entry.slug ?? entry.kind}`,
        kind: entry.kind,
        title: activity?.name ?? entry.title ?? titleForKind(entry),
        activityId: activity?.id ?? null,
        activitySlug: activity?.slug ?? null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes: duration,
        locationName: activity?.locationName ?? input.location,
        city: activity?.city ?? input.location,
        lat: activity?.lat ?? null,
        lng: activity?.lng ?? null,
        category: activity?.category ?? categoryForKind(entry.kind),
        tags,
        costPerPerson: cost,
        currency: activity?.currency ?? "INR",
        description: activity?.description ?? entry.note ?? "",
        why: entry.why,
        note: entry.note ?? activity?.tips ?? null,
        travelMinutesFromPrevious: travel,
        distanceKmFromPrevious: Number(distance.toFixed(2)),
        bookingRequired: activity?.bookingRequired ?? false,
        emoji: activity?.imageEmoji ?? KIND_EMOJI[entry.kind] ?? "📍",
      });

      if (duration < requested) {
        warnings.push(
          `${activity?.name ?? entry.title ?? "One stop"} was shortened to fit the time you have.`,
        );
      }

      activityMinutes += duration;
      travelTotal += travel;
      costPerPerson += cost;
      itemCount += 1;
      cursor = end;
      if (activity) previous = activity;
    });

    if (droppedInDay > 0) {
      warnings.push(
        `${droppedInDay} suggestion${droppedInDay > 1 ? "s" : ""} didn't fit ${
          dayCount > 1 ? draftDay.label : "your window"
        } and were moved to alternatives.`,
      );
    }

    days.push({
      index: dayIndex,
      label: draftDay.label || (dayCount > 1 ? `Day ${dayIndex + 1}` : "Your plan"),
      date: dayStart.toISOString(),
      items,
    });
  });

  const alternatives: ItineraryAlternative[] = [];
  const usedSlugs = new Set(
    days.flatMap((d) => d.items.map((i) => i.activitySlug).filter((s): s is string => !!s)),
  );

  for (const alt of draft.alternatives) {
    const activity = bySlug.get(alt.slug);
    if (!activity || usedSlugs.has(alt.slug)) continue;
    alternatives.push(toAlternative(activity, alt.why));
    usedSlugs.add(alt.slug);
  }
  // Top up alternatives from the ranked catalogue so "Replace" always works.
  for (const candidate of candidates) {
    if (alternatives.length >= 6) break;
    if (usedSlugs.has(candidate.activity.slug)) continue;
    alternatives.push(
      toAlternative(
        candidate.activity,
        candidate.reasons[0]
          ? `Also a good fit -- ${candidate.reasons[0]}.`
          : "Another strong option nearby.",
      ),
    );
    usedSlugs.add(candidate.activity.slug);
  }

  const size = groupSize(input);
  const budget = input.budgetPerPerson;
  if (budget && costPerPerson > budget) {
    warnings.push(
      `This plan comes to about ${costPerPerson} per person, over your ${budget} target. Ask the assistant to make it cheaper.`,
    );
  }

  return {
    version: 1,
    title: draft.title || `${input.location} plan`,
    summary: draft.summary,
    days,
    totals: {
      costPerPerson,
      costForGroup: costPerPerson * size,
      currency: "INR",
      activityMinutes,
      travelMinutes: travelTotal,
      itemCount,
    },
    tips: dedupe(draft.tips),
    warnings: dedupe(warnings),
    alternatives,
    changeSummary: draft.changeSummary ?? null,
    generatedAt: new Date().toISOString(),
    generator,
  };
}

function toAlternative(activity: Activity, why: string): ItineraryAlternative {
  return {
    activityId: activity.id,
    activitySlug: activity.slug,
    title: activity.name,
    locationName: activity.locationName,
    category: activity.category,
    durationMinutes: activity.durationMinutes,
    costPerPerson: activity.costPerPerson,
    currency: activity.currency,
    emoji: activity.imageEmoji,
    why,
  };
}

function dayWindow(input: PlanInput, dayIndex: number, dayCount: number) {
  const base = new Date(input.startTime);
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayIndex);

  const dayStart =
    dayIndex === 0
      ? new Date(input.startTime)
      : new Date(date.getFullYear(), date.getMonth(), date.getDate(), DAY_DEFAULT_START_HOUR, 0, 0, 0);

  let dayEnd =
    dayIndex === dayCount - 1
      ? new Date(input.endTime)
      : new Date(date.getFullYear(), date.getMonth(), date.getDate(), DAY_DEFAULT_END_HOUR, 0, 0, 0);

  if (dayEnd.getTime() <= dayStart.getTime()) {
    dayEnd = addMinutes(dayStart, Math.min(input.durationMinutes, 10 * 60));
  }
  return { dayStart, dayEnd };
}

function titleForKind(entry: PlanDraftEntry): string {
  switch (entry.kind) {
    case "break":
      return "Rest & recharge";
    case "travel":
      return "Travel";
    case "food":
      return "Food stop";
    default:
      return "Free time";
  }
}

function categoryForKind(kind: string): string {
  if (kind === "food") return "food";
  if (kind === "break") return "relaxation";
  return "local_experiences";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v && v.trim().length > 0)));
}

/** How many days a draft should span for a given window. */
export function suggestedDayCount(input: PlanInput): number {
  // Driven by total duration, not by calendar-date crossing -- a 6-hour plan
  // that happens to start at 9pm and run past midnight is still one day, not
  // two. Only genuinely multi-day windows (> 14 hours) split into days.
  if (input.durationMinutes <= 14 * 60) return 1;
  const days = Math.ceil(input.durationMinutes / (24 * 60));
  return Math.min(7, Math.max(1, days));
}

/**
 * Inverse of `assembleItinerary` -- turns a stored itinerary back into a draft
 * so deterministic edits (remove / move / replace) and AI edits share one
 * re-assembly path. Clock times are always recomputed, never carried over.
 */
export function itineraryToDraft(itinerary: Itinerary): PlanDraft {
  return {
    title: itinerary.title,
    summary: itinerary.summary,
    days: itinerary.days.map((day) => ({
      label: day.label,
      entries: day.items.map((item) => ({
        slug: item.activitySlug,
        kind: item.kind,
        title: item.activitySlug ? null : item.title,
        durationMinutes: item.durationMinutes,
        why: item.why,
        note: item.note,
      })),
    })),
    tips: itinerary.tips,
    warnings: [],
    alternatives: itinerary.alternatives.map((alt) => ({ slug: alt.activitySlug, why: alt.why })),
    changeSummary: null,
  };
}
