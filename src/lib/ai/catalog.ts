import type { Activity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseStringList } from "@/lib/json";
import { BUDGET_CEILING, type BudgetTier, type GroupType } from "@/lib/domain";
import { cityKey, distanceKm, type GeoPoint } from "@/lib/geo";
import { minutesFromMidnight, partOfDay } from "@/lib/time";

export type PlanInput = {
  location: string;
  point: GeoPoint | null;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  groupType: GroupType;
  adults: number;
  children: number;
  childAges: number[];
  budgetTier: BudgetTier;
  budgetPerPerson: number | null;
  interests: string[];
  surpriseMe: boolean;
  radiusKm: number;
  notes: string | null;
};

export type Candidate = {
  activity: Activity;
  tags: string[];
  suitableFor: string[];
  bestTimes: string[];
  distanceKm: number | null;
  score: number;
  reasons: string[];
};

export function budgetCeiling(input: Pick<PlanInput, "budgetTier" | "budgetPerPerson">): number {
  if (input.budgetTier === "custom") {
    return input.budgetPerPerson && input.budgetPerPerson > 0 ? input.budgetPerPerson : 2500;
  }
  return BUDGET_CEILING[input.budgetTier];
}

export function groupSize(input: Pick<PlanInput, "adults" | "children">): number {
  return Math.max(1, input.adults + input.children);
}

/**
 * Deterministic retrieval + ranking. The LLM only ever chooses from what this
 * returns, which is why it cannot invent venues, prices or coordinates.
 */
export async function findCandidates(input: PlanInput, limit = 30): Promise<Candidate[]> {
  const key = cityKey(input.location);
  const rows = await prisma.activity.findMany({
    where: {
      OR: [
        { city: { contains: key } },
        { locationName: { contains: key } },
      ],
    },
  });

  // Fall back to a radius search when the city name isn't in the catalogue.
  const pool = rows.length > 0 || !input.point ? rows : await prisma.activity.findMany();

  const ceiling = budgetCeiling(input);
  const hasKids = input.children > 0;
  const youngestChild = input.childAges.length ? Math.min(...input.childAges) : hasKids ? 6 : null;
  const timeOfDay = partOfDay(input.startTime);
  const startMinute = minutesFromMidnight(input.startTime);
  const multiDay = input.durationMinutes > 14 * 60;

  const scored: Candidate[] = [];

  for (const activity of pool) {
    const tags = parseStringList(activity.tags);
    const suitableFor = parseStringList(activity.suitableFor);
    const bestTimes = parseStringList(activity.bestTimes);

    const dist = input.point
      ? distanceKm(input.point, { lat: activity.lat, lng: activity.lng })
      : null;

    // Hard filters -------------------------------------------------------
    if (dist !== null && dist > Math.max(input.radiusKm, multiDay ? 60 : 5)) continue;
    if (hasKids && !activity.kidFriendly) continue;
    if (input.budgetTier === "free" && activity.costPerPerson > 0) continue;
    if (activity.costPerPerson > ceiling * 1.35) continue;
    if (!multiDay && activity.durationMinutes > input.durationMinutes) continue;

    // Soft scoring -------------------------------------------------------
    let score = 20;
    const reasons: string[] = [];

    if (!input.surpriseMe && input.interests.length) {
      const matched = [activity.category, ...tags].filter((t) => input.interests.includes(t));
      if (matched.length === 0) {
        score -= 22;
      } else {
        score += 26 + (matched.length - 1) * 6;
        reasons.push(`matches your ${matched[0].replace(/_/g, " ")} interest`);
      }
    }

    if (suitableFor.includes(input.groupType)) {
      score += 20;
      reasons.push("suits your group type");
    } else if (suitableFor.length) {
      score -= 8;
    }

    if (hasKids && activity.kidFriendly) {
      score += 14;
      if (youngestChild !== null && youngestChild <= 5 && activity.durationMinutes <= 120) {
        score += 6;
        reasons.push("short enough for a young child");
      }
    }

    if (activity.costPerPerson <= ceiling) {
      score += 12;
    } else {
      score -= 14;
      reasons.push("slightly above your budget");
    }

    if (bestTimes.includes("any") || bestTimes.includes(timeOfDay)) {
      score += 10;
    } else if (!multiDay) {
      score -= 10;
    }

    // Opening hours vs. the actual window.
    if (!multiDay) {
      const endMinute = startMinute + input.durationMinutes;
      const overlaps = activity.openFrom < endMinute && activity.openTo > startMinute;
      if (!overlaps) continue;
    }

    if (dist !== null) {
      score += Math.max(-12, 10 - dist * 0.8);
    }

    if (activity.bookingRequired) score -= 4;

    scored.push({ activity, tags, suitableFor, bestTimes, distanceKm: dist, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.activity.name.localeCompare(b.activity.name));
  return scored.slice(0, limit);
}

/** Compact, token-cheap catalogue view handed to the model. */
export function candidatesForPrompt(candidates: Candidate[]) {
  return candidates.map((c) => ({
    slug: c.activity.slug,
    name: c.activity.name,
    category: c.activity.category,
    tags: c.tags,
    where: c.activity.locationName,
    minutes: c.activity.durationMinutes,
    cost_per_person: c.activity.costPerPerson,
    currency: c.activity.currency,
    kid_friendly: c.activity.kidFriendly,
    indoor: c.activity.indoor,
    best_times: c.bestTimes,
    open: `${fmtMinutes(c.activity.openFrom)}-${fmtMinutes(c.activity.openTo)}`,
    booking_required: c.activity.bookingRequired,
    suits: c.suitableFor,
    km_from_centre: c.distanceKm === null ? null : Number(c.distanceKm.toFixed(1)),
    blurb: c.activity.description,
  }));
}

function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
