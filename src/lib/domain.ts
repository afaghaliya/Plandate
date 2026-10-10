/**
 * Shared vocabulary for the product. These are plain string unions rather than
 * database enums so the Prisma schema stays portable between SQLite (dev) and
 * PostgreSQL (prod). Anything the LLM is allowed to emit is constrained to
 * these lists at validation time.
 */

export const INTEREST_CATEGORIES = [
  "adventure",
  "nature",
  "beaches",
  "food",
  "cafes",
  "shopping",
  "nightlife",
  "photography",
  "sports",
  "hiking",
  "cycling",
  "art_culture",
  "history",
  "entertainment",
  "relaxation",
  "romantic",
  "kids",
  "events",
  "hidden_gems",
  "local_experiences",
] as const;
export type InterestCategory = (typeof INTEREST_CATEGORIES)[number];

export const INTEREST_LABELS: Record<InterestCategory, string> = {
  adventure: "Adventure",
  nature: "Nature",
  beaches: "Beaches",
  food: "Food",
  cafes: "Cafes",
  shopping: "Shopping",
  nightlife: "Nightlife",
  photography: "Photography",
  sports: "Sports",
  hiking: "Hiking",
  cycling: "Cycling",
  art_culture: "Art & culture",
  history: "History",
  entertainment: "Entertainment",
  relaxation: "Relaxation",
  romantic: "Romantic",
  kids: "Kids activities",
  events: "Events",
  hidden_gems: "Hidden gems",
  local_experiences: "Local experiences",
};

export const INTEREST_EMOJI: Record<InterestCategory, string> = {
  adventure: "🪂",
  nature: "🌿",
  beaches: "🏖️",
  food: "🍽️",
  cafes: "☕",
  shopping: "🛍️",
  nightlife: "🌃",
  photography: "📷",
  sports: "🏸",
  hiking: "🥾",
  cycling: "🚲",
  art_culture: "🎨",
  history: "🏛️",
  entertainment: "🎬",
  relaxation: "🧘",
  romantic: "💞",
  kids: "🧸",
  events: "🎪",
  hidden_gems: "💎",
  local_experiences: "🧭",
};

export const GROUP_TYPES = [
  "solo",
  "couple",
  "friends",
  "family",
  "family_kids",
  "large_group",
  "seniors",
  "custom",
] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const GROUP_LABELS: Record<GroupType, string> = {
  solo: "Solo",
  couple: "Couple",
  friends: "Friends",
  family: "Family",
  family_kids: "Family with kids",
  large_group: "Large group",
  seniors: "Seniors",
  custom: "Custom",
};

export const GROUP_EMOJI: Record<GroupType, string> = {
  solo: "🚶",
  couple: "💑",
  friends: "🧑‍🤝‍🧑",
  family: "👨‍👩‍👧",
  family_kids: "🧒",
  large_group: "👥",
  seniors: "🧓",
  custom: "✨",
};

export const BUDGET_TIERS = ["free", "budget", "moderate", "premium", "custom"] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

export const BUDGET_LABELS: Record<BudgetTier, string> = {
  free: "Free",
  budget: "Budget",
  moderate: "Moderate",
  premium: "Premium",
  custom: "Custom",
};

/** Per-person ceiling in INR used to filter the activity catalogue. */
export const BUDGET_CEILING: Record<Exclude<BudgetTier, "custom">, number> = {
  free: 0,
  budget: 800,
  moderate: 2500,
  premium: 12000,
};

export const OUTING_STATUSES = ["open", "full", "closed", "expired", "cancelled"] as const;
export type OutingStatus = (typeof OUTING_STATUSES)[number];

export const PARTICIPANT_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "left",
  "removed",
] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const REPORT_REASONS = [
  "harassment",
  "unsafe_behaviour",
  "spam_or_scam",
  "fake_profile",
  "no_show",
  "inappropriate_content",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment or abuse",
  unsafe_behaviour: "Unsafe behaviour",
  spam_or_scam: "Spam or scam",
  fake_profile: "Fake or impersonated profile",
  no_show: "Didn't show up",
  inappropriate_content: "Inappropriate content",
  other: "Something else",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  none: "Unverified",
  email: "Email verified",
  id_verified: "ID verified",
};

/** Preset durations offered in the planner, in minutes. */
export const DURATION_PRESETS = [
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
  { label: "Half day", minutes: 300 },
  { label: "Full day", minutes: 600 },
  { label: "2 days", minutes: 2 * 24 * 60 },
  { label: "3 days", minutes: 3 * 24 * 60 },
] as const;

/** "I'm here now" request templates. */
export const HERE_NOW_TEMPLATES = [
  { label: "Grab coffee", category: "cafes", minutes: 60 },
  { label: "Play a sport", category: "sports", minutes: 120 },
  { label: "Explore the area", category: "local_experiences", minutes: 120 },
  { label: "Go for a walk", category: "nature", minutes: 60 },
  { label: "Take photos", category: "photography", minutes: 90 },
  { label: "Have lunch", category: "food", minutes: 90 },
  { label: "Watch the sunset", category: "nature", minutes: 90 },
  { label: "Explore nightlife", category: "nightlife", minutes: 180 },
  { label: "Join a group activity", category: "entertainment", minutes: 120 },
] as const;

export function isInterest(value: string): value is InterestCategory {
  return (INTEREST_CATEGORIES as readonly string[]).includes(value);
}

export function interestLabel(value: string): string {
  return isInterest(value) ? INTEREST_LABELS[value] : value.replace(/_/g, " ");
}

export function interestEmoji(value: string): string {
  return isInterest(value) ? INTEREST_EMOJI[value] : "📍";
}

export function groupLabel(value: string): string {
  return (GROUP_LABELS as Record<string, string>)[value] ?? value;
}
