import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { interestEmoji, interestLabel } from "@/lib/domain";
import { formatWhen, formatDuration } from "@/lib/time";
import { formatDistance } from "@/lib/geo";
import type { OutingCardData } from "@/server/data";

const STATUS_LABEL: Record<string, string> = {
  host: "You're hosting",
  accepted: "You're going",
  pending: "Request sent",
  declined: "Declined",
};

export function OutingCard({ outing }: { outing: OutingCardData }) {
  const full = outing.spotsLeft === 0;

  return (
    <Link href={`/outings/${outing.id}`}>
      <Card className="h-full hover:shadow-raised hover:-translate-y-0.5 transition-all">
        <CardBody>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="brand">
                {interestEmoji(outing.category)} {interestLabel(outing.category)}
              </Chip>
              {outing.isHereNow && <Chip tone="danger">● Live now</Chip>}
              {full && <Chip tone="amber">Full</Chip>}
            </div>
            {outing.matchScore >= 70 && <Chip tone="teal">✨ Great match</Chip>}
          </div>

          <h3 className="font-bold mt-2.5 leading-snug line-clamp-2">{outing.title}</h3>

          <div className="flex items-center gap-2 mt-2">
            <Avatar name={outing.host.name} image={outing.host.image} size={20} />
            <span className="text-[12px] text-ink-faint truncate">
              Hosted by {outing.host.name}
            </span>
          </div>

          <p className="text-[12.5px] text-ink-soft mt-2">🗓️ {formatWhen(new Date(outing.startTime))}</p>
          <p className="text-[12.5px] text-ink-soft mt-0.5 truncate">📍 {outing.locationName}</p>
          <p className="text-[12.5px] text-ink-faint mt-0.5">
            ⏱ {formatDuration(outing.durationMinutes)}
            {outing.distanceKm !== null && ` · ${formatDistance(outing.distanceKm)} away`}
          </p>

          {outing.matchWhy.length > 0 && (
            <p className="text-[11.5px] text-teal-ink mt-2">
              {outing.matchWhy.join(" · ")}
            </p>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
            <AvatarStack people={outing.going} size={24} />
            <span className="text-[12px] font-bold text-ink-soft">
              {outing.viewerStatus !== "none"
                ? STATUS_LABEL[outing.viewerStatus]
                : `${outing.spotsLeft} spot${outing.spotsLeft === 1 ? "" : "s"} left`}
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
