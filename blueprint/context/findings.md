# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] open - `update()` builds its SET clause from unvalidated runtime keys

**File:** backend/src/repositories/video.repository.ts:38
**Found:** 2026-09-23 by /audit (scope: current; lens: security)
**Why it matters:** `Object.keys(changes)` is interpolated straight into the SQL
identifier position (`${field} = ?`). The `Partial<Pick<Video, ...>>` type is
erased at compile time, so it constrains typed callers only, not the object that
actually arrives at runtime. Confirmed in an isolated in-memory harness against
the real driver: a key of `status = 'FAILED', title` produces
`UPDATE videos SET status = 'FAILED', title = ?, updatedAt = ? WHERE id = ?` and
silently writes a column the caller never named. `update()` is a public method on
an exported class and on `IVideoRepository`, not a private helper. It is not
reachable today because this feature deliberately ships no route, controller, or
service (nothing constructs `VideoRepository` yet), which is why this is P2 rather
than a live vulnerability. Build-plan item 3 (Video upload API) is the first
consumer and the point where a request-shaped object could reach this method.
**Suggested fix:** Validate the keys against a fixed allowlist before building the
clause, for example
`const ALLOWED = ["hlsPlaylistPath", "status", "duration", "thumbnailPath"] as const;`
and filter `Object.keys(changes)` through it (throwing or ignoring anything else).
This is a few lines inside the existing method, adds no dependency or abstraction,
and loses no current requirement. Fix it before item 3 wires HTTP input in.
**Resolution:**

### F-02 [P2] open - `SELECT *` rows are cast to `Video` with no row-to-entity mapping

**File:** backend/src/repositories/video.repository.ts:24
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** `findById` and `findAll` both run `SELECT *` and cast the raw
row straight to `Video`. `coding-standards.md` states that repositories "map
between domain entities and stored rows in both directions (entity -> row on
write, row -> entity on read)"; a cast is an assertion, not a mapping, so the
entity boundary this feature exists to lock is not actually enforced. Two concrete
consequences: (1) any column a later migration adds flows through as an extra
property on the returned `Video` (verified in the harness - after
`ALTER TABLE videos ADD COLUMN internalNote`, the returned object carries
`internalNote`), and once item 3 serializes the entity to JSON that column is
exposed to the client without anyone deciding to expose it; (2) `status` is
asserted to be `VideoStatus` with no runtime check, which holds only because the
schema CHECK constraint happens to enforce it. Same pattern in `findAll` at
line 32.
**Suggested fix:** Select the columns explicitly and map the row to `Video` in one
small private `toEntity(row)` helper used by `findById` and `findAll`. No current
requirement is lost; this is the mapping the standards already ask for.
**Resolution:**

### F-03 [P2] open - `@types/better-sqlite3@^9.6.0` types a `better-sqlite3@^13.0.3` driver

**File:** backend/package.json:18
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** The driver is pinned at `^13.0.3` but the type definitions are
`^9.6.0`, four major versions behind. `better-sqlite3@13.0.3` ships no types of
its own (no `types`/`typings` field, no bundled `.d.ts`), so `tsc` resolves the
stale v9 stubs - confirmed with `--traceResolution`. `npm run build` and
`tsc --noEmit` are this project's only automated gate right now (no test runner is
configured), so that gate is currently validating the new persistence layer
against a different API surface than the one that runs. It already costs real
safety here: the v9 stubs declare `run(...params: any[])`, which is part of why
the untyped bind values in `update()` typecheck clean. Nothing is broken at
runtime today, because every API this feature uses (`prepare`, `run`, `get`,
`all`, `exec`, `transaction`) has been stable across those majors.
**Suggested fix:** Align the types with the installed driver - move
`@types/better-sqlite3` to the 13.x-compatible release, or drop the dev dependency
if a matching one does not exist and declare the narrow surface the repository
uses. No current requirement is lost either way.
**Resolution:**
