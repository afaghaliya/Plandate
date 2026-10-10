/**
 * SQLite/Postgres-portable JSON column helpers. Columns are stored as TEXT so
 * every read goes through a total function that never throws on bad data.
 */

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    return (value ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function parseStringList(raw: string | null | undefined): string[] {
  const value = parseJson<unknown>(raw, []);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function parseNumberList(raw: string | null | undefined): number[] {
  const value = parseJson<unknown>(raw, []);
  return Array.isArray(value)
    ? value.map(Number).filter((n) => Number.isFinite(n))
    : [];
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
