"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { cityKey, geocode } from "@/lib/geo";
import { addMinutes } from "@/lib/time";
import { INTEREST_CATEGORIES } from "@/lib/domain";
import { isEligible, scoreMatch } from "@/lib/matching";
import { stringifyJson } from "@/lib/json";
import { sweepExpired } from "@/lib/expiry";
import { readItinerary } from "@/lib/ai/read";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const MAX_CAPACITY = 40;
const MAX_HERE_NOW_MINUTES = 8 * 60;

const outingSchema = z
  .object({
    title: z.string().trim().min(4, "Give it a clear title").max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    category: z.enum(INTEREST_CATEGORIES),
    locationName: z.string().trim().min(3, "Name a public meeting point").max(160),
    startTime: z.string().min(1, "When does it start?"),
    durationMinutes: z.coerce.number().int().min(30).max(14 * 24 * 60),
    capacity: z.coerce.number().int().min(2).max(MAX_CAPACITY),
    minAge: z.coerce.number().int().min(13).max(100).nullable().optional(),
    maxAge: z.coerce.number().int().min(13).max(100).nullable().optional(),
    isHereNow: z.boolean().default(false),
    planId: z.string().nullable().optional(),
    planItemId: z.string().nullable().optional(),
  })
  .refine((v) => !v.minAge || !v.maxAge || v.minAge <= v.maxAge, {
    message: "The minimum age can't be above the maximum.",
    path: ["minAge"],
  });

export type OutingFormInput = z.input<typeof outingSchema>;

/**
 * Creates a public activity request. The host is auto-added as an accepted
 * participant and a chat is opened immediately, so the "Find people" flow has
 * somewhere to talk from the moment the first person is accepted.
 */
export async function createOuting(
  raw: OutingFormInput,
): Promise<ActionResult<{ outingId: string }>> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to create an activity.");
  }

  const parsed = outingSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const input = parsed.data;

  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime())) return fail("That start time isn't valid.");

  const now = new Date();
  if (startTime.getTime() < now.getTime() - 60 * 60_000) {
    return fail("Start time is in the past.");
  }
  if (input.isHereNow && input.durationMinutes > MAX_HERE_NOW_MINUTES) {
    return fail("'I'm here now' requests can run for at most 8 hours.");
  }

  const endTime = addMinutes(startTime, input.durationMinutes);
  const place = await geocode(input.locationName);
  if (!place) {
    return fail(
      "We couldn't find that place. Try a well-known public spot, e.g. 'Marine Drive, Ernakulam'.",
    );
  }

  const outing = await prisma.outing.create({
    data: {
      creatorId: userId,
      planId: input.planId ?? null,
      planItemId: input.planItemId ?? null,
      title: input.title,
      description: input.description?.trim() || null,
      category: input.category,
      locationName: input.locationName,
      city: cityKey(input.locationName),
      lat: place.lat,
      lng: place.lng,
      startTime,
      endTime,
      capacity: input.capacity,
      minAge: input.minAge ?? null,
      maxAge: input.maxAge ?? null,
      isHereNow: input.isHereNow,
      expiresAt: endTime,
      status: "open",
      participants: {
        create: { userId, role: "host", status: "accepted", matchScore: 100 },
      },
      conversation: { create: { expiresAt: endTime } },
    },
    include: { conversation: true },
  });

  if (outing.conversation) {
    const host = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await prisma.message.create({
      data: {
        conversationId: outing.conversation.id,
        isSystem: true,
        body: `${host?.name ?? "The host"} created this activity.`,
      },
    });
  }

  revalidatePath("/discover");
  revalidatePath("/people");
  return { ok: true, data: { outingId: outing.id } };
}

/** Spins an itinerary item into a "find people" request in one click. */
export async function createOutingFromPlanItem(
  planId: string,
  itemId: string,
  capacity = 4,
): Promise<ActionResult<{ outingId: string }>> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to find people.");
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || plan.userId !== userId) return fail("Plan not found.");

  const itinerary = readItinerary(plan.itinerary);
  const item = itinerary?.days.flatMap((day) => day.items).find((i) => i.id === itemId);
  if (!item) return fail("That itinerary item no longer exists.");

  const existing = await prisma.outing.findFirst({
    where: { planId, planItemId: itemId, creatorId: userId, status: { in: ["open", "full"] } },
  });
  if (existing) return { ok: true, data: { outingId: existing.id } };

  return createOuting({
    title: item.title,
    description: `${item.why}${item.description ? `\n\n${item.description}` : ""}`,
    category: item.category as (typeof INTEREST_CATEGORIES)[number],
    locationName: item.locationName,
    startTime: item.startTime,
    durationMinutes: item.durationMinutes,
    capacity,
    isHereNow: false,
    planId,
    planItemId: itemId,
  });
}

