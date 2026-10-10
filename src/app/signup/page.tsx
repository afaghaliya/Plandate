"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { ToggleChip } from "@/components/ui/Chip";
import { INTEREST_CATEGORIES, interestEmoji, interestLabel, type InterestCategory } from "@/lib/domain";
import { signUp } from "@/server/account";

export default function SignUpPage() {
  const router = useRouter();
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="container-page max-w-md py-14">
      <h1 className="text-2xl font-extrabold text-center">Join Planadate</h1>
      <p className="text-center text-[13px] text-ink-faint mt-1.5">
        A few things so plans and people can match you well.
      </p>

      <Card className="mt-6">
        <CardBody>
          <form
            className="space-y-4"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await signUp({
                  name: String(formData.get("name") || ""),
                  email: String(formData.get("email") || ""),
                  password: String(formData.get("password") || ""),
                  homeCity: String(formData.get("homeCity") || ""),
                  birthYear: formData.get("birthYear") ? Number(formData.get("birthYear")) : null,
                  interests: interests as InterestCategory[],
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.push(`/signin?from=${encodeURIComponent("/plan")}`);
              });
            }}
          >
            {error && <Notice tone="danger">{error}</Notice>}

            <Field label="Your name">
              <Input name="name" required maxLength={60} placeholder="Meera Nair" />
            </Field>
            <Field label="Email">
              <Input type="email" name="email" required placeholder="you@email.com" />
            </Field>
            <Field label="Password" hint="At least 8 characters">
              <Input type="password" name="password" required minLength={8} placeholder="••••••••" />
            </Field>
            <Field label="Home city" hint="Used to personalise what you see nearby">
              <Input name="homeCity" placeholder="Kochi" />
            </Field>
            <Field label="Birth year" hint="Optional — helps with age-appropriate matches">
              <Input type="number" name="birthYear" min={1920} max={new Date().getFullYear() - 13} placeholder="1995" />
            </Field>

            <div>
              <span className="block text-[13px] font-bold mb-1.5">What are you into?</span>
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

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-[13px] text-ink-faint mt-5">
        Already have an account?{" "}
        <Link href="/signin" className="font-bold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
