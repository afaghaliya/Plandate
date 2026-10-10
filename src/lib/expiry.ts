import { prisma } from "@/lib/prisma";

/**
 * Activity expiry is enforced by the backend, not by the client and not by the
 * model. Every read path that lists or opens outings calls this first, which
 * keeps expiry correct without a background worker in the MVP. Move this to a
 * cron/queue when traffic justifies it -- the call sites stay the same.
 */
export async function sweepExpired(now = new Date()): Promise<number> {
  const expired = await prisma.outing.findMany({
    where: {
      status: { in: ["open", "full"] },
      expiresAt: { lte: now },
    },
    select: { id: true, conversation: { select: { id: true, closedAt: true } } },
  });

  if (expired.length === 0) return 0;

  const ids = expired.map((o) => o.id);

  await prisma.$transaction([
    prisma.outing.updateMany({ where: { id: { in: ids } }, data: { status: "expired" } }),
    prisma.conversation.updateMany({
      where: { outingId: { in: ids }, closedAt: null },
      data: { closedAt: now },
    }),
    prisma.outingParticipant.updateMany({
      where: { outingId: { in: ids }, status: "pending" },
      data: { status: "declined" },
    }),
  ]);

  const openConversations = expired
    .map((o) => o.conversation)
    .filter((c): c is { id: string; closedAt: Date | null } => !!c && c.closedAt === null);

  if (openConversations.length > 0) {
    await prisma.message.createMany({
      data: openConversations.map((c) => ({
        conversationId: c.id,
        body: "This activity has ended and the chat is now closed.",
        isSystem: true,
      })),
    });
  }

  return ids.length;
}
