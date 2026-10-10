import { LinkButton } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export const metadata = { title: "How it works" };

const FLOWS = [
  {
    title: "AI planning",
    emoji: "🧠",
    steps: [
      "Enter location, group, duration, interests and budget",
      "The AI generates a structured, timed itinerary",
      "Tweak it conversationally — \"make it cheaper\", \"remove the beach\"",
      "Save the plan or turn any stop into a group activity",
    ],
  },
  {
    title: "Find people",
    emoji: "👥",
    steps: [
      "Post an activity — what, where, when, how many people",
      "Other users discover it on Discover or the map",
      "They request to join; you accept or decline",
      "A temporary group chat opens once accepted",
    ],
  },
  {
    title: "I'm here now",
    emoji: "📍",
    steps: [
      "Announce you're free right now, and what you're up for",
      "Nearby, compatible users see the request",
      "You connect, meet at a public place, and do the thing",
      "The activity — and its chat — expires automatically",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">How Planadate works</h1>
      <p className="text-[13.5px] text-ink-faint mb-8 max-w-xl">
        One product, three connected flows: plan the outing with AI, find people for it, or
        announce you&apos;re free right now.
      </p>

      <div className="space-y-5">
        {FLOWS.map((flow) => (
          <Card key={flow.title}>
            <CardBody>
              <h2 className="font-extrabold text-lg flex items-center gap-2">
                <span aria-hidden>{flow.emoji}</span> {flow.title}
              </h2>
              <ol className="mt-3 space-y-2">
                {flow.steps.map((step, i) => (
                  <li key={step} className="flex gap-2.5 text-[13.5px] text-ink-soft">
                    <span className="shrink-0 size-5 grid place-items-center rounded-full bg-brand-soft text-brand-ink text-[11px] font-extrabold">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 mt-8">
        <LinkButton href="/plan">Plan an outing</LinkButton>
        <LinkButton href="/people" variant="secondary">
          Find people
        </LinkButton>
      </div>
    </div>
  );
}
