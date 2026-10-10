import {
  GROUP_LABELS,
  BUDGET_LABELS,
  interestLabel,
  type GroupType,
} from "@/lib/domain";
import { formatDuration, formatClock, partOfDay } from "@/lib/time";
import { candidatesForPrompt, findCandidates, budgetCeiling, groupSize, type Candidate, type PlanInput } from "./catalog";
import { assembleItinerary, suggestedDayCount } from "./assemble";
import {
  PLAN_DRAFT_JSON_SCHEMA,
  PlanDraftSchema,
  type Itinerary,
  type PlanDraft,
} from "./schema";
import { getLlmProvider, LlmUnavailableError } from "./provider";

const SYSTEM_PROMPT = `You are Planadate's outing planner.

Your job is to sequence a real, enjoyable outing from a fixed catalogue of
vetted places, and to explain each choice in terms of the specific group.

Hard rules:
- Only use "slug" values that appear in the CANDIDATES list. Never invent a
  place, a price, an address or a coordinate.
- Do not output clock times, dates, totals or travel times. The application
  computes all of those from your ordering. Only durations (in minutes) are
  yours to adjust, and only when the catalogue duration doesn't suit the group.
- Respect the time budget: the entries you list, plus travel between them, must
  plausibly fit the window described. Fewer, better-paced stops beat a
  packed list.
- Group fit is the point. A family with a 4-year-old, a couple, and four
  22-year-old friends must get visibly different plans and different reasons.
- Sequence sensibly: cluster nearby places, put food near meal times, put
  high-energy activity before rest, end on something relaxed or scenic.
- Include at least one food entry per ~5 hours of plan, and a "break" entry
  when the group has young children, seniors, or a day longer than 6 hours.
- "why" is one specific sentence about THIS group. Never generic filler.
- Put genuinely useful, checkable advice in "tips" (what to carry, when to
  arrive, cash vs card). Put real constraints in "warnings" (booking needed,
  weather exposure, closing times, unsuitable for young kids).
- Offer 3-5 "alternatives" from the catalogue that were not scheduled.

Write in warm, plain English. No marketing language.`;

function describeGroup(input: PlanInput): string {
  const label = GROUP_LABELS[input.groupType as GroupType] ?? input.groupType;
  const parts = [`${label} (${groupSize(input)} people total: ${input.adults} adult${input.adults === 1 ? "" : "s"}`];
  if (input.children > 0) {
    parts.push(
      `${input.children} child${input.children === 1 ? "" : "ren"}${
        input.childAges.length ? ` aged ${input.childAges.join(", ")}` : ""
      }`,
    );
  }
  return `${parts.join(", ")})`;
}

function buildPrompt(input: PlanInput, candidates: Candidate[], dayCount: number): string {
  return [
    "REQUEST",
    `- Location: ${input.location}`,
    `- Starts: ${input.startTime.toDateString()} at ${formatClock(input.startTime)} (${partOfDay(input.startTime)})`,
    `- Ends: ${input.endTime.toDateString()} at ${formatClock(input.endTime)}`,
    `- Total window: ${formatDuration(input.durationMinutes)}`,
    `- Plan this as ${dayCount} day${dayCount > 1 ? "s" : ""} (one "days" entry per day; days after the first run roughly 09:00-21:00).`,
    `- Group: ${describeGroup(input)}`,
    `- Budget: ${BUDGET_LABELS[input.budgetTier]} -- aim for at most ${budgetCeiling(input)} INR per person across the whole plan.`,
    `- Interests: ${
      input.surpriseMe
        ? "SURPRISE ME -- choose a well-rounded mix yourself"
        : input.interests.map(interestLabel).join(", ") || "not specified"
    }`,
    `- Travel radius: ${input.radiusKm} km`,
    input.notes ? `- In their own words: "${input.notes}"` : null,
    "",
    "CANDIDATES (the only places you may schedule)",
    JSON.stringify(candidatesForPrompt(candidates), null, 1),
    "",
    "Return the plan as JSON matching the required schema.",
  ]
    .filter(Boolean)
    .join("\n");
}

