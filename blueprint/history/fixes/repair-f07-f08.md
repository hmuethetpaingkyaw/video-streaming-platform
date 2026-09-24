# Fix: Repair F-07, resolve F-08

**Type:** Fix
**Status:** Verified
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


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4372,"specSha256":"2c69025940c6df2a672a6dc4c3a872b35687d46597b18bae311e24dd3dde5082","branch":"refs/heads/fix/repair-audit-findings","head":"70f5812e376a0ca0ffb33447130f6ffbbd321366","baseRef":"refs/heads/main","baseCommit":"6d9f4d2859666fa9c261bacb6fb4ac8dc80dbbb2","sourceTree":"97f17861b06b82a6f18566221bf41d4b4bc64266","absentOptional":[],"note":"merged via GitHub PR #1 as a non-squash merge commit, outside the normal /complete flow; archived after the fact for bookkeeping"} -->


## Findings

### repair-f07-f08/F-08 [P3] accepted - The `Video` entity's constructor is coupled to database column names

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
