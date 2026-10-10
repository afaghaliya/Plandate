"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { geocode } from "@/lib/geo";
import { addMinutes, formatDuration } from "@/lib/time";
import { stringifyJson } from "@/lib/json";
import { BUDGET_TIERS, GROUP_TYPES, INTEREST_CATEGORIES } from "@/lib/domain";
import type { Itinerary } from "@/lib/ai/schema";
import { readItinerary } from "@/lib/ai/read";
import { assembleItinerary, itineraryToDraft } from "@/lib/ai/assemble";
import { findCandidates } from "@/lib/ai/catalog";
import { editItinerary, generateItinerary, NoCandidatesError } from "@/lib/ai/planner";
import { planInputFromRow } from "@/lib/planInput";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const planFormSchema = z
  .object({
    location: z.string().trim().min(2, "Where are you going?").max(120),
    startTime: z.string().min(1, "Pick a start time"),
    durationMinutes: z.coerce.number().int().min(30).max(14 * 24 * 60),
    groupType: z.enum(GROUP_TYPES),
    adults: z.coerce.number().int().min(1).max(40),
    children: z.coerce.number().int().min(0).max(20),
    childAges: z.array(z.coerce.number().int().min(0).max(17)).max(20).default([]),
    budgetTier: z.enum(BUDGET_TIERS),
    budgetPerPerson: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
    interests: z.array(z.enum(INTEREST_CATEGORIES)).max(20).default([]),
    surpriseMe: z.boolean().default(false),
    radiusKm: z.coerce.number().int().min(1).max(200).default(15),
    notes: z.string().trim().max(1200).nullable().optional(),
  })
  .refine((value) => value.surpriseMe || value.interests.length > 0, {
    message: "Pick at least one activity type, or choose Surprise me.",
    path: ["interests"],
  });

export type PlanFormInput = z.input<typeof planFormSchema>;

/**
 * Creates the plan row, then generates the itinerary. Both happen server-side
 * so a reload never re-runs the model, and the row exists even if generation
 * fails (the plan page shows a retry instead of losing the user's input).
 */
export async function createPlan(raw: PlanFormInput): Promise<ActionResult<{ planId: string }>> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to create a plan.");
  }

  const parsed = planFormSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }
  const input = parsed.data;

  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime())) return fail("That start time isn't valid.");
  const endTime = addMinutes(startTime, input.durationMinutes);

  if (input.children > 0 && input.childAges.length === 0) {
    // Not fatal -- the planner just gets a coarser signal.
  }

  const place = await geocode(input.location);

  const plan = await prisma.plan.create({
    data: {
      userId,
      title: `${formatDuration(input.durationMinutes)} in ${place?.name ?? input.location}`,
      location: place?.name ?? input.location,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      startTime,
      endTime,
      durationMinutes: input.durationMinutes,
      groupType: input.groupType,
      adults: input.adults,
      children: input.children,
      childAges: stringifyJson(input.childAges.slice(0, input.children)),
      budgetTier: input.budgetTier,
      budgetPerPerson:
        input.budgetTier === "custom" ? input.budgetPerPerson ?? null : null,
      interests: stringifyJson(input.surpriseMe ? [] : input.interests),
      surpriseMe: input.surpriseMe,
      radiusKm: input.radiusKm,
      notes: input.notes?.trim() || null,
      status: "generating",
    },
  });

  const result = await runGeneration(plan.id);
  if (!result.ok) {
    // The plan row survives so the user can retry without retyping.
    return { ok: true, data: { planId: plan.id } };
  }

  revalidatePath("/plans");
  return { ok: true, data: { planId: plan.id } };
}

async function runGeneration(planId: string): Promise<ActionResult> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return fail("Plan not found.");

  try {
    const { itinerary } = await generateItinerary(planInputFromRow(plan));
    await prisma.$transaction([
      prisma.plan.update({
        where: { id: planId },
        data: {
          itinerary: stringifyJson(itinerary),
          title: itinerary.title,
          status: "ready",
          generator: itinerary.generator,
        },
      }),
      prisma.planRevision.create({
        data: {
          planId,
          instruction: null,
          itinerary: stringifyJson(itinerary),
          summary: "First generation",
        },
      }),
    ]);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof NoCandidatesError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Plan generation failed.";
    await prisma.plan.update({ where: { id: planId }, data: { status: "failed" } });
    return fail(message);
  }
}

export async function regeneratePlan(planId: string): Promise<ActionResult> {
  const plan = await requireOwnedPlan(planId);
  if ("error" in plan) return plan;
  await prisma.plan.update({ where: { id: planId }, data: { status: "generating" } });
  const result = await runGeneration(planId);
  revalidatePath(`/plan/${planId}`);
  return result;
}

