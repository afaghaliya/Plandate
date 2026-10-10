"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { RadioChip, ToggleChip } from "@/components/ui/Chip";
import { Stepper } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import {
  BUDGET_LABELS,
  BUDGET_TIERS,
  DURATION_PRESETS,
  GROUP_EMOJI,
  GROUP_LABELS,
  GROUP_TYPES,
  INTEREST_CATEGORIES,
  interestEmoji,
  interestLabel,
  type BudgetTier,
  type GroupType,
  type InterestCategory,
} from "@/lib/domain";
import { nextQuarterHour, toDateTimeLocal } from "@/lib/time";
import { createPlan } from "@/server/plans";

const CUSTOM_MINUTES = -1;

export function PlannerForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState(() => toDateTimeLocal(nextQuarterHour()));
  const [durationChoice, setDurationChoice] = useState<number>(DURATION_PRESETS[2].minutes);
  const [customDays, setCustomDays] = useState(1);
  const [customHours, setCustomHours] = useState(4);

  const [groupType, setGroupType] = useState<GroupType>("friends");
  const [adults, setAdults] = useState(4);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);

  const [interests, setInterests] = useState<string[]>([]);
  const [surpriseMe, setSurpriseMe] = useState(false);

  const [budgetTier, setBudgetTier] = useState<BudgetTier>("moderate");
  const [customBudget, setCustomBudget] = useState(2000);
  const [radiusKm, setRadiusKm] = useState(15);
  const [notes, setNotes] = useState("");

  const durationMinutes = useMemo(() => {
    if (durationChoice === CUSTOM_MINUTES) return customDays * 24 * 60 + customHours * 60;
    return durationChoice;
  }, [durationChoice, customDays, customHours]);

  function toggleInterest(interest: string, checked: boolean) {
    setSurpriseMe(false);
    setInterests((prev) => (checked ? [...prev, interest] : prev.filter((i) => i !== interest)));
  }

  function submit() {
    setError(null);
    if (!location.trim()) {
      setError("Tell us where you're going.");
      return;
    }
    if (!signedIn) {
      router.push(`/signin?from=${encodeURIComponent("/plan")}`);
      return;
    }
    startTransition(async () => {
      const result = await createPlan({
        location,
        startTime,
        durationMinutes,
        groupType,
        adults,
        children,
        childAges,
        budgetTier,
        budgetPerPerson: budgetTier === "custom" ? customBudget : null,
        interests: interests as InterestCategory[],
        surpriseMe,
        radiusKm,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/plan/${result.data.planId}`);
    });
  }

  return (
    <Card className="animate-rise">
      <CardBody className="space-y-7">
        {error && <Notice tone="danger">{error}</Notice>}

        <Field label="Where?" hint="A city or a neighbourhood — try Kochi, Munnar, Varkala, Alleppey, or Wayanad">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Kochi"
            autoComplete="off"
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="When does it start?">
            <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>

          <div>
            <span className="block text-[13px] font-bold mb-1.5">How much time?</span>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => (
                <RadioChip
                  key={preset.label}
                  label={preset.label}
                  checked={durationChoice === preset.minutes}
                  onChange={() => setDurationChoice(preset.minutes)}
                />
              ))}
              <RadioChip
                label="Custom"
                checked={durationChoice === CUSTOM_MINUTES}
                onChange={() => setDurationChoice(CUSTOM_MINUTES)}
              />
            </div>
            {durationChoice === CUSTOM_MINUTES && (
              <div className="flex gap-2 mt-2.5">
                <label className="flex items-center gap-1.5 text-[13px]">
                  <Input
                    type="number"
                    min={0}
                    max={14}
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className="w-16"
                  />
                  days
                </label>
                <label className="flex items-center gap-1.5 text-[13px]">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={customHours}
                    onChange={(e) => setCustomHours(Number(e.target.value))}
                    className="w-16"
                  />
                  hours
                </label>
              </div>
            )}
          </div>
        </div>

        <div>
          <span className="block text-[13px] font-bold mb-1.5">Going with?</span>
          <div className="flex flex-wrap gap-2">
            {GROUP_TYPES.filter((g) => g !== "custom").map((type) => (
              <RadioChip
                key={type}
                label={GROUP_LABELS[type]}
                emoji={GROUP_EMOJI[type]}
                checked={groupType === type}
                onChange={() => setGroupType(type)}
              />
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={40} />
            <Stepper
              label="Children"
              value={children}
              onChange={(n) => {
                setChildren(n);
                setChildAges((prev) => {
                  const next = prev.slice(0, n);
                  while (next.length < n) next.push(6);
                  return next;
                });
              }}
              min={0}
              max={12}
            />
          </div>

          {children > 0 && (
            <div className="mt-3">
              <span className="block text-[12.5px] font-semibold text-ink-soft mb-1.5">Children&apos;s ages</span>
              <div className="flex flex-wrap gap-2">
                {childAges.map((age, index) => (
                  <Input
                    key={index}
                    type="number"
                    min={0}
                    max={17}
                    value={age}
                    onChange={(e) =>
                      setChildAges((prev) => prev.map((a, i) => (i === index ? Number(e.target.value) : a)))
                    }
                    className="w-16"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-[13px] font-bold">What do you want to do?</span>
            <ToggleChip label="Surprise me" emoji="🎲" checked={surpriseMe} onChange={setSurpriseMe} />
          </div>
          <div className={surpriseMe ? "opacity-40 pointer-events-none" : ""}>
            <div className="flex flex-wrap gap-2">
              {INTEREST_CATEGORIES.map((interest) => (
                <ToggleChip
                  key={interest}
                  label={interestLabel(interest)}
                  emoji={interestEmoji(interest)}
                  checked={interests.includes(interest)}
                  onChange={(checked) => toggleInterest(interest, checked)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <span className="block text-[13px] font-bold mb-1.5">Budget</span>
            <div className="flex flex-wrap gap-2">
              {BUDGET_TIERS.map((tier) => (
                <RadioChip
                  key={tier}
                  label={BUDGET_LABELS[tier]}
                  checked={budgetTier === tier}
                  onChange={() => setBudgetTier(tier)}
                />
              ))}
            </div>
            {budgetTier === "custom" && (
              <div className="mt-2.5 max-w-40">
                <Input
                  type="number"
                  min={0}
                  value={customBudget}
                  onChange={(e) => setCustomBudget(Number(e.target.value))}
                />
                <span className="text-[12px] text-ink-faint">₹ per person</span>
              </div>
            )}
          </div>

          <Field label="Travel radius">
            <Select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
              <option value={5}>Within 5 km</option>
              <option value={15}>Within 15 km</option>
              <option value={30}>Within 30 km</option>
              <option value={60}>Within 60 km</option>
              <option value={150}>Anywhere in the region</option>
            </Select>
          </Field>
        </div>

        <Field label="Anything else?" hint="Optional — free text the assistant will factor in">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="We want something fun but not too tiring…"
            maxLength={1200}
          />
        </Field>

        <Button size="lg" className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Building your plan…" : "Generate my plan →"}
        </Button>
        {!signedIn && (
          <p className="text-[12.5px] text-ink-faint text-center -mt-4">
            You&apos;ll sign in to save and generate your plan.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
