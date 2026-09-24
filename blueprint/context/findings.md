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
on a missing id still throws `NotFoundError`. Merged to main via GitHub PR #1
(commit `70f5812`) outside the normal `/complete` flow; this repair has not
had a fresh-reviewer pass, so it stays `fixed` here rather than `closed` until
one runs.
