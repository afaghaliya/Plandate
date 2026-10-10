import { z } from "zod";
import { INTEREST_CATEGORIES } from "@/lib/domain";

/**
 * Two schemas live here:
 *
 *  - `PlanDraftSchema` is what the LLM is allowed to return. It is deliberately
 *    thin: ordering, narrative and which catalogue entry to use. No clock
 *    times, no coordinates, no prices -- the model cannot invent those.
 *  - `ItinerarySchema` is the assembled artefact the app stores and renders,
 *    produced by `assembleItinerary` from a draft + the activity catalogue.
 */

export const ENTRY_KINDS = ["activity", "food", "break", "travel", "custom"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const PlanDraftEntrySchema = z.object({
  /** Catalogue slug. Required for kind "activity" and "food". */
  slug: z.string().nullable().optional(),
  kind: z.enum(ENTRY_KINDS),
  /** Used only when there is no slug (breaks, custom stops). */
  title: z.string().max(120).nullable().optional(),
  /** Model may shorten/extend a catalogue duration within reason. */
  durationMinutes: z.number().int().min(10).max(600).nullable().optional(),
  /** One sentence, group-specific, explaining the pick. */
  why: z.string().max(400),
  /** Optional practical note shown on the card. */
  note: z.string().max(400).nullable().optional(),
});
export type PlanDraftEntry = z.infer<typeof PlanDraftEntrySchema>;

export const PlanDraftDaySchema = z.object({
  label: z.string().max(80),
  entries: z.array(PlanDraftEntrySchema).min(1).max(14),
});

export const PlanDraftAlternativeSchema = z.object({
  slug: z.string(),
  why: z.string().max(300),
});

export const PlanDraftSchema = z.object({
  title: z.string().max(120),
  summary: z.string().max(700),
  days: z.array(PlanDraftDaySchema).min(1).max(7),
  tips: z.array(z.string().max(300)).max(6).default([]),
  warnings: z.array(z.string().max(300)).max(6).default([]),
  alternatives: z.array(PlanDraftAlternativeSchema).max(6).default([]),
  /** Present on edits: what the model changed and why. */
  changeSummary: z.string().max(500).nullable().optional(),
});
export type PlanDraft = z.infer<typeof PlanDraftSchema>;

// ------------------------------------------------------------- assembled

export const ItineraryItemSchema = z.object({
  id: z.string(),
  kind: z.enum(ENTRY_KINDS),
  title: z.string(),
  activityId: z.string().nullable(),
  activitySlug: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number(),
  locationName: z.string(),
  city: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  category: z.string(),
  tags: z.array(z.string()),
  costPerPerson: z.number(),
  currency: z.string(),
  description: z.string(),
  why: z.string(),
  note: z.string().nullable(),
  travelMinutesFromPrevious: z.number(),
  distanceKmFromPrevious: z.number(),
  bookingRequired: z.boolean(),
  emoji: z.string(),
});
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

export const ItineraryDaySchema = z.object({
  index: z.number(),
  label: z.string(),
  date: z.string(),
  items: z.array(ItineraryItemSchema),
});
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;

export const ItineraryTotalsSchema = z.object({
  costPerPerson: z.number(),
  costForGroup: z.number(),
  currency: z.string(),
  activityMinutes: z.number(),
  travelMinutes: z.number(),
  itemCount: z.number(),
});

export const ItineraryAlternativeSchema = z.object({
  activityId: z.string(),
  activitySlug: z.string(),
  title: z.string(),
  locationName: z.string(),
  category: z.string(),
  durationMinutes: z.number(),
  costPerPerson: z.number(),
  currency: z.string(),
  emoji: z.string(),
  why: z.string(),
});
export type ItineraryAlternative = z.infer<typeof ItineraryAlternativeSchema>;

export const ItinerarySchema = z.object({
  version: z.literal(1),
  title: z.string(),
  summary: z.string(),
  days: z.array(ItineraryDaySchema),
  totals: ItineraryTotalsSchema,
  tips: z.array(z.string()),
  warnings: z.array(z.string()),
  alternatives: z.array(ItineraryAlternativeSchema),
  changeSummary: z.string().nullable(),
  generatedAt: z.string(),
  generator: z.string(),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

/** JSON Schema handed to the model (kept in sync with PlanDraftSchema). */
export const PLAN_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "days", "tips", "warnings", "alternatives"],
  properties: {
    title: { type: "string", description: "Short plan title, e.g. '6-hour Kochi friends plan'" },
    summary: { type: "string", description: "2-3 sentences on the shape of the plan" },
    days: {
      type: "array",
      minItems: 1,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "entries"],
        properties: {
          label: { type: "string", description: "e.g. 'Day 1 - coast and cafes'" },
          entries: {
            type: "array",
            minItems: 1,
            maxItems: 14,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "why"],
              properties: {
                slug: {
                  type: ["string", "null"],
                  description: "Catalogue slug from the candidate list. Required unless kind is 'break' or 'custom'.",
                },
                kind: { type: "string", enum: [...ENTRY_KINDS] },
                title: { type: ["string", "null"], description: "Only for 'break'/'custom' entries" },
                durationMinutes: { type: ["integer", "null"], minimum: 10, maximum: 600 },
                why: { type: "string", description: "One sentence tied to this specific group" },
                note: { type: ["string", "null"], description: "Practical note, or null" },
              },
            },
          },
        },
      },
    },
    tips: { type: "array", maxItems: 6, items: { type: "string" } },
    warnings: { type: "array", maxItems: 6, items: { type: "string" } },
    alternatives: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "why"],
        properties: {
          slug: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    changeSummary: {
      type: ["string", "null"],
      description: "On an edit: one sentence on what changed. Null on first generation.",
    },
  },
} as const;

export const CATEGORY_ENUM = [...INTEREST_CATEGORIES];
