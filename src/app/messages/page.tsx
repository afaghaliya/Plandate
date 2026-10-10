import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { listMyConversations } from "@/server/data";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { formatRelative, formatWhen } from "@/lib/time";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?from=%2Fmessages");

  const conversations = await listMyConversations(userId);

  return (
    <div className="container-page max-w-2xl py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">Messages</h1>
      <p className="text-[13.5px] text-ink-faint mb-6">
        Temporary, activity-scoped chats — they close when the activity ends.
      </p>

      {conversations.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="No conversations yet"
          body="Join an activity to start chatting with the group."
          action={<LinkButton href="/discover">Discover activities</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {conversations.map((c) => (
            <Link key={c.outingId} href={`/outings/${c.outingId}`}>
              <Card className="hover:shadow-raised transition-shadow">
                <CardBody className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[14px] truncate">{c.title}</h3>
                      {c.closed && <Chip>Closed</Chip>}
                      {!c.closed && c.status === "open" && <Chip tone="success">Active</Chip>}
                    </div>
                    <p className="text-[12px] text-ink-faint mt-0.5">
                      {c.memberCount} people · {formatWhen(new Date(c.startTime))}
                    </p>
                    {c.lastMessage ? (
                      <p className="text-[12.5px] text-ink-soft mt-1.5 truncate">
                        <span className="font-semibold">{c.lastMessage.senderName ?? "System"}:</span>{" "}
                        {c.lastMessage.body}
                      </p>
                    ) : (
                      <p className="text-[12.5px] text-ink-faint mt-1.5 italic">No messages yet</p>
                    )}
                  </div>
                  {c.lastMessage && (
                    <span className="text-[11px] text-ink-faint shrink-0">
                      {formatRelative(new Date(c.lastMessage.createdAt))}
                    </span>
                  )}
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
