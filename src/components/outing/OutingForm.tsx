"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea, Stepper } from "@/components/ui/Field";
import { RadioChip, ToggleChip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { INTEREST_CATEGORIES, interestEmoji, interestLabel } from "@/lib/domain";
import { nextQuarterHour, toDateTimeLocal, addMinutes } from "@/lib/time";
import { createOuting } from "@/server/outings";

const DURATIONS = [
  { label: "1 hr", minutes: 60 },
  { label: "2 hrs", minutes: 120 },
  { label: "3 hrs", minutes: 180 },
  { label: "4 hrs", minutes: 240 },
  { label: "Half day", minutes: 300 },
  { label: "Full day", minutes: 600 },
];

export function OutingForm({
  hereNowDefault = false,
  initial,
}: {
  hereNowDefault?: boolean;
  initial?: Partial<{ title: string; category: string; locationName: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(initial?.category ?? "sports");
  const [locationName, setLocationName] = useState(initial?.locationName ?? "");
  const [isHereNow, setIsHereNow] = useState(hereNowDefault);
  const [startTime, setStartTime] = useState(() => toDateTimeLocal(nextQuarterHour()));
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [capacity, setCapacity] = useState(4);
  const [ageGate, setAgeGate] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(45);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createOuting({
        title,
        description: description.trim() || null,
        category: category as (typeof INTEREST_CATEGORIES)[number],
        locationName,
        startTime,
        durationMinutes,
        capacity,
        minAge: ageGate ? minAge : null,
        maxAge: ageGate ? maxAge : null,
        isHereNow,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/outings/${result.data.outingId}`);
    });
  }

  const endsAt = addMinutes(new Date(startTime || Date.now()), durationMinutes);

  return (
    <Card>
      <CardBody className="space-y-5">
        {error && <Notice tone="danger">{error}</Notice>}

        <Field label="What's the activity?" hint="Short and specific reads best">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Looking for 3 people to play volleyball"
            maxLength={120}
          />
        </Field>

        <Field label="Public meeting point" hint="A named public place — never a private address">
          <Input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Papanasam Beach, Varkala"
          />
        </Field>

        <div>
          <span className="block text-[13px] font-bold mb-1.5">Category</span>
          <div className="flex flex-wrap gap-2">
            {INTEREST_CATEGORIES.map((interest) => (
              <RadioChip
                key={interest}
                label={interestLabel(interest)}
                emoji={interestEmoji(interest)}
                checked={category === interest}
                onChange={() => setCategory(interest)}
              />
            ))}
          </div>
        </div>

        <ToggleChip
          label="I'm there right now"
          emoji="📍"
          checked={isHereNow}
          onChange={setIsHereNow}
        />

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Starts" hint={`Ends around ${endsAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}>
            <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <div>
            <span className="block text-[13px] font-bold mb-1.5">Duration</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <RadioChip
                  key={d.minutes}
                  label={d.label}
                  checked={durationMinutes === d.minutes}
                  onChange={() => setDurationMinutes(d.minutes)}
                />
              ))}
            </div>
          </div>
        </div>

        <Stepper label="Total people wanted (including you)" value={capacity} onChange={setCapacity} min={2} max={40} />

        <div>
          <ToggleChip label="Set an age range" emoji="🎂" checked={ageGate} onChange={setAgeGate} />
          {ageGate && (
            <div className="flex gap-3 mt-2.5">
              <label className="flex items-center gap-1.5 text-[13px]">
                Min
                <Input type="number" value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} className="w-16" />
              </label>
              <label className="flex items-center gap-1.5 text-[13px]">
                Max
                <Input type="number" value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} className="w-16" />
              </label>
            </div>
          )}
        </div>

        <Field label="Details" hint="Optional — anything people should know before joining">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="Total beginners welcome, we rotate every game."
          />
        </Field>

        <Notice tone="info">
          For safety, meet in the public place you named above. You can accept or decline every
          request, and cancel the activity any time.
        </Notice>

        <Button
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={pending || !title.trim() || !locationName.trim()}
        >
          {pending ? "Posting…" : "Post activity →"}
        </Button>
      </CardBody>
    </Card>
  );
}
