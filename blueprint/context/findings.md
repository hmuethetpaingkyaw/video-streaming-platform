# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-07 [P2] fixed - The `update()` allowlist can silently drift from the interface it mirrors

**File:** backend/src/repositories/video.repository.ts:8
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** `UPDATABLE_FIELDS` hand-copies the four keys that
`IVideoRepository.update`'s `Partial<Pick<Video, ...>>` already names, and the
filter erases the tie between them:
`(UPDATABLE_FIELDS as readonly string[]).includes(field)` widens the tuple to
`readonly string[]`, so `includes` accepts any `string` and the compiler can
never compare the two lists. Combined with the deliberate "drop the key rather
than throw" choice from F-01, an addition to the interface's `Pick` produces a
silent no-op write: `update(id, { newField: value })` would typecheck, run
`UPDATE videos SET updatedAt = ? WHERE id = ?`, return a `Video`, and never
persist the field, with no error at compile time or runtime. Confirmed in an
in-memory harness against the real driver: an update whose keys are all filtered
out still succeeds and returns the unchanged row. No defect today - the two
lists currently match exactly - but build-plan item 4 (transcoding) is the first
consumer of `update()`, and item 5 onward are the likely points where a column
gets added to one list and not the other.
**Suggested fix:** Tie the allowlist to the interface type so the compiler
catches drift, for example
`const UPDATABLE_FIELDS = ["hlsPlaylistPath", "status", "duration", "thumbnailPath"] as const satisfies readonly (keyof UpdateChanges)[];`
and drop the `as readonly string[]` cast by filtering with
`UPDATABLE_FIELDS.includes(field as (typeof UPDATABLE_FIELDS)[number])`. To also
catch additions, derive the list from a
`Record<keyof UpdateChanges, true>` and use `Object.keys` on it. This is a few
lines inside the existing module, adds no dependency or abstraction, and loses
no current requirement.
**Resolution:** 2026-09-23, `fix/repair-audit-findings`: repaired by removing
the class of problem rather than hardening the check. `update()` no longer
builds a `SET` clause from `Object.keys(changes)` at all - it fetches the
current row, then runs one fixed `UPDATE videos SET hlsPlaylistPath = ?,
status = ?, duration = ?, thumbnailPath = ?, updatedAt = ? WHERE id = ?`
query, filling each value from `changes ?? current`. `UPDATABLE_FIELDS` is
removed entirely; no runtime key ever reaches the query, so there is nothing
left to allowlist or for a type to drift out of sync with. Verified with a
manual `npx tsx` script: a partial update changes only the given fields, a
second partial update afterward preserves the first's values, and `update()`
on a missing id still throws `NotFoundError`.

### F-08 [P3] accepted - The `Video` entity's constructor is coupled to database column names

**File:** backend/src/entities/video.entity.ts:14
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** `coding-standards.md` places row mapping in the repository
("Repositories map between domain entities and stored rows in both directions
(entity -> row on write, row -> entity on read)") and defines a domain entity as
"independent of both the external request/response shape (DTOs) and the database
schema". `Video`'s new `constructor(row: unknown)` reads the nine `videos`
columns by name off a raw driver row, so the entity - the layer furthest from
the driver - now encodes the storage schema. The concrete consequence: a
migration that renames a column, or a second storage backend with different
column names, forces a change to `video.entity.ts` rather than to the repository
that owns persistence, and every other layer that imports `Video`
(`video.service.ts`, both interface files) picks up that coupling transitively.
The fix this repairs (F-02) is intact either way; this is only about where the
mapping lives. `current-feature.md` records this placement as an explicit user
request during the build, so the user may reasonably resolve this as `accepted`
rather than repair it.
**Suggested fix:** Move the field-by-field assignment into a small private
`toEntity(row)` in `video.repository.ts` (the shape the original F-02 suggested
fix described) and let `Video` stay a plain data type, or keep the class but
give it a typed field constructor and have the repository do the row-to-field
translation. Nothing is lost either way: the explicit `SELECT` column list and
the explicit assignment that close F-02 stay exactly as they are. If the current
placement is the intended design, the standards' repository-mapping rule should
be updated to match so the next reviewer does not raise this again.
**Resolution:** 2026-09-23, user's explicit decision: keep `new Video(row)` as
the row-construction pattern; not repairing. `coding-standards.md`'s Domain
Entities section is updated to document this as an allowed pattern - an
entity may build itself from a raw row via its constructor, as an alternative
to repository-side mapping - so the boundary that matters (only the
repository ever reads a raw row or imports the database driver's types)
stays documented accurately and a future audit doesn't re-raise this.
