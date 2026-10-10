# Audit report: Planadate (quick scope)

Scope: architecture, security, tests-ci. Frontend and backend were not audited as separate areas.
Top findings were spot-checked against the code; results are noted per issue.

## Overall stability: 5/10
The app is cleanly layered, and every mutating server action checks authorization. No IDOR was found in the paths the auditors read, and the LLM only ranks a fixed candidate list. Against that, there are no tests, no CI and no lint config. Nothing throttles sign-in, sign-up or the paid LLM calls, and two correctness bugs (geocoding and capacity) are confirmed in the code. It is fine as a demo and not ready for strangers to meet through it.

## Scorecard
| Area | Score | Top risk |
|---|---|---|
| Architecture | 7 | Geocoding collapses every outing in a known city to the same coordinates, and the capacity logic is racy |
| Security | 6 | No rate limiting, a known placeholder `AUTH_SECRET`, no middleware or security headers |
| Tests & CI | 2 | No tests, CI or working lint config, so the authorization logic has no regression protection |

## Top issues

### P0
1. **No tests, and authorization logic is unprotected.** package.json:5-15 has no test script. src/server/outings.ts, safety.ts, account.ts, chat.ts and src/app/api/outings/[id]/messages/route.ts have no tests. For an app that arranges real-world meetups, a silent authorization regression is high impact. Effort: M.

### P1
2. **Geocoder returns the city centroid for any venue in a known city.** (Confirmed.) src/lib/geo.ts:86-92: `geocode()` calls `cityKey()` first, and `cityKey()` falls back to substring matching (`norm.includes(key)`, geo.ts:54-56). "Marine Drive, Ernakulam" resolves to Ernakulam's centre and Nominatim is never asked. "goa" also matches any string containing it. Effort: S.
3. **Capacity and join logic is racy.** (Confirmed.) src/server/outings.ts:206-212 and 278-301 read the accepted count and then write in separate non-transactional steps. Concurrent accepts can overfill an outing, and `leaveOuting` can reopen a full outing without checking its cancelled or expired state. Effort: S-M.
4. **Placeholder `AUTH_SECRET` with no startup check.** (Confirmed.) .env:8 and .env.example:8 hold `dev-only-secret-change-me-in-production`, and src/lib/auth.ts doesn't enforce a real secret. If it ships to prod, anyone can forge sessions. Effort: S.
5. **No rate limiting.** No throttle on sign-in (src/lib/auth.ts:33), sign-up (src/server/account.ts:27), or the LLM calls `createPlan` and `askPlanAssistant` (src/server/plans.ts:54,160). Each LLM call can use up to 16000 output tokens (src/lib/ai/provider.ts:76), so any signed-up user can run up the Anthropic bill. Sign-up also reveals whether an email is registered (account.ts:34). Effort: M.
6. **Unverified accounts can request to join outings and message hosts with no abuse controls.** src/server/account.ts:44, src/server/outings.ts:169. Effort: M.
7. **No CI, and `npm run lint` has no config behind it.** (Confirmed: no `.github/`.) The script is `next lint`, but eslint isn't installed and there's no eslint config. Effort: S.
8. **`trustHost: true` is hard-coded.** src/lib/auth.ts:24, .env:9. It should be conditional on a trusted proxy, with `AUTH_URL` set explicitly in prod. Effort: S.
9. **AI planner code is untested.** src/lib/ai/planner.ts, assemble.ts, schema.ts and provider.ts have no fixtures of malformed model output. The `__setLlmProvider` seam in provider.ts:143 already makes this easy to test. Effort: M.

### P2
10. No `middleware.ts` (src/ has none), so route protection relies on each page and action remembering to check auth. No CSP or security headers in next.config.ts. Effort: M.
11. `sweepExpired` writes to the DB from read paths (src/server/data.ts:100,272,463) and isn't atomic, so concurrent sweeps can insert duplicate "chat is closed" messages. Effort: M.
12. Block checks are incomplete: the chat GET route and `sendMessage` don't re-check blocks between members. Reports accept arbitrary target IDs with no dedupe (src/server/safety.ts:46). Effort: S.
13. Plans can stay in "generating" forever if the process dies mid-call. `regeneratePlan` doesn't guard against double runs (src/server/plans.ts:99-148). Effort: S.
14. `createOuting` writes the outing and its system message separately, and the LLM call runs inside a server action with no timeout. Effort: S.
15. Config and docs drift. `.env.example:18` points to a `maps.ts` that doesn't exist. The README's Postgres claim ignores the JSON-as-string columns. `process.env` is read ad hoc in three modules. Effort: S.
16. `ActionResult` and `fail()` are copy-pasted into five server files. src/server/data.ts is 774 lines and mixes six concerns. Effort: S / M.
17. `prisma db push` only, with no migrations. Password policy is minimal, there is no reset flow, and bcrypt cost is 10. Chat has no send throttle. Geocoding calls aren't rate limited, and Nominatim bans heavy use. Effort: S-M each.

### P3
18. Dead code at src/server/plans.ts:72-74. OSM tile hotlinking is not allowed for production traffic. No Dependabot or `npm audit` step. The unused next-auth adapter tables are still in the schema.

**Downgraded:** the architecture auditor flagged the default `AI_PROVIDER="anthropic"` with an empty key as "every plan fails". The provider does throw `LlmUnavailableError` in that case (src/lib/ai/provider.ts:65-69). The planner's catch path was not read, so whether it falls back to the offline planner is unconfirmed. `.env:13` sets `AI_PROVIDER="anthropic"` explicitly, so the README's offline fallback doesn't apply as written. Treat as P2 until someone checks.

## Quick wins (S effort)
- Make `geocode()` use the gazetteer only on an exact key match. Otherwise try Nominatim first and fall back to the centroid, with word-boundary matching.
- Fail startup in production if `AUTH_SECRET` is empty or still the placeholder, and validate env with zod in one `src/lib/env.ts`.
- Wrap respondToRequest accept and the `leaveOuting` status flip in `prisma.$transaction`, recounting inside it.
- Install eslint and `eslint-config-next`, and add a GitHub Actions workflow running `npm ci`, `prisma generate`, typecheck, lint, test and build.
- Add Vitest and table-driven tests for matching.ts, expiry.ts, geo.ts, time.ts and money.ts.
- Move `ActionResult` and `fail` to `src/server/result.ts`, and fix the `.env.example` and README drift.
- Set `trustHost` conditionally and pin the exact next-auth beta version.

## Not verified
- Whether `.env`, `prisma/dev.db` and `tsbuildinfo` are untracked. The git root is the home directory, so `git ls-files` can't answer for this folder. `.gitignore` lists `.env` and `*.db`.
- `npm audit` and dependency CVEs. The auditors didn't run it, and `package-lock.json` wasn't reviewed.
- Page components under `src/app` (outings/[id], plans, messages, profile/edit, people/new) weren't read, so per-page auth gating wasn't confirmed.
- planner.ts, assemble.ts, catalog.ts and read.ts weren't read in depth, and neither were the Prisma schema, prisma/seed.ts, or whether `listMessages` sweeps expiry.
- Whether typecheck, lint or build currently pass. Nobody ran them.
- Frontend and backend areas weren't audited as separate passes.
