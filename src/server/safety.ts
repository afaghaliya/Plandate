"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/domain";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1500).nullable().optional(),
  targetUserId: z.string().nullable().optional(),
  targetOutingId: z.string().nullable().optional(),
});

/**
 * Reports land in the `Report` table with status "open". That table is the
 * queue a moderation tool reads -- deliberately separate from any user-visible
 * state so a report never leaks back to the person reported.
 */
export async function submitReport(raw: z.input<typeof reportSchema>): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to report something.");
  }

  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return fail("Pick a reason for the report.");
  const input = parsed.data;

  if (!input.targetUserId && !input.targetOutingId) {
    return fail("Nothing to report.");
  }
  if (input.targetUserId === userId) return fail("You can't report yourself.");

  await prisma.report.create({
    data: {
      reporterId: userId,
      targetUserId: input.targetUserId ?? null,
      targetOutingId: input.targetOutingId ?? null,
      reason: input.reason,
      details: input.details?.trim() || null,
    },
  });

  return { ok: true };
}

export async function blockUser(targetUserId: string): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in first.");
  }
  if (targetUserId === userId) return fail("You can't block yourself.");

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return fail("That person no longer exists.");

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
    update: {},
    create: { blockerId: userId, blockedId: targetUserId },
  });

  // Blocking removes you from anything you shared with them.
  const shared = await prisma.outing.findMany({
    where: {
      OR: [
        { creatorId: targetUserId, participants: { some: { userId, status: { in: ["pending", "accepted"] } } } },
        { creatorId: userId, participants: { some: { userId: targetUserId, status: { in: ["pending", "accepted"] } } } },
      ],
    },
    select: { id: true, creatorId: true },
  });

  for (const outing of shared) {
    const removeUserId = outing.creatorId === userId ? targetUserId : userId;
    await prisma.outingParticipant.updateMany({
      where: { outingId: outing.id, userId: removeUserId },
      data: { status: "removed" },
    });
  }

  revalidatePath("/discover");
  revalidatePath("/messages");
  revalidatePath(`/profile/${targetUserId}`);
  return { ok: true };
}

export async function unblockUser(targetUserId: string): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in first.");
  }
  await prisma.block
    .delete({ where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } } })
    .catch(() => null);
  revalidatePath(`/profile/${targetUserId}`);
  return { ok: true };
}