export async function requestToJoin(
  outingId: string,
  message?: string,
): Promise<ActionResult<{ status: string }>> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to join an activity.");
  }

  await sweepExpired();

  const [outing, user] = await Promise.all([
    prisma.outing.findUnique({
      where: { id: outingId },
      include: { participants: true },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!outing || !user) return fail("Activity not found.");
  if (outing.creatorId === userId) return fail("You're the host of this one.");
  if (outing.status !== "open") return fail("This activity is no longer taking people.");

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: outing.creatorId, blockedId: userId },
        { blockerId: userId, blockedId: outing.creatorId },
      ],
    },
  });
  if (blocked) return fail("You can't join this activity.");

  const eligibility = isEligible(outing, user);
  if (!eligibility.eligible) return fail(eligibility.reason ?? "You're not eligible for this one.");

  const accepted = outing.participants.filter((p) => p.status === "accepted").length;
  if (accepted >= outing.capacity) return fail("This activity is full.");

  const existing = outing.participants.find((p) => p.userId === userId);
  if (existing && ["pending", "accepted"].includes(existing.status)) {
    return { ok: true, data: { status: existing.status } };
  }

  const home = user.homeCity ? await geocode(user.homeCity) : null;
  const match = scoreMatch(outing, { user, point: home });

  const trimmed = message?.trim().slice(0, 400) || null;

  if (existing) {
    await prisma.outingParticipant.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        message: trimmed,
        matchScore: match.score,
        matchWhy: stringifyJson(match.reasons),
      },
    });
  } else {
    await prisma.outingParticipant.create({
      data: {
        outingId,
        userId,
        status: "pending",
        message: trimmed,
        matchScore: match.score,
        matchWhy: stringifyJson(match.reasons),
      },
    });
  }

  revalidatePath(`/outings/${outingId}`);
  revalidatePath("/discover");
  return { ok: true, data: { status: "pending" } };
}

export async function respondToRequest(
  participantId: string,
  decision: "accept" | "decline",
): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to manage requests.");
  }

  const participant = await prisma.outingParticipant.findUnique({
    where: { id: participantId },
    include: {
      user: { select: { name: true } },
      outing: { include: { participants: true, conversation: true } },
    },
  });
  if (!participant) return fail("Request not found.");
  if (participant.outing.creatorId !== userId) return fail("Only the host can do that.");
  if (participant.status !== "pending") return fail("That request has already been answered.");

  if (decision === "decline") {
    await prisma.outingParticipant.update({
      where: { id: participantId },
      data: { status: "declined" },
    });
    revalidatePath(`/outings/${participant.outingId}`);
    return { ok: true };
  }

  const accepted = participant.outing.participants.filter((p) => p.status === "accepted").length;
  if (accepted >= participant.outing.capacity) return fail("The activity is already full.");

  await prisma.outingParticipant.update({
    where: { id: participantId },
    data: { status: "accepted" },
  });

  if (participant.outing.conversation) {
    await prisma.message.create({
      data: {
        conversationId: participant.outing.conversation.id,
        isSystem: true,
        body: `${participant.user.name} joined the activity.`,
      },
    });
  }

  if (accepted + 1 >= participant.outing.capacity) {
    await prisma.outing.update({
      where: { id: participant.outingId },
      data: { status: "full" },
    });
  }

  revalidatePath(`/outings/${participant.outingId}`);
  revalidatePath("/messages");
  return { ok: true };
}

export async function leaveOuting(outingId: string): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in first.");
  }

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId } },
    include: { user: { select: { name: true } }, outing: { include: { conversation: true } } },
  });
  if (!participant) return fail("You're not part of this activity.");
  if (participant.role === "host") {
    return fail("You're the host -- cancel the activity instead of leaving it.");
  }

  await prisma.outingParticipant.update({
    where: { id: participant.id },
    data: { status: "left" },
  });

  if (participant.outing.conversation && participant.status === "accepted") {
    await prisma.message.create({
      data: {
        conversationId: participant.outing.conversation.id,
        isSystem: true,
        body: `${participant.user.name} left the activity.`,
      },
    });
  }

  if (participant.outing.status === "full") {
    await prisma.outing.update({ where: { id: outingId }, data: { status: "open" } });
  }

  revalidatePath(`/outings/${outingId}`);
  revalidatePath("/messages");
  return { ok: true };
}

export async function cancelOuting(outingId: string): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in first.");
  }

  const outing = await prisma.outing.findUnique({
    where: { id: outingId },
    include: { conversation: true },
  });
  if (!outing) return fail("Activity not found.");
  if (outing.creatorId !== userId) return fail("Only the host can cancel this.");

  const now = new Date();
  await prisma.$transaction([
    prisma.outing.update({ where: { id: outingId }, data: { status: "cancelled" } }),
    prisma.outingParticipant.updateMany({
      where: { outingId, status: "pending" },
      data: { status: "declined" },
    }),
    ...(outing.conversation
      ? [
          prisma.conversation.update({
            where: { id: outing.conversation.id },
            data: { closedAt: now },
          }),
          prisma.message.create({
            data: {
              conversationId: outing.conversation.id,
              isSystem: true,
              body: "The host cancelled this activity. The chat is now closed.",
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/outings/${outingId}`);
  revalidatePath("/discover");
  revalidatePath("/messages");
  return { ok: true };
}

export async function setOutingVisibility(
  outingId: string,
  visibility: "public" | "link",
): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in first.");
  }
  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing) return fail("Activity not found.");
  if (outing.creatorId !== userId) return fail("Only the host can change this.");

  await prisma.outing.update({ where: { id: outingId }, data: { visibility } });
  revalidatePath(`/outings/${outingId}`);
  revalidatePath("/discover");
  return { ok: true };
}
