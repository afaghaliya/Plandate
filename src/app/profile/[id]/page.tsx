import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import { getProfile } from "@/server/data";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { LinkButton } from "@/components/ui/Button";
import { interestEmoji, interestLabel, VERIFICATION_LABELS } from "@/lib/domain";
import { formatWhen } from "@/lib/time";
import { ReportButton } from "@/components/safety/ReportButton";
import { BlockButton } from "@/components/safety/BlockButton";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewerId = await currentUserId();
  const profile = await getProfile(id, viewerId);
  if (!profile) notFound();

  return (
    <div className="container-page max-w-2xl py-8">
      <Card>
        <CardBody className="flex flex-col sm:flex-row gap-5 items-start">
          <Avatar name={profile.name} image={profile.image} size={72} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold">{profile.name}</h1>
              <Chip tone={profile.verification === "none" ? "neutral" : "success"}>
                {profile.verification === "id_verified" ? "✓ " : ""}
                {VERIFICATION_LABELS[profile.verification]}
              </Chip>
            </div>
            <p className="text-[12.5px] text-ink-faint mt-0.5">
              {[profile.homeCity, profile.age ? `${profile.age} yrs` : null].filter(Boolean).join(" · ")}
            </p>
            {profile.bio && <p className="text-[13.5px] text-ink-soft mt-2.5 leading-relaxed">{profile.bio}</p>}

            <div className="flex gap-4 mt-3 text-[12.5px]">
              <span>
                <strong>{profile.outingsDone}</strong> <span className="text-ink-faint">outings</span>
              </span>
              <span>
                <strong>{profile.reputation}</strong> <span className="text-ink-faint">reputation</span>
              </span>
            </div>

            {profile.isSelf ? (
              <LinkButton href="/profile/edit" size="sm" variant="secondary" className="mt-3">
                Edit profile
              </LinkButton>
            ) : (
              viewerId && (
                <div className="flex gap-1 mt-3">
                  <ReportButton targetUserId={profile.id} />
                  <BlockButton targetUserId={profile.id} blocked={profile.isBlocked} />
                </div>
              )
            )}
          </div>
        </CardBody>
      </Card>

      {profile.interests.length > 0 && (
        <section className="mt-6">
          <h2 className="font-bold text-[14px] mb-2">What they like doing</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <Chip key={interest}>
                {interestEmoji(interest)} {interestLabel(interest)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {profile.visitedPlaces.length > 0 && (
        <section className="mt-6">
          <h2 className="font-bold text-[14px] mb-2">Places visited</h2>
          <div className="flex flex-wrap gap-2">
            {profile.visitedPlaces.map((place) => (
              <Chip key={place.id}>📍 {place.name}</Chip>
            ))}
          </div>
        </section>
      )}

      {profile.hostedOutings.length > 0 && (
        <section className="mt-6">
          <h2 className="font-bold text-[14px] mb-2">Recently hosted</h2>
          <div className="space-y-2">
            {profile.hostedOutings.map((o) => (
              <Link key={o.id} href={`/outings/${o.id}`}>
                <Card className="hover:shadow-raised transition-shadow">
                  <CardBody className="py-3 flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13px]">
                      {interestEmoji(o.category)} {o.title}
                    </span>
                    <span className="text-[12px] text-ink-faint">{formatWhen(new Date(o.startTime))}</span>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
