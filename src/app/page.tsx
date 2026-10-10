import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/Feedback";
import { getHomeFeed, getViewer } from "@/server/data";
import { interestEmoji, interestLabel } from "@/lib/domain";
import { formatWhen } from "@/lib/time";
import { formatPerPerson } from "@/lib/money";

export default async function HomePage() {
  const viewer = await getViewer();
  const feed = await getHomeFeed(viewer?.id ?? null);

  return (
    <div>
      <Hero signedIn={!!viewer} />

      <div className="container-page space-y-14 mt-14">
        <FeedRow
          title="Plans happening today"
          hint="Public activities other Planadate users have opened up"
          emptyText="Nothing scheduled yet today — be the first to post one."
          items={feed.today}
        />

        <FeedRow
          title="Near you"
          hint={viewer ? "Based on your home city" : "Sign in to personalise this"}
          emptyText="No nearby activities yet. Set your home city on your profile."
          items={feed.nearby}
        />

        {feed.hereNow.length > 0 && (
          <FeedRow
            title="Happening right now"
            hint="'I'm here now' — join in for the next few hours"
            emptyText=""
            items={feed.hereNow}
            tone="live"
          />
        )}

        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Popular near you</h2>
              <p className="text-[13px] text-ink-faint mt-0.5">
                Curated places our planner draws from
              </p>
            </div>
            <Link href="/plan" className="text-[13px] font-bold text-brand hover:underline">
              Plan with these →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {feed.popularPlaces.map((place) => (
              <Card key={place.id} className="hover:shadow-raised transition-shadow">
                <CardBody className="p-3.5">
                  <div className="text-2xl mb-2" aria-hidden>
                    {place.emoji}
                  </div>
                  <p className="font-bold text-[13px] leading-tight line-clamp-2">{place.name}</p>
                  <p className="text-[11.5px] text-ink-faint mt-1 capitalize">{place.city}</p>
                  <p className="text-[11.5px] text-brand-ink font-semibold mt-1.5">
                    {formatPerPerson(place.costPerPerson)}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <HowItWorks />

        <FindPeopleLikeYou signedIn={!!viewer} />
      </div>
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="hero-wash">
      <div className="container-page pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-2xl animate-rise">
          <Chip tone="brand" className="mb-5">
            ✨ AI-planned outings, real people to share them with
          </Chip>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05]">
            Where are you going?
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink-soft max-w-xl">
            Tell us where you are, who you&apos;re with, and how much time you have.
            We&apos;ll plan the outing — and help you find people to enjoy it with.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href="/plan" size="lg">
              Plan an outing →
            </LinkButton>
            <LinkButton href="/people" variant="secondary" size="lg">
              Find people
            </LinkButton>
          </div>
          {!signedIn && (
            <p className="mt-5 text-[13px] text-ink-faint">
              New here?{" "}
              <Link href="/signup" className="font-semibold text-brand hover:underline">
                Create a free account
              </Link>{" "}
              — or explore first, no sign-up needed.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function FeedRow({
  title,
  hint,
  emptyText,
  items,
  tone,
}: {
  title: string;
  hint: string;
  emptyText: string;
  items: Awaited<ReturnType<typeof getHomeFeed>>["today"];
  tone?: "live";
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            {tone === "live" && (
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
                <span className="relative inline-flex rounded-full size-2.5 bg-danger" />
              </span>
            )}
            {title}
          </h2>
          <p className="text-[13px] text-ink-faint mt-0.5">{hint}</p>
        </div>
        <Link href="/discover" className="text-[13px] font-bold text-brand hover:underline shrink-0">
          See all →
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState emoji="🌤️" title="Nothing here yet" body={emptyText} />
      ) : (
        <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {items.map((outing) => (
            <Link
              key={outing.id}
              href={`/outings/${outing.id}`}
              className="min-w-[15.5rem] max-w-[15.5rem] shrink-0"
            >
              <Card className="h-full hover:shadow-raised hover:-translate-y-0.5 transition-all">
                <CardBody>
                  <div className="flex items-start justify-between gap-2">
                    <Chip tone="brand">
                      {interestEmoji(outing.category)} {interestLabel(outing.category)}
                    </Chip>
                    {outing.isHereNow && <Chip tone="danger">● Live</Chip>}
                  </div>
                  <h3 className="font-bold mt-2.5 leading-snug line-clamp-2">{outing.title}</h3>
                  <p className="text-[12.5px] text-ink-faint mt-1">{formatWhen(new Date(outing.startTime))}</p>
                  <p className="text-[12.5px] text-ink-soft mt-0.5 truncate">📍 {outing.locationName}</p>
                  <div className="flex items-center justify-between mt-3">
                    <AvatarStack people={outing.going} size={24} />
                    <span className="text-[12px] font-bold text-ink-soft">
                      {outing.goingCount} going
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const STEPS = [
  {
    emoji: "📝",
    title: "Tell us the shape of your outing",
    body: "Where, who's coming, how long you have, what you're into and your budget.",
  },
  {
    emoji: "🧠",
    title: "Get a structured plan",
    body: "A timeline of real places, sequenced and explained for your specific group.",
  },
  {
    emoji: "🛠️",
    title: "Tweak it conversationally",
    body: "\"Make it cheaper\", \"remove the beach\", \"we have a 5-year-old\" — it adapts.",
  },
  {
    emoji: "🤝",
    title: "Find people for it",
    body: "Turn any stop into an open activity, or browse what others are already doing.",
  },
];

function HowItWorks() {
  return (
    <section>
      <h2 className="text-lg sm:text-xl font-bold mb-1">How Planadate works</h2>
      <p className="text-[13px] text-ink-faint mb-5">Four steps from intent to an actual outing.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((step, i) => (
          <Card key={step.title}>
            <CardBody>
              <div className="flex items-center gap-2 mb-2">
                <span className="grid place-items-center size-8 rounded-full bg-brand-soft text-brand-ink font-extrabold text-sm">
                  {i + 1}
                </span>
                <span className="text-xl" aria-hidden>
                  {step.emoji}
                </span>
              </div>
              <h3 className="font-bold text-[14.5px]">{step.title}</h3>
              <p className="text-[13px] text-ink-faint mt-1 leading-relaxed">{step.body}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FindPeopleLikeYou({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-teal-soft/60 border border-teal/20 p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6">
      <div className="flex-1">
        <Chip tone="teal" className="mb-3">
          👥 Social matching
        </Chip>
        <h2 className="text-xl sm:text-2xl font-extrabold">Find people doing things you like</h2>
        <p className="text-[13.5px] text-ink-soft mt-2 max-w-lg">
          Not a dating app — a way to find company for the things you actually want to do,
          from a sunset trek to a coffee twenty minutes from now. Temporary, activity-based,
          and always your choice to keep talking after.
        </p>
        <div className="mt-5 flex gap-3">
          <LinkButton href="/people">Browse activities</LinkButton>
          <LinkButton href={signedIn ? "/here" : "/signin"} variant="secondary">
            I&apos;m here now
          </LinkButton>
        </div>
      </div>
      <div className="hidden sm:flex flex-col gap-3">
        {["Meera", "Arjun", "Sana"].map((name) => (
          <Card key={name} className="w-56">
            <CardBody className="flex items-center gap-3 py-3">
              <Avatar name={name} size={34} />
              <div className="min-w-0">
                <p className="font-bold text-[13px] truncate">{name}</p>
                <p className="text-[11.5px] text-ink-faint truncate">into hiking, cafes, photography</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}
