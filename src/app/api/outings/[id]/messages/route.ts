import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { listMessages } from "@/server/data";

/**
 * Polling transport for activity chat, read by ChatPanel every few seconds.
 * Swapping to WebSockets/Supabase Realtime later means replacing the client
 * hook that calls this route -- the authorisation in `listMessages` (accepted
 * participants only, closed once the activity ends) does not change.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  const result = await listMessages(id, userId);

  if (!result.authorised) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }
  return NextResponse.json(result);
}
