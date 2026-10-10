"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUserId } from "@/lib/auth";
import { INTEREST_CATEGORIES } from "@/lib/domain";
import { stringifyJson } from "@/lib/json";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "What should we call you?").max(60),
  email: z.string().trim().email("That doesn't look like an email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  homeCity: z.string().trim().max(80).nullable().optional(),
  birthYear: z.coerce.number().int().min(1920).max(new Date().getFullYear() - 13).nullable().optional(),
  interests: z.array(z.enum(INTEREST_CATEGORIES)).max(20).default([]),
});

export async function signUp(raw: z.input<typeof signUpSchema>): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const input = parsed.data;
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("An account with that email already exists.");

  await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      homeCity: input.homeCity?.trim() || null,
      birthYear: input.birthYear ?? null,
      interests: stringifyJson(input.interests),
      // Credentials sign-up is unverified until email confirmation ships.
      verification: "none",
    },
  });

  return { ok: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(400).nullable().optional(),
  homeCity: z.string().trim().max(80).nullable().optional(),
  birthYear: z.coerce.number().int().min(1920).max(new Date().getFullYear() - 13).nullable().optional(),
  interests: z.array(z.enum(INTEREST_CATEGORIES)).max(20).default([]),
});

export async function updateProfile(raw: z.input<typeof profileSchema>): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return fail("Sign in first.");
  }

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const input = parsed.data;

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      bio: input.bio?.trim() || null,
      homeCity: input.homeCity?.trim() || null,
      birthYear: input.birthYear ?? null,
      interests: stringifyJson(input.interests),
    },
  });

  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  return { ok: true };
}