export type GenerateResult = {
  itinerary: Itinerary;
  candidates: Candidate[];
  /** Set when the deterministic planner produced the plan instead of the LLM. */
  fallbackReason: string | null;
};

export async function generateItinerary(input: PlanInput): Promise<GenerateResult> {
  const candidates = await findCandidates(input);
  if (candidates.length === 0) {
    throw new NoCandidatesError(input.location);
  }

  const dayCount = suggestedDayCount(input);
  const provider = getLlmProvider();

  let draft: PlanDraft | null = null;
  let fallbackReason: string | null = null;
  let generator = provider.id;

  try {
    const raw = await provider.generateJson({
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input, candidates, dayCount),
      schema: PLAN_DRAFT_JSON_SCHEMA,
      schemaName: "plan_draft",
      effort: dayCount > 1 ? "high" : "medium",
    });
    draft = PlanDraftSchema.parse(raw);
  } catch (error) {
    fallbackReason = describeFallback(error);
    draft = buildFallbackDraft(input, candidates, dayCount);
    generator = "planadate:deterministic";
  }

  return {
    itinerary: assembleItinerary(draft, candidates, input, generator),
    candidates,
    fallbackReason,
  };
}

// ------------------------------------------------------------------ edits

const EDIT_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

You are now EDITING an existing plan.

- Change only what the instruction asks for. Keep every other entry, in the
  same order, with its existing "why" text.
- If the instruction implies a constraint change (a child joined, budget is
  tighter, no early starts), apply it to the whole plan.
- Set "changeSummary" to one sentence describing exactly what you changed.
- If the instruction cannot be honoured with the available candidates, keep the
  plan as-is and say so in "changeSummary".`;

function compactItinerary(itinerary: Itinerary) {
  return {
    title: itinerary.title,
    days: itinerary.days.map((day) => ({
      label: day.label,
      entries: day.items.map((item) => ({
        slug: item.activitySlug,
        kind: item.kind,
        title: item.activitySlug ? undefined : item.title,
        durationMinutes: item.durationMinutes,
        why: item.why,
        note: item.note,
      })),
    })),
    tips: itinerary.tips,
    warnings: itinerary.warnings,
    cost_per_person_now: itinerary.totals.costPerPerson,
  };
}

export type EditResult = GenerateResult & { changedItemIds: string[] };

export async function editItinerary(
  input: PlanInput,
  current: Itinerary,
  instruction: string,
): Promise<EditResult> {
  const candidates = await findCandidates(input, 40);
  const dayCount = Math.max(1, current.days.length);
  const provider = getLlmProvider();

  let draft: PlanDraft | null = null;
  let fallbackReason: string | null = null;
  let generator = provider.id;

  try {
    const raw = await provider.generateJson({
      system: EDIT_SYSTEM_PROMPT,
      prompt: [
        buildPrompt(input, candidates, dayCount),
        "",
        "CURRENT PLAN",
        JSON.stringify(compactItinerary(current), null, 1),
        "",
        `INSTRUCTION FROM THE USER: "${instruction}"`,
        "",
        "Return the full updated plan as JSON matching the required schema.",
      ].join("\n"),
      schema: PLAN_DRAFT_JSON_SCHEMA,
      schemaName: "plan_draft",
      effort: "medium",
    });
    draft = PlanDraftSchema.parse(raw);
  } catch (error) {
    fallbackReason = describeFallback(error);
    draft = applyDeterministicEdit(input, current, candidates, instruction, dayCount);
    generator = "planadate:deterministic";
  }

  const itinerary = assembleItinerary(draft, candidates, input, generator);
  return { itinerary, candidates, fallbackReason, changedItemIds: diffItems(current, itinerary) };
}

function diffItems(before: Itinerary, after: Itinerary): string[] {
  const beforeKeys = new Set(
    before.days.flatMap((d) => d.items.map((i) => `${i.activitySlug ?? i.title}|${i.durationMinutes}`)),
  );
  const changed: string[] = [];
  for (const day of after.days) {
    for (const item of day.items) {
      const key = `${item.activitySlug ?? item.title}|${item.durationMinutes}`;
      if (!beforeKeys.has(key)) changed.push(item.id);
    }
  }
  return changed;
}

// ---------------------------------------------- deterministic fallbacks

export class NoCandidatesError extends Error {
  constructor(location: string) {
    super(
      `We don't have activity data for "${location}" yet. Try Kochi, Munnar, Varkala, Alleppey, Fort Kochi or Wayanad.`,
    );
    this.name = "NoCandidatesError";
  }
}

