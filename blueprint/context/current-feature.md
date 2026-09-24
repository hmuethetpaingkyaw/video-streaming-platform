# Fix: Repair F-07, resolve F-08

**Type:** Fix
**Status:** not started
**Branch:** fix/repair-audit-findings
**Fixes:** F-07, F-08

## The problem

Two findings from the independent review of the previous fix
(`fix/repair-audit-findings`), continued on the same branch since it hasn't
merged yet and the code they reference only exists there:

- **F-07** (`video.repository.ts`) - the `UPDATABLE_FIELDS` allowlist that
  closed F-01 is cast to `readonly string[]` before the `.includes()` check,
  which erases the compile-time tie to `IVideoRepository.update`'s type. If a
  future field is added to that type's `Pick` but not to `UPDATABLE_FIELDS`,
  the write silently no-ops - no compile error, no runtime error, just a
  persisted row missing the new field.
- **F-08** (`video.entity.ts`) - `Video`'s constructor reads raw `videos`
  column names, which `coding-standards.md` previously said belongs to the
  repository. The user has asked twice this session for row construction to
  live on the entity (`new Video(row)`), so this is a deliberate, accepted
  design choice, not a defect - the standard needs to catch up to it, not the
  other way around.

## The fix

- **F-07:** remove the dynamic `SET`-clause construction that made an
  allowlist necessary in the first place, rather than making the allowlist
  check itself safer. `update()` now fetches the current row, then runs one
  fixed query - `UPDATE videos SET hlsPlaylistPath = ?, status = ?, duration
  = ?, thumbnailPath = ?, updatedAt = ? WHERE id = ?` - with a static column
  list, filling each value from `changes` and falling back to the current
  value (`??`) when a field wasn't provided, preserving partial-update
  semantics for callers. There is no `Object.keys(changes)` or
  `UPDATABLE_FIELDS` left at all: no runtime key ever reaches the query, so
  there's nothing left to allowlist and no type that can drift out of sync.
- **F-08:** accepted, not repaired - `new Video(row)` stays exactly as it is.
  Update `coding-standards.md`'s Domain Entities section so it documents this
  as an allowed pattern (the entity may build itself from a raw row) instead
  of mandating repository-side mapping, so a future audit doesn't re-raise it.
  Mark F-08 `accepted` in the ledger with this reasoning.

Nothing here changes an existing success response or persisted behavior for
any currently-reachable path (`update()` has no live caller yet). One
accepted trade-off: `??` treats an explicit `null` the same as "not
provided," so this design can't currently be used to deliberately clear
`hlsPlaylistPath`/`thumbnailPath`/`duration` back to `null` - no build-plan
item needs that today.

## Build steps

- [x] 1. Replace the dynamic update with a static query (F-07)
  - `backend/src/repositories/video.repository.ts`: remove
    `UPDATABLE_FIELDS`. Rewrite `update()` to call `findById(id)` first
    (throwing `NotFoundError` when it returns `null`), then run the one
    fixed `UPDATE` statement described above with `changes.<field> ??
    current.<field>` for each of the four columns.
  - Done when: `npx tsc --noEmit` is clean; a manual `npx tsx` script
    confirms a partial update changes only the given fields and leaves the
    rest at their current values (including a second partial update after
    the first, proving values already set survive), and that `update()` on a
    missing id still throws `NotFoundError` - no test runner is configured
    yet, so this isn't an automated test.

- [x] 2. Resolve F-08 as accepted and update the standard
  - `blueprint/context/coding-standards.md`: update the Domain Entities
    section to document that an entity may construct itself from a raw row
    (`new Video(row)`) as an alternative to repository-side mapping, keeping
    the actual boundary (only the repository ever reads a raw row or touches
    the database driver's types).
  - `blueprint/context/findings.md`: mark F-08 `accepted` with the reasoning
    above in its `Resolution`.
  - Done when: the ledger shows F-08 `accepted` and the standard reads
    consistently with the shipped `Video` constructor - no code change, so no
    build/test evidence beyond a read-through.

## Verify

`npm run build` (backend) passes. Step 1's manual `npx tsx` evidence
(partial-update merge behavior and the `NotFoundError` path) is the concrete
proof this fix does what it claims.
