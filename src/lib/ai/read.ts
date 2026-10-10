import { parseJson } from "@/lib/json";
import { ItinerarySchema, type Itinerary } from "./schema";

/** Total, throwing-free read of a stored itinerary column. */
export function readItinerary(raw: string | null): Itinerary | null {
  if (!raw) return null;
  const parsed = ItinerarySchema.safeParse(parseJson<unknown>(raw, null));
  return parsed.success ? parsed.data : null;
}