function describeFallback(error: unknown): string {
  if (error instanceof LlmUnavailableError) {
    return error.message === "mock-provider"
      ? "Built with Planadate's offline planner (AI_PROVIDER=mock)."
      : `Built with Planadate's offline planner: ${error.message}`;
  }
  const message = error instanceof Error ? error.message : String(error);
  return `The AI planner was unavailable, so this plan was built by Planadate's offline planner (${message}).`;
}

/**
 * Greedy schedule builder. Not as good as the model at explaining choices, but
 * it always returns a coherent, budget-aware, group-aware plan -- so the
 * product never shows an empty state because of an API outage.
 */
export function buildFallbackDraft(
  input: PlanInput,
  candidates: Candidate[],
  dayCount: number,
): PlanDraft {
  const ceiling = budgetCeiling(input);
  const perDayMinutes = Math.min(
    dayCount === 1 ? input.durationMinutes : 11 * 60,
    Math.ceil(input.durationMinutes / dayCount),
  );
  const needsBreaks = input.children > 0 || input.groupType === "seniors" || perDayMinutes > 360;

  const pool = [...candidates];
  // Uniqueness only within a day (plus the day just before, to avoid an
  // immediate repeat) -- a small city catalogue shouldn't cap a multi-day
  // trip at fewer days than the user asked for.
  let usedYesterday = new Set<string>();
  const days: PlanDraft["days"] = [];
  let spend = 0;

  for (let day = 0; day < dayCount; day += 1) {
    const usedToday = new Set<string>();
    const entries: PlanDraft["days"][number]["entries"] = [];
    let filled = 0;
    let sinceFood = 0;
    let placedFood = false;

    while (filled < perDayMinutes - 30) {
      const wantFood = (!placedFood && filled >= perDayMinutes * 0.35) || sinceFood >= 240;
      const pick = pool.find((c) => {
        if (usedToday.has(c.activity.slug) || usedYesterday.has(c.activity.slug)) return false;
        if (spend + c.activity.costPerPerson > ceiling * 1.1) return false;
        if (filled + c.activity.durationMinutes > perDayMinutes + 30) return false;
        const isFood = c.activity.category === "food" || c.activity.category === "cafes";
        return wantFood ? isFood : true;
      });

      if (!pick) {
        if (wantFood) {
          // No affordable food left: insert a plain break instead of nothing.
          entries.push({
            kind: "break",
            title: "Food break",
            durationMinutes: 45,
            why: "A pause to eat wherever the group fancies -- nothing pre-booked.",
            note: null,
          });
          filled += 45;
          placedFood = true;
          sinceFood = 0;
          continue;
        }
        break;
      }

      usedToday.add(pick.activity.slug);
      spend += pick.activity.costPerPerson;
      const isFood = pick.activity.category === "food" || pick.activity.category === "cafes";
      entries.push({
        slug: pick.activity.slug,
        kind: isFood ? "food" : "activity",
        durationMinutes: pick.activity.durationMinutes,
        why: buildWhy(pick, input),
        note: pick.activity.tips ?? null,
      });
      filled += pick.activity.durationMinutes;
      sinceFood = isFood ? 0 : sinceFood + pick.activity.durationMinutes;
      if (isFood) placedFood = true;

      if (needsBreaks && filled > perDayMinutes * 0.6 && !entries.some((e) => e.kind === "break")) {
        entries.push({
          kind: "break",
          title: "Rest & recharge",
          durationMinutes: 30,
          why:
            input.children > 0
              ? "Built-in downtime so the kids don't run out of steam."
              : "A deliberate slow stretch so the day doesn't feel rushed.",
          note: null,
        });
        filled += 30;
      }
    }

    if (entries.length === 0) break;
    days.push({
      label: dayCount > 1 ? `Day ${day + 1}` : `Your ${formatDuration(input.durationMinutes)} in ${input.location}`,
      entries,
    });
    usedYesterday = usedToday;
  }

  if (days.length === 0) {
    const first = candidates[0];
    days.push({
      label: `Your ${formatDuration(input.durationMinutes)} in ${input.location}`,
      entries: [
        {
          slug: first.activity.slug,
          kind: "activity",
          durationMinutes: Math.min(first.activity.durationMinutes, input.durationMinutes),
          why: buildWhy(first, input),
          note: first.activity.tips ?? null,
        },
      ],
    });
  }

  const scheduled = new Set(days.flatMap((d) => d.entries.map((e) => e.slug).filter(Boolean)));
  const alternatives = candidates
    .filter((c) => !scheduled.has(c.activity.slug))
    .slice(0, 5)
    .map((c) => ({ slug: c.activity.slug, why: buildWhy(c, input) }));

  return {
    title: `${formatDuration(input.durationMinutes)} in ${input.location}`,
    summary: `A ${formatDuration(input.durationMinutes)} plan for ${describeGroup(input)} around ${
      input.location
    }, ordered to keep travel short and the pace comfortable.`,
    days,
    tips: buildTips(input),
    warnings: buildWarnings(input, days),
    alternatives,
    changeSummary: null,
  };
}

