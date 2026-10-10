"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ToggleChip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { INTEREST_CATEGORIES, interestEmoji, interestLabel, type InterestCategory } from "@/lib/domain";
import { updateProfile } from "@/server/account";

export function ProfileEditForm({
  initial,
  userId,
}: {
  initial: { name: string; bio: string | null; homeCity: string | null; birthYear: number | null; interests: string[] };
  userId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [homeCity, setHomeCity] = useState(initial.homeCity ?? "");
  const [birthYear, setBirthYear] = useState(initial.birthYear?.toString() ?? "");
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardBody className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}

        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Bio" hint="What do you like doing? Keep it about activities, not a dating bio.">
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Home city">
            <Input value={homeCity} onChange={(e) => setHomeCity(e.target.value)} />
          </Field>
          <Field label="Birth year">
            <Input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              min={1920}
              max={new Date().getFullYear() - 13}
            />
          </Field>
        </div>

        <div>
          <span className="block text-[13px] font-bold mb-1.5">Interests</span>
          <div className="flex flex-wrap gap-2">
            {INTEREST_CATEGORIES.map((interest) => (
              <ToggleChip
                key={interest}
                label={interestLabel(interest)}
                emoji={interestEmoji(interest)}
                checked={interests.includes(interest)}
                onChange={(next) =>
                  setInterests((prev) => (next ? [...prev, interest] : prev.filter((i) => i !== interest)))
                }
              />
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await updateProfile({
                name,
                bio: bio || null,
                homeCity: homeCity || null,
                birthYear: birthYear ? Number(birthYear) : null,
                interests: interests as InterestCategory[],
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(`/profile/${userId}`);
            })
          }
        >
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </CardBody>
    </Card>
  );
}
