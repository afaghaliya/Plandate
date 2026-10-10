import type { Outing, User } from "@prisma/client";
import { parseStringList } from "@/lib/json";
import { distanceKm, formatDistance, type GeoPoint } from "@/lib/geo";
import { minutesBetween } from "@/lib/time";

export type MatchInput = {
  user: Pick<User, "interests" | "birthYear" | "homeCity" | "verification">;
  point: GeoPoint | null;
  now?: Date;
};

export type MatchScore = { score: number; reasons: string[] };

/**
 * Match scoring is deliberately deterministic and explainable -- it decides who
 * sees what, so it must be auditable and cannot depend on an LLM. The model is
 * only ever used to write copy, never to gate access.
 */
export function scoreMatch(
  outing: Pick<
    Outing,
    "category" | "lat" | "lng" | "startTime" | "endTime" | "minAge" | "maxAge" | "city" | "isHereNow"
  >,
  input: MatchInput,
): MatchScore {
  const now = input.now ?? new Date();
  const interests = parseStringList(input.user.interests);
  const reasons: string[] = [];
  let score = 40;

  if (interests.includes(outing.category)) {
    score += 25;
    reasons.push(`You're into ${outing.category.replace(/_/g, " ")}`);
  }

  if (input.point) {
    const km = distanceKm(input.point, { lat: outing.lat, lng: outing.lng });
    if (km <= 2) {
      score += 20;
      reasons.push(`${formatDistance(km)} away`);
    } else if (km <= 10) {
      score += 12;
      reasons.push(`${formatDistance(km)} away`);
    } else if (km <= 30) {
      score += 4;
    } else {
      score -= 10;
    }
  } else if (input.user.homeCity && outing.city.toLowerCase().includes(input.user.homeCity.toLowerCase())) {
    score += 10;
    reasons.push("In your city");
  }

  const minutesUntil = minutesBetween(now, outing.startTime);
  if (minutesUntil < 0) {
    score -= 25;
  } else if (outing.isHereNow && minutesUntil <= 120) {
    score += 18;
    reasons.push("Happening right now");
  } else if (minutesUntil <= 24 * 60) {
    score += 12;
    reasons.push("Happening today");
  } else if (minutesUntil <= 72 * 60) {
    score += 6;
  }

  const age = input.user.birthYear ? now.getFullYear() - input.user.birthYear : null;
  if (age !== null && (outing.minAge || outing.maxAge)) {
    const okMin = outing.minAge === null || age >= outing.minAge;
    const okMax = outing.maxAge === null || age <= outing.maxAge;
    if (okMin && okMax) {
      score += 8;
      reasons.push("Matches the age range");
    } else {
      score -= 40;
    }
  }

  if (input.user.verification !== "none") score += 3;

  return { score: clamp(score, 0, 100), reasons: reasons.slice(0, 3) };
}

/** True when this user is eligible to see/join at all (hard constraints). */
export function isEligible(
  outing: Pick<Outing, "minAge" | "maxAge">,
  user: Pick<User, "birthYear">,
  now = new Date(),
): { eligible: boolean; reason: string | null } {
  if (outing.minAge === null && outing.maxAge === null) return { eligible: true, reason: null };
  if (!user.birthYear) {
    return { eligible: true, reason: null };
  }
  const age = now.getFullYear() - user.birthYear;
  if (outing.minAge !== null && age < outing.minAge) {
    return { eligible: false, reason: `This outing is for ${outing.minAge}+ only.` };
  }
  if (outing.maxAge !== null && age > outing.maxAge) {
    return { eligible: false, reason: `This outing is for up to age ${outing.maxAge}.` };
  }
  return { eligible: true, reason: null };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