function buildWhy(candidate: Candidate, input: PlanInput): string {
  const label = GROUP_LABELS[input.groupType as GroupType] ?? input.groupType;
  const reason = candidate.reasons[0];
  if (reason) return `Picked for a ${label.toLowerCase()} outing because it ${reason}.`;
  return `A solid ${candidate.activity.category.replace(/_/g, " ")} option that works well for a ${label.toLowerCase()} outing.`;
}

function buildTips(input: PlanInput): string[] {
  const tips = [
    "Carry water and some cash -- smaller places often don't take cards.",
    "Times shift with traffic; treat each slot as a window, not a deadline.",
  ];
  if (input.children > 0) tips.push("Pack snacks and a change of clothes for the kids.");
  if (input.groupType === "large_group")
    tips.push("Call ahead for anywhere you plan to eat -- large groups rarely walk in.");
  if (input.durationMinutes > 8 * 60) tips.push("Book a place to stay before you set out.");
  return tips.slice(0, 5);
}

function buildWarnings(input: PlanInput, days: PlanDraft["days"]): string[] {
  const warnings: string[] = [];
  if (input.budgetTier === "free") {
    warnings.push("Free-only plan: entry fees and paid activities have been excluded.");
  }
  if (days.length < 1) warnings.push("We couldn't fill the whole window with good matches.");
  return warnings;
}

/**
 * Instruction-aware offline edits. Deliberately narrow: it handles the common
 * asks ("cheaper", "remove X", "more adventure", "later start", "more food")
 * and otherwise returns the plan unchanged with an honest changeSummary.
 */
