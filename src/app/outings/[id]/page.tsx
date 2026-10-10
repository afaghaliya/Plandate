import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import { getOutingDetail, listMessages } from "@/server/data";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Feedback";
import { interestEmoji, interestLabel } from "@/lib/domain";
import { formatWhen, formatDuration } from "@/lib/time";
import { OutingsMap } from "@/components/map/OutingsMap";
import { JoinPanel } from "@/components/outing/JoinPanel";
import { RequestsList } from "@/components/outing/RequestsList";
import { ChatPanel } from "@/components/outing/ChatPanel";
import { ReportButton } from "@/components/safety/ReportButton";
import { BlockButton } from "@/components/safety/BlockButton";

export default async function OutingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await currentUserId();
  const detail = await getOutingDetail(id, userId);
  if (!detail) notFound();

  const { card } = detail;
  const chatData = detail.canChat ? await listMessages(id, userId) : null;

  return (
    <div className="container-page py-8">
      <div className="grid lg:grid-cols-[1fr_22rem] gap-8 items-start">
        <div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Chip tone="brand">
              {interestEmoji(card.category)} {interestLabel(card.category)}
            </Chip>
            {card.isHereNow && <Chip tone="danger">● Happening now</Chip>}
            <Chip>{card.status === "full" ? "Full" : `${card.spotsLeft} spots left`}</Chip>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold">{card.title}</h1>

          <div className="flex items-center gap-2 mt-3">
            <Link href={`/profile/${card.host.id}`}>
              <Avatar name={card.host.name} image={card.host.image} size={32} />
            </Link>
            <div>
              <Link href={`/profile/${card.host.id}`} className="font-bold text-[13.5px] hover:underline">
                {card.host.name}
              </Link>
              <p className="text-[11.5px] text-ink-faint">
                {card.host.verification !== "none" ? "✓ Verified host" : "Host"}
              </p>
            </div>
          </div>

          {card.description && (
            <p className="text-[13.5px] text-ink-soft mt-4 leading-relaxed whitespace-pre-line">
              {card.description}
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <Card>
              <CardBody className="text-[13px]">
                <p className="font-bold text-ink-faint text-[11.5px] uppercase tracking-wide mb-1">When</p>
                <p>{formatWhen(new Date(card.startTime))}</p>
                <p className="text-ink-faint mt-0.5">{formatDuration(card.durationMinutes)}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-[13px]">
                <p className="font-bold text-ink-faint text-[11.5px] uppercase tracking-wide mb-1">
                  Public meeting point
                </p>
                <p>📍 {card.locationName}</p>
                {card.minAge && (
                  <p className="text-ink-faint mt-0.5">
                    Ages {card.minAge}
                    {card.maxAge ? `–${card.maxAge}` : "+"}
                  </p>
                )}
              </CardBody>
            </Card>
          </div>

          <OutingsMap
            outings={[card]}
            className="h-64 rounded-[var(--radius-card)] overflow-hidden border border-line mt-5"
          />
          <p className="text-[11px] text-ink-faint mt-1.5">
            Location shown approximately until you join — the exact meeting spot is the named public place above.
          </p>

          <div className="mt-6">
            <h2 className="font-bold text-[14px] mb-2">
              Who&apos;s going ({card.going.length}
              {card.capacity ? `/${card.capacity}` : ""})
            </h2>
            {detail.members.length === 0 ? (
              <p className="text-[13px] text-ink-faint">No one has joined yet — be the first.</p>
            ) : (
              <div className="flex items-center gap-3">
                <AvatarStack people={detail.members.map((m) => ({ id: m.userId, name: m.name, image: m.image }))} size={32} />
                <span className="text-[12.5px] text-ink-faint">
                  {detail.members.map((m) => m.name.split(" ")[0]).join(", ")}
                </span>
              </div>
            )}
          </div>

          {userId && userId !== card.host.id && (
            <div className="flex gap-1 mt-6">
              <ReportButton targetOutingId={id} label="Report activity" />
              <BlockButton targetUserId={card.host.id} blocked={detail.isBlockedHost} />
            </div>
          )}
        </div>

        <aside className="space-y-5">
          {userId ? (
            <Card>
              <CardBody>
                <JoinPanel outingId={id} viewerStatus={card.viewerStatus} full={card.status === "full"} />
              </CardBody>
            </Card>
          ) : (
            <Notice tone="info">
              <Link href={`/signin?from=${encodeURIComponent(`/outings/${id}`)}`} className="font-bold underline">
                Sign in
              </Link>{" "}
              to request to join.
            </Notice>
          )}

          {detail.requests.length > 0 && (
            <Card>
              <CardBody>
                <h2 className="font-bold mb-3">Requests to join ({detail.requests.length})</h2>
                <RequestsList requests={detail.requests} />
              </CardBody>
            </Card>
          )}

          {detail.canChat && chatData && (
            <Card>
              <CardBody>
                <h2 className="font-bold mb-2">Activity chat</h2>
                <ChatPanel outingId={id} initialMessages={chatData.messages} closed={chatData.closed} />
              </CardBody>
            </Card>
          )}

          {card.status === "cancelled" && <Notice tone="danger">This activity was cancelled.</Notice>}
          {card.status === "expired" && <Notice tone="warning">This activity has ended.</Notice>}
        </aside>
      </div>
    </div>
  );
}
