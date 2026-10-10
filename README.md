# Planadate

AI-powered outing planner + activity-based social matching.

## Quick start

```bash
npm install
cp .env.example .env       # already done if you cloned this scaffold
npm run setup               # prisma generate + db push + seed
npm run dev
```

Open http://localhost:3000. Sign in with any seeded demo account, e.g.
`meera@planadate.demo` / `planadate123` (see `prisma/seed.ts` for the full list).

## AI planner

Set `ANTHROPIC_API_KEY` in `.env` to enable AI-generated itineraries
(`claude-opus-5` by default, `ANTHROPIC_MODEL` to override). Without a key,
`AI_PROVIDER` falls back to a deterministic offline planner
(`src/lib/ai/planner.ts`) so the whole app — including "make it cheaper" style
edits — still works end to end with zero external calls. Set
`AI_PROVIDER=mock` to force the offline planner even with a key present.

The LLM never invents places, prices or coordinates: it only orders and
explains a fixed candidate list built from `Activity` rows
(`src/lib/ai/catalog.ts`), and every clock time, cost total and travel
estimate is computed deterministically in `src/lib/ai/assemble.ts`.

## Architecture

- **Next.js App Router + TypeScript + Tailwind v4** — `src/app`, `src/components`
- **Prisma + SQLite (dev) / PostgreSQL (prod)** — `prisma/schema.prisma`. Switch
  the `datasource` provider and `DATABASE_URL` to move to Postgres; nothing
  else changes.
- **Auth.js (NextAuth v5) credentials + JWT sessions** — `src/lib/auth.ts`
- **Server actions** for all writes — `src/server/*.ts`; **server components**
  for all reads — `src/server/data.ts`
- **Chat transport**: polling (`/api/outings/[id]/messages`, `ChatPanel.tsx`).
  Swapping to WebSockets/Supabase Realtime means replacing that one hook —
  the authorisation rules stay in `src/server/chat.ts`.
- **Maps**: Leaflet + OpenStreetMap tiles, no API key required
  (`src/components/map`). Swap `NEXT_PUBLIC_MAP_TILE_URL` for another
  provider.
- **Geocoding**: bundled gazetteer of Kerala/India cities with Nominatim
  fallback (`src/lib/geo.ts`).

## Core flows implemented

1. **Plan** (`/plan`) — structured form → AI/deterministic itinerary → save,
   regenerate, conversational edits, per-item replace/move/remove.
2. **Find people** (`/people`, `/discover`) — post an activity, browse/filter/
   map, request to join, host accepts/declines, temporary chat opens,
   expires automatically.
3. **I'm here now** (`/here`) — same flow, framed for spontaneous, short
   activities.
4. **Safety** — report, block, public-meeting-point-only outings, coarsened
   map coordinates until you join, auto-expiring chat.

## Commands

- `npm run dev` — start the dev server
- `npm run db:reset` — wipe and reseed the local SQLite database
- `npm run typecheck` — TypeScript check
- `npm run build` — production build
