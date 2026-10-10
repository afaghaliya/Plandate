import { Card, CardBody } from "@/components/ui/Card";

export const metadata = { title: "Community guidelines & safety" };

const PRINCIPLES = [
  {
    emoji: "📍",
    title: "Meet in public",
    body: "Every outing points to a named public place — never a private address. Stick to it, especially for a first meetup.",
  },
  {
    emoji: "🔍",
    title: "Look before you meet",
    body: "Check a profile's verification badge, reputation and past outings before joining. A blank profile isn't a reason to say no, but it's a reason to be a bit more careful.",
  },
  {
    emoji: "🚩",
    title: "Report, don't confront",
    body: "If something feels off, report it from the profile or activity page. Reports go to a review queue — the person reported is never shown who reported them.",
  },
  {
    emoji: "🚫",
    title: "Block anytime",
    body: "Blocking someone removes you from each other's activities immediately and is fully reversible only by you.",
  },
  {
    emoji: "⏳",
    title: "Everything here is temporary by default",
    body: "Activity chats close automatically when the activity ends. Nothing carries over unless you both choose to keep talking.",
  },
  {
    emoji: "🧭",
    title: "This is not a dating app",
    body: "Planadate is built for activity companionship. Romantic intent should be obvious in what you post, never disguised as something else.",
  },
];

export default function SafetyPage() {
  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Community guidelines</h1>
      <p className="text-[13.5px] text-ink-faint mb-8">
        Planadate connects strangers around real activities. These are the defaults we build the
        product around.
      </p>

      <div className="grid gap-4">
        {PRINCIPLES.map((p) => (
          <Card key={p.title}>
            <CardBody className="flex gap-3.5">
              <span className="text-2xl shrink-0" aria-hidden>
                {p.emoji}
              </span>
              <div>
                <h2 className="font-bold text-[14.5px]">{p.title}</h2>
                <p className="text-[13px] text-ink-faint mt-1 leading-relaxed">{p.body}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