export function applyDeterministicEdit(
  input: PlanInput,
  current: Itinerary,
  candidates: Candidate[],
  instruction: string,
  dayCount: number,
): PlanDraft {
  const text = instruction.toLowerCase();
  const base = compactItinerary(current);
  const days: PlanDraft["days"] = base.days.map((day) => ({
    label: day.label,
    entries: day.entries.map((entry) => ({
      slug: entry.slug ?? null,
      kind: (entry.kind as PlanDraft["days"][number]["entries"][number]["kind"]) ?? "activity",
      title: entry.title ?? null,
      durationMinutes: entry.durationMinutes ?? null,
      why: entry.why,
      note: entry.note ?? null,
    })),
  }));

  const bySlug = new Map(candidates.map((c) => [c.activity.slug, c]));
  let changeSummary: string | null = null;

  const cheaper = /cheap|budget|less expensive|save money|too expensive/.test(text);
  const removeMatch = text.match(/(?:remove|drop|skip|no more|cut|don'?t want)\s+(?:the\s+)?([a-z0-9 &'-]{3,40})/);
  const wantsMore = text.match(/(?:more|add)\s+([a-z ]{3,30})/);

  if (cheaper) {
    let removed = 0;
    for (const day of days) {
      day.entries = day.entries.filter((entry) => {
        const cost = entry.slug ? bySlug.get(entry.slug)?.activity.costPerPerson ?? 0 : 0;
        const keep = cost <= 400 || removed >= 2;
        if (!keep) removed += 1;
        return keep;
      });
    }
    changeSummary =
      removed > 0
        ? `Dropped the ${removed} most expensive stop${removed > 1 ? "s" : ""} to bring the cost down.`
        : "This plan was already at the cheap end -- nothing costly left to cut.";
  } else if (removeMatch) {
    const needle = removeMatch[1].trim();
    let removed = 0;
    for (const day of days) {
      day.entries = day.entries.filter((entry) => {
        const activity = entry.slug ? bySlug.get(entry.slug)?.activity : null;
        const haystack = `${activity?.name ?? entry.title ?? ""} ${activity?.category ?? ""} ${
          activity?.locationName ?? ""
        }`.toLowerCase();
        const hit = haystack.includes(needle);
        if (hit) removed += 1;
        return !hit;
      });
    }
    changeSummary =
      removed > 0
        ? `Removed ${removed} stop${removed > 1 ? "s" : ""} matching "${needle}".`
        : `Nothing in the plan matched "${needle}", so it's unchanged.`;
  } else if (wantsMore) {
    const needle = wantsMore[1].trim().replace(/\s+activities?$/, "").replace(/\s+options?$/, "");
    const scheduled = new Set(days.flatMap((d) => d.entries.map((e) => e.slug)));
    const addition = candidates.find(
      (c) =>
        !scheduled.has(c.activity.slug) &&
        `${c.activity.category} ${c.tags.join(" ")} ${c.activity.name}`.toLowerCase().includes(needle),
    );
    if (addition) {
      const isFood = addition.activity.category === "food" || addition.activity.category === "cafes";
      days[days.length - 1].entries.push({
        slug: addition.activity.slug,
        kind: isFood ? "food" : "activity",
        durationMinutes: addition.activity.durationMinutes,
        why: `Added because you asked for more ${needle}.`,
        note: addition.activity.tips ?? null,
      });
      changeSummary = `Added ${addition.activity.name} for more ${needle}.`;
    } else {
      changeSummary = `We don't have another ${needle} option nearby that fits, so the plan is unchanged.`;
    }
  }

  if (!changeSummary) {
    changeSummary =
      "The offline planner couldn't interpret that instruction. Set ANTHROPIC_API_KEY to use conversational editing.";
  }

  return {
    title: current.title,
    summary: current.summary,
    days: days.filter((d) => d.entries.length > 0),
    tips: current.tips,
    warnings: current.warnings,
    alternatives: current.alternatives.map((a) => ({ slug: a.activitySlug, why: a.why })),
    changeSummary,
  };
}

export { type PlanInput } from "./catalog";