export async function askPlanAssistant(
  planId: string,
  instruction: string,
): Promise<ActionResult<{ changeSummary: string | null }>> {
  const owned = await requireOwnedPlan(planId);
  if ("error" in owned) return owned;
  const plan = owned.plan;

  const trimmed = instruction.trim();
  if (trimmed.length < 3) return fail("Tell the assistant what to change.");
  if (trimmed.length > 500) return fail("Keep the instruction under 500 characters.");

  const current = readItinerary(plan.itinerary);
  if (!current) return fail("Generate a plan first.");

  try {
    const { itinerary } = await editItinerary(planInputFromRow(plan), current, trimmed);
    await prisma.$transaction([
      prisma.plan.update({
        where: { id: planId },
        data: {
          itinerary: stringifyJson(itinerary),
          title: itinerary.title,
          status: "ready",
          generator: itinerary.generator,
        },
      }),
      prisma.planRevision.create({
        data: {
          planId,
          instruction: trimmed,
          itinerary: stringifyJson(itinerary),
          summary: itinerary.changeSummary,
        },
      }),
    ]);
    revalidatePath(`/plan/${planId}`);
    return { ok: true, data: { changeSummary: itinerary.changeSummary } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The assistant couldn't apply that.");
  }
}

// ------------------------------------------- deterministic itinerary edits

type ItemEdit =
  | { type: "remove"; itemId: string }
  | { type: "move"; itemId: string; direction: "up" | "down" }
  | { type: "replace"; itemId: string; withSlug: string }
  | { type: "add"; slug: string };

export async function editPlanItem(planId: string, edit: ItemEdit): Promise<ActionResult> {
  const owned = await requireOwnedPlan(planId);
  if ("error" in owned) return owned;
  const plan = owned.plan;

  const current = readItinerary(plan.itinerary);
  if (!current) return fail("Generate a plan first.");

  const draft = itineraryToDraft(current);
  const located = locate(current, "itemId" in edit ? edit.itemId : null);

  switch (edit.type) {
    case "remove": {
      if (!located) return fail("That item is no longer in the plan.");
      draft.days[located.dayIndex].entries.splice(located.itemIndex, 1);
      draft.changeSummary = `Removed ${located.item.title}.`;
      break;
    }
    case "move": {
      if (!located) return fail("That item is no longer in the plan.");
      const entries = draft.days[located.dayIndex].entries;
      const target = edit.direction === "up" ? located.itemIndex - 1 : located.itemIndex + 1;
      if (target < 0 || target >= entries.length) return fail("It's already at the edge of the day.");
      [entries[located.itemIndex], entries[target]] = [entries[target], entries[located.itemIndex]];
      draft.changeSummary = `Moved ${located.item.title} ${edit.direction}.`;
      break;
    }
    case "replace": {
      if (!located) return fail("That item is no longer in the plan.");
      const replacement = current.alternatives.find((alt) => alt.activitySlug === edit.withSlug);
      if (!replacement) return fail("That alternative is no longer available.");
      draft.days[located.dayIndex].entries[located.itemIndex] = {
        slug: replacement.activitySlug,
        kind: replacement.category === "food" || replacement.category === "cafes" ? "food" : "activity",
        title: null,
        durationMinutes: replacement.durationMinutes,
        why: replacement.why,
        note: null,
      };
      draft.alternatives = draft.alternatives.filter((alt) => alt.slug !== edit.withSlug);
      if (located.item.activitySlug) {
        draft.alternatives.unshift({
          slug: located.item.activitySlug,
          why: located.item.why,
        });
      }
      draft.changeSummary = `Swapped ${located.item.title} for ${replacement.title}.`;
      break;
    }
    case "add": {
      const addition = current.alternatives.find((alt) => alt.activitySlug === edit.slug);
      if (!addition) return fail("That option is no longer available.");
      const lastDay = draft.days[draft.days.length - 1];
      lastDay.entries.push({
        slug: addition.activitySlug,
        kind: addition.category === "food" || addition.category === "cafes" ? "food" : "activity",
        title: null,
        durationMinutes: addition.durationMinutes,
        why: addition.why,
        note: null,
      });
      draft.alternatives = draft.alternatives.filter((alt) => alt.slug !== edit.slug);
      draft.changeSummary = `Added ${addition.title} to the plan.`;
      break;
    }
  }

  draft.days = draft.days.filter((day) => day.entries.length > 0);
  if (draft.days.length === 0) return fail("A plan needs at least one stop.");

  const input = planInputFromRow(plan);
  const candidates = await findCandidates(input, 40);
  const next = assembleItinerary(draft, candidates, input, `${current.generator}+manual`);

  await prisma.$transaction([
    prisma.plan.update({
      where: { id: planId },
      data: { itinerary: stringifyJson(next), status: "ready" },
    }),
    prisma.planRevision.create({
      data: {
        planId,
        instruction: draft.changeSummary,
        itinerary: stringifyJson(next),
        summary: draft.changeSummary,
      },
    }),
  ]);

  revalidatePath(`/plan/${planId}`);
  return { ok: true };
}

export async function savePlan(planId: string): Promise<ActionResult> {
  const owned = await requireOwnedPlan(planId);
  if ("error" in owned) return owned;
  await prisma.plan.update({ where: { id: planId }, data: { status: "saved" } });
  revalidatePath(`/plan/${planId}`);
  revalidatePath("/plans");
  return { ok: true };
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const owned = await requireOwnedPlan(planId);
  if ("error" in owned) return owned;
  await prisma.plan.delete({ where: { id: planId } });
  revalidatePath("/plans");
  return { ok: true };
}

// -------------------------------------------------------------- internals

async function requireOwnedPlan(planId: string) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to change this plan.");
  }
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return fail("Plan not found.");
  if (plan.userId !== userId) return fail("This isn't your plan.");
  return { plan };
}

function locate(itinerary: Itinerary, itemId: string | null) {
  if (!itemId) return null;
  for (const [dayIndex, day] of itinerary.days.entries()) {
    const itemIndex = day.items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) {
      return { dayIndex, itemIndex, item: day.items[itemIndex] };
    }
  }
  return null;
}
