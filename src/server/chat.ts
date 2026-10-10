"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { sweepExpired } from "@/lib/expiry";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const MAX_MESSAGE_LENGTH = 1000;

/**
 * Activity chat. Access is checked on every send -- membership, outing status
 * and conversation expiry are all backend concerns, never client state.
 *
 * Transport note: the client polls `GET /api/outings/[id]/messages`. Swapping
 * in WebSockets/Supabase Realtime means changing that one hook; the
 * authorisation rules below stay exactly as they are.
 */
export async function sendMessage(
  outingId: string,
  body: string,
): Promise<ActionResult<{ messageId: string }>> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in to send a message.");
  }

  const text = body.trim();
  if (!text) return fail("Write something first.");
  if (text.length > MAX_MESSAGE_LENGTH) {
    return fail(`Keep messages under ${MAX_MESSAGE_LENGTH} characters.`);
  }

  await sweepExpired();

  const outing = await prisma.outing.findUnique({
    where: { id: outingId },
    include: {
      conversation: true,
      participants: { where: { userId }, select: { status: true } },
    },
  });
  if (!outing?.conversation) return fail("This chat doesn't exist.");
  if (outing.conversation.closedAt) return fail("This chat is closed -- the activity has ended.");
  if (["expired", "cancelled", "closed"].includes(outing.status)) {
    return fail("This activity is over.");
  }
  if (outing.participants[0]?.status !== "accepted") {
    return fail("Only accepted participants can chat here.");
  }

  const message = await prisma.message.create({
    data: { conversationId: outing.conversation.id, senderId: userId, body: text },
  });

  revalidatePath(`/outings/${outingId}`);
  return { ok: true, data: { messageId: message.id } };
}
