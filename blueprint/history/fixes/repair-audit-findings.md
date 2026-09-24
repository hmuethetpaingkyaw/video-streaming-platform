# Fix: Repair audit findings F-01 through F-06

**Type:** Fix
**Status:** Verified
**Branch:** fix/repair-audit-findings
**Fixes:** F-01, F-02, F-03, F-04, F-05, F-06

## The problem

Six open findings from the independent reviews of features 2 and 3, all P2/P3,
none blocking, but all cheap, root-cause repairs worth doing now rather than
carrying forward:

- **F-01** (`video.repository.ts`) - `update()` builds its `SET` clause from
  `Object.keys(changes)` with no runtime check. The `Partial<Pick<...>>` type
  only constrains typed callers; an object with an unexpected key would
  silently write an unintended column. Not reachable today, but feature 3's
  controller is the first thing that could feed it caller-shaped data.
- **F-02** (`video.repository.ts`) - `findById`/`findAll` run `SELECT *` and
  cast the row straight to `Video`, so a future column added to `videos`
  would ride along unnoticed - now live, since `videos.controller.ts` sends
  that entity straight to the client as JSON.
- **F-03** (`package.json`) - `@types/better-sqlite3@^9.6.0` types the
  installed `better-sqlite3@^13.0.3` driver, four majors behind. No
  13.x-compatible release of the types package exists on npm (checked: latest
  published version is still `9.6.0`), so this can't be fixed by bumping a
  version.
- **F-04** (`error.middleware.ts`) - multer writes the uploaded file to disk
  before validation runs; nothing removes it when a later check or handler
  fails, leaking a file with no matching row on every rejected upload.
- **F-05** (`error.middleware.ts`) - the generic error branch discards `err`
  entirely. Registering this middleware also replaces Express's default
  handler, which used to print the stack to stderr, so an unexpected `500`
  now leaves zero trace anywhere - a real cost given there's no test runner
  and manual runs are the only signal this project has.
- **F-06** (`error.middleware.ts`) - a file sent under the wrong form field
  name raises a `MulterError`, which isn't mapped and falls into the generic
  `500` branch, misreporting a client mistake as a server fault.

## The fix

- **F-01:** filter `Object.keys(changes)` through a fixed allowlist
  (`hlsPlaylistPath`, `status`, `duration`, `thumbnailPath` - the exact keys
  `IVideoRepository.update`'s type already allows) before building the `SET`
  clause. Drop any other key rather than throwing - nothing legitimate sends
  one today, and silently ignoring an unknown key is a safe default for a
  repository method with no untrusted caller yet.
- **F-02:** select the nine locked columns explicitly (not `*`) in `findById`
  and `findAll`, and turn `Video` itself into a class whose constructor takes
  a raw row and assigns each field explicitly (`new Video(row)`), replacing
  the direct cast - row-to-row-shape mapping is domain logic, so it lives on
  the entity itself, not inside the repository (per user request) - so a future
  column never crosses the entity boundary unnoticed. `JSON.stringify`
  output is unchanged (verified byte-for-byte against the prior plain-object
  shape).
- **F-03:** remove the `@types/better-sqlite3` dev dependency and add a local
  ambient declaration (`backend/src/types/better-sqlite3.d.ts`) covering only
  the surface this project actually calls (`prepare`, `run`, `get`, `all`,
  `exec`, `transaction`, and the `Database`/`Database.Database` shape the
  three existing call sites already import). No behavior change - this only
  replaces a stale, unmaintained type source with an accurate narrow one.
- **F-04, F-05, F-06:** in the one existing error-handling middleware -
  unlink `req.file.path` (ignoring the callback result) whenever a request
  that reaches this handler carries a file, before responding, for every
  branch, since the reproduced leak was a `400` (duplicate `title` field), not
  only a `500`; log unexpected errors with `console.error(err)` as the first
  line of the generic branch, keeping the response body unchanged; and add a
  branch mapping `multer.MulterError` to `400` with a generic message (not the
  library's raw message). None of this adds file-type/size validation - that
  stays build-plan item 9's job.

Nothing here changes an existing success response, adds a dependency, or
touches build-plan scope.

## Build steps

- [x] 1. Repository fixes (F-01, F-02, F-03)
  - `backend/src/repositories/video.repository.ts`: add the `update()`
    allowlist filter; replace both `SELECT *` queries with the explicit
    column list; use `new Video(row)` in `findById` and `findAll`.
  - `backend/src/entities/video.entity.ts`: turn `Video` from an interface
    into a class with a `constructor(row: unknown)` that assigns each field
    explicitly.
  - Remove `@types/better-sqlite3` from `backend/package.json`; add
    `backend/src/types/better-sqlite3.d.ts` with the narrow ambient
    declaration described above.
  - Done when: `npx tsc --noEmit` is clean with `@types/better-sqlite3`
    removed; a manual `npx tsx` script confirms `update()` with an extra,
    non-allowlisted key no longer reaches the database (the row is unchanged
    except the allowed fields and `updatedAt`); and `findById`/`findAll`
    still return the same shape as before against a real row - no test
    runner is configured yet, so this isn't an automated test.

- [x] 2. Error-middleware fixes (F-04, F-05, F-06)
  - `backend/src/middleware/error.middleware.ts`: unlink `req.file.path` when
    present, for every branch; add `console.error(err)` to the generic
    branch; add the `multer.MulterError` -> `400` branch.
  - Done when: with the backend running, `curl -F "video=@file" -F
    "title=a" -F "title=b" .../videos` (duplicate `title` field - the
    reproduced F-04 case) returns `400` and the file does not remain in
    `uploads/`; `curl -F "file=@file" .../videos` (wrong field name) returns
    `400` instead of `500`; and a forced unexpected error still returns the
    unchanged generic `500` body while the server console now logs it - no
    test runner is configured yet, so this is manual `curl` evidence.

## Verify

`npm run build` (backend) passes, and the manual evidence in each step's
"Done when" above holds. No existing endpoint's success response changes.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6248,"specSha256":"892706ac85785f720cb38f9ffba99a8804e28477fdbb009bb70fcaa84dc1139b","branch":"refs/heads/fix/repair-audit-findings","head":"510a8c328cb395d1625d63a09723f39c44579b57","baseRef":"refs/heads/main","baseCommit":"6d9f4d2859666fa9c261bacb6fb4ac8dc80dbbb2","sourceTree":"859f0b788b162239e900679ebf4d1594295bde29","absentOptional":[]} -->


## Findings

### repair-audit-findings/F-01 [P2] closed - `update()` builds its SET clause from unvalidated runtime keys

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
**Resolution:** 2026-09-23, `fix/repair-audit-findings`: `update()` now filters
`Object.keys(changes)` through a fixed `UPDATABLE_FIELDS` allowlist before
building the `SET` clause, dropping any other key. Verified with a manual
`npx tsx` script: an update carrying the key `"status = 'FAILED', title"`
left `title`/`status` unchanged, while a legitimate update still applied.
**Resolution (independent review):** 2026-09-23, independent review of
`510a8c3` (fresh subagent). Reproduced the original repro against the real
driver in an in-memory database built from `0001_create_videos.sql`:
`update(1, { "status = 'FAILED', title": "PWNED", status: "READY" })` left
`title` as `original-title`, applied `status = READY`, and bumped `updatedAt`.
A second probe with only non-allowlisted keys, including
`"; DROP TABLE videos; --"`, left the table and every column intact. All four
allowlisted fields (`hlsPlaylistPath`, `status`, `duration`, `thumbnailPath`)
still write, including `duration: 0` (the filter uses `??`-free membership, so
falsy values are not dropped). `update()` on a missing id still throws
`NotFoundError`. Original defect gone, no new one in this method. Closed. The
residual drift hazard the allowlist introduces is tracked separately as F-07.

### repair-audit-findings/F-02 [P2] closed - `SELECT *` rows are cast to `Video` with no row-to-entity mapping

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
**Resolution:** 2026-09-23, independent review of feature 3: the predicted
serialization path is now live. `videos.controller.ts:19` sends the repository's
`Video` straight to the client with `res.status(201).json(video)`, so any column a
later migration adds to `videos` will reach the API response with nobody deciding
to expose it. Nothing sensitive is exposed today (the current schema has no
internal-only column), so severity stays P2 and status stays `open`, but the
"once item 3 serializes the entity" condition in the original finding is no longer
hypothetical.
**Resolution (continued):** 2026-09-23, `fix/repair-audit-findings`: `Video`
is now a class whose constructor takes a raw row and assigns each of the nine
locked fields explicitly; `findById`/`findAll` select the explicit column list
(not `*`) and construct `new Video(row)`. Verified with a manual `npx tsx`
script (`instanceof Video` true from `create`/`findById`/`findAll`) and that
`JSON.stringify` output is byte-identical to the prior plain-object shape.
**Resolution (independent review):** 2026-09-23, independent review of
`510a8c3` (fresh subagent). Reproduced the original repro: after
`ALTER TABLE videos ADD COLUMN internalNote TEXT DEFAULT 'secret'`, the raw
`SELECT *` row carries `internalNote` but `findById`/`findAll` do not
(`"internalNote" in video` is `false`), so the column no longer crosses the
entity boundary or the API response. `create`, `findById`, and `findAll` all
return `instanceof Video`, and `create()` maps too because it delegates to
`findById`. Client JSON shape is unchanged: a live `POST /videos` returned the
same nine keys in the same order with the same null-handling as the stored row
(`hlsPlaylistPath`, `duration`, `thumbnailPath` all `null`), and
`JSON.stringify(entity)` is byte-identical to the plain row. `duration: 0`
survives (`??`, not `||`). `findById` of a missing id still returns `null`.
Original defect gone, no new one. Closed. Residual, unchanged from the original
entry and not part of the suggested fix: the constructor still asserts
`row.status as VideoStatus` with no runtime check, which holds only because of
the schema `CHECK` constraint. The constructor's coupling to database column
names is tracked separately as F-08.

### repair-audit-findings/F-03 [P2] closed - `@types/better-sqlite3@^9.6.0` types a `better-sqlite3@^13.0.3` driver

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
**Resolution:** 2026-09-23, `fix/repair-audit-findings`: confirmed no
13.x-compatible `@types/better-sqlite3` release exists on npm (latest
published is still `9.6.0`), so removed the dependency entirely and added
`backend/src/types/better-sqlite3.d.ts`, a local ambient declaration covering
only `prepare`, `run`, `get`, `all`, `exec`, and `transaction`. Verified
`npx tsc --noEmit` is clean with the stale package removed.
**Resolution (independent review):** 2026-09-23, independent review of
`510a8c3` (fresh subagent). Confirmed the package is gone from
`backend/package.json`, from `backend/package-lock.json` (no
`types/better-sqlite3` entry remains), and from `node_modules/@types/`, so the
stale v9 stubs can no longer be resolved. `npx tsc --noEmit` and `npm run build`
both pass. Confirmed the local declaration is genuinely in force rather than the
import silently degrading to implicit `any`: an isolated probe compiled with the
project's exact compiler options rejects `db.pragma(...)` and `db.close()` as
missing members, which is only possible if the ambient declaration is the
resolved type source. Checked for hidden weakening: `run()` returns
`{ changes: number; lastInsertRowid: number | bigint }`, matching the real
driver (a `number`-typed `lastInsertRowid` is correctly rejected), and
`get()`/`all()` now return `unknown`/`unknown[]` where the v9 stubs returned
`any`/`any[]`, so nothing moved from a real check to `any` - the repair is
strictly stronger there. Original defect gone, no new one. Closed. Two accepted
trade-offs, neither a current defect: bind parameters are still untyped
(`run(...params: unknown[])`, exactly as permissive as the v9 `any[]` this
finding cited), and the declaration is deliberately narrow, so a future
`db.pragma()`, `db.close()`, or two-argument `new Database(file, options)` will
fail to compile until the declaration is extended.

### repair-audit-findings/F-04 [P2] closed - A rejected upload leaves its file orphaned in `uploads/`

**File:** backend/src/routes/videos.routes.ts:32
**Found:** 2026-09-23 by /audit (scope: current; lens: security)
**Why it matters:** `upload.single("video")` writes the file to disk before
`requireVideoFile` and `validate(createVideoSchema)` run, and nothing removes it
when a later handler fails. Multer deletes files only for errors it raises itself,
not for errors raised downstream. Confirmed against the real entrypoint on a clean
port: `curl -F "video=@file" -F "title=a" -F "title=b" .../videos` returns `400`
(`Invalid input: expected string, received array`) while the upload directory grew
from 14 to 15 files and no `videos` row was created. The same happens for any
`500` thrown by the controller, service, or repository after multer has finished.
Every such request leaves a file that no row references and no cleanup job will
ever collect, on the one path this project uses to write user data to disk. Build
plan item 9 adds file-type and size rejection, which will make this path far more
common, so the leak grows with the next feature rather than shrinking.
**Suggested fix:** Delete the just-written file when an errored request carries
one. `error.middleware.ts` already receives the request (currently ignored as
`_req`); use it and add `if (req.file) fs.unlink(req.file.path, () => {});` before
sending the mapped response. That is a few lines in the one handler every failure
already passes through, adds no dependency or abstraction, and loses no current
requirement.
**Resolution:** 2026-09-23, `fix/repair-audit-findings`: `error.middleware.ts`
now unlinks `req.file.path` (when present) unconditionally, before any
response branch, so the cleanup applies to every error type, not only the
generic one. Verified live: the reproduced duplicate-`title` case (`400`) no
longer leaves a file in `uploads/`, and neither does a forced unexpected `500`.
**Resolution (independent review):** 2026-09-23, independent review of
`510a8c3` (fresh subagent). Confirmed by reading
`backend/src/middleware/error.middleware.ts:13-15`: the `fs.unlink` runs before
any branch and before any `return`, so it covers the `ValidationError` 400, the
`NotFoundError` 404, the new `MulterError` 400, and the generic 500 alike.
Reproduced the original repro live against `src/index.ts` on a clean port with
an empty `uploads/`: a successful upload left 1 file; the duplicate-`title`
request returned `400` and the count stayed at 1; a forced unexpected error
(renaming the `videos` table from a second connection) returned `500` and the
count stayed at 1, so the file written for that request was removed. The
`missing file` case (`400 A video file is required`) also stayed at 1.
`req.file.path` is built by multer from a fixed `uploadsDir` plus a
`crypto.randomUUID()` name, so the deleted path is not client-controlled and
the unlink cannot traverse out of `uploads/`. Original defect gone, no new one.
Closed. Noted, not a defect: the unlink callback swallows its error, so a failed
cleanup is silent, and `req.files` (array/fields uploads) is not covered -
neither is reachable today, since only `upload.single("video")` exists.

### repair-audit-findings/F-05 [P2] closed - Unexpected `500`s leave no server-side trace at all

**File:** backend/src/middleware/error.middleware.ts:21
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** The generic branch responds `500` with a fixed message and
discards `err` entirely. Keeping the message out of the response body is correct
and matches the spec, but registering this handler also replaces Express's default
error handler, which prints the stack to stderr. The net effect is that the
project's first real failure path is now silent on both ends: the client learns
nothing (by design) and so does the operator. Confirmed by running the real
`src/index.ts` on a clean port: a request that returns `500` produced a server log
containing only `Backend listening on http://localhost:4200`. This cost real time
during this review; diagnosing one `500` required rebuilding the app in a separate
harness with a logging handler, because the running app emitted nothing. There is
no test runner (`AGENTS.md`), so manual runs are the only behavioral signal this
project has, and this removes the evidence they would produce. Build plan item 12
covers structured logging across the pipeline; this finding is narrower, about not
losing the stderr trace the app had before this middleware existed.
**Suggested fix:** Log the error before responding, for example `console.error(err)`
as the first line of the generic branch, matching the existing `console.log` in
`index.ts`. Keep the response body exactly as it is. One line, no dependency, and
no current requirement lost. Item 12 can replace `console.error` with the real
logger later.
**Resolution:** 2026-09-23, `fix/repair-audit-findings`: added
`console.error(err)` as the first line of the generic branch. Verified live:
forcing an unexpected error (deleting the SQLite file mid-request) still
returned the unchanged generic `500` body to the client, while the server
console now logged the full error and stack.
**Resolution (independent review):** 2026-09-23, independent review of
`510a8c3` (fresh subagent). Confirmed `console.error(err)` sits at
`error.middleware.ts:32`, inside the generic branch only, after every mapped
branch has returned - so the four expected client errors stay quiet and only
unexpected faults are logged. Reproduced live: a forced `SqliteError` returned
the unchanged body `{"error":{"message":"Internal server error"}}` with status
`500`, while the server log gained the full `SqliteError: no such table: videos`
with its stack and `code: 'SQLITE_ERROR'`. The response body is byte-identical
to the pre-fix contract, so nothing new leaks to the client. Original defect
gone, no new one. Closed.

### repair-audit-findings/F-06 [P3] closed - A file part under the wrong field name returns `500`, not `400`

**File:** backend/src/routes/videos.routes.ts:34
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** `upload.single("video")` raises a `MulterError`
(`LIMIT_UNEXPECTED_FILE`) for a file part sent under any other field name.
`error.middleware.ts` maps only `ValidationError` and `NotFoundError`, so that
client mistake falls into the generic branch and is reported as a server fault.
Confirmed against the real entrypoint: `curl -F "file=@video.mp4" .../videos`
returns `500 {"error":{"message":"Internal server error"}}`. This is a malformed
request, not a server failure, and the caller is told to retry rather than to fix
the field name. Recorded as P3 rather than higher because the spec's contract
already says any other thrown error is `500`, and build plan item 9 explicitly owns
"consistent API error responses"; this entry exists so item 9 has the concrete
case rather than rediscovering it.
**Suggested fix:** When item 9 lands, add a `MulterError` branch to
`error.middleware.ts` that maps to `400` with a safe message such as the expected
field name. No change is required before then.
**Resolution:** 2026-09-23, `fix/repair-audit-findings`: added a
`multer.MulterError` branch mapping to `400` with a generic
`"Invalid file upload"` message (not the library's raw message). Verified
live: `curl -F "file=@video.mp4" .../videos` now returns `400` instead of
`500`.
**Resolution (independent review):** 2026-09-23, independent review of
`510a8c3` (fresh subagent). Reproduced the original repro live:
`curl -F "file=@sample.mp4" http://localhost:4321/videos` now returns
`400 {"error":{"message":"Invalid file upload"}}`, where it previously returned
`500`. Confirmed the message does not leak the library's internal text - multer
raises `LIMIT_UNEXPECTED_FILE` with the raw message `Unexpected file field`,
which the branch replaces with its own generic string. `multer.MulterError` is
a real runtime export of the installed `multer@2.4.0`, and both
`error.middleware.ts` and `videos.routes.ts` import the same module instance, so
the `instanceof` check holds. The branch sits after `ValidationError` and
`NotFoundError` and before the generic 500, so no previously mapped status
changed; the other four probed requests still returned their original statuses.
Original defect gone, no new one. Closed. Noted: every `MulterError` code now
maps to the same generic 400 message, so build-plan item 9 will need to
distinguish `LIMIT_FILE_SIZE` from `LIMIT_UNEXPECTED_FILE` when it adds
size/type rejection.


## Independent review

**Status:** passed
**Target commit:** 510a8c328cb395d1625d63a09723f39c44579b57
**Base commit:** 6d9f4d2859666fa9c261bacb6fb4ac8dc80dbbb2
**Base ref:** refs/heads/main
**Spec hash:** 892706ac85785f720cb38f9ffba99a8804e28477fdbb009bb70fcaa84dc1139b
**Prepared by:** claude
**Builder model:** claude-sonnet-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5
**Requested execution:** automatic
**Requested at:** 2026-09-23T09:37:05Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-23T09:45:54Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD` / `git merge-base HEAD refs/heads/main` / `shasum -a 256 blueprint/context/current-feature.md`: pass (target, base, and spec hash all match the request)
- `git status --porcelain --untracked-files=all`: pass (only `blueprint/context/review.md` and `blueprint/context/findings.md` differ from the target)
- `git diff 6d9f4d2..510a8c3` / `git log 6d9f4d2..510a8c3`: pass (3 commits, 7 files, full delta reviewed)
- `npx tsc --noEmit` (backend): pass
- `npx tsc --noEmit --traceResolution` (backend): pass (`better-sqlite3` resolves to the 13.0.3 driver; no `@types/better-sqlite3` in the graph)
- `npm run build` (backend): pass
- `npx tsx src/index.ts` with `PORT=4321` plus 5 `curl` probes: pass (server started, probed, stopped; generated `data/`, `uploads/`, `dist/` removed afterwards)
- `npx tsx <scratch probe>` against an in-memory database built from `0001_create_videos.sql`: pass (repository allowlist and entity mapping exercised directly)
- `npm test` (backend): unavailable (placeholder script, `exit 1`; no runner configured)
- lint (backend): unavailable (no lint script in `backend/package.json`)
- browser tests: unavailable (no harness configured)

## Evidence

- F-01 reproduced and gone: `update(1, { "status = 'FAILED', title": "PWNED", status: "READY" })` left `title` unchanged, applied `status = READY`; a probe with only `"; DROP TABLE videos; --"`-style keys left the table and all columns intact; all four allowlisted fields including `duration: 0` still write.
- F-02 reproduced and gone: after `ALTER TABLE videos ADD COLUMN internalNote`, `findById`/`findAll` no longer carry the column that raw `SELECT *` shows; `create`/`findById`/`findAll` all return `instanceof Video`; live `POST /videos` returned the same nine keys, same order, same nulls as the stored row.
- F-03 verified: package gone from `package.json`, `package-lock.json`, and `node_modules/@types/`; an isolated probe compiled with the project's exact options rejects `db.pragma`/`db.close`, proving the local declaration is the active type source rather than implicit `any`; `run()` exposes `changes: number` and `lastInsertRowid: number | bigint`; `get`/`all` returned `unknown` where the v9 stubs returned `any`.
- F-04 reproduced and gone: with an empty `uploads/`, a good upload left 1 file, then the duplicate-`title` 400, the wrong-field 400, the missing-file 400, and a forced 500 each left the count at 1.
- F-05 reproduced and gone: a forced `SqliteError` returned the unchanged `{"error":{"message":"Internal server error"}}` body while the server log gained the full error and stack.
- F-06 reproduced and gone: `curl -F "file=@sample.mp4"` now returns `400 {"error":{"message":"Invalid file upload"}}`; multer's raw `Unexpected file field` text is not exposed.
- New: `(UPDATABLE_FIELDS as readonly string[]).includes(field)` erases the compile-time tie to `IVideoRepository.update`'s `Pick`, so list drift would silently drop a legitimate write (F-07).
- New: `Video`'s `constructor(row: unknown)` reads `videos` column names, placing row mapping in the entity rather than the repository as `coding-standards.md` specifies (F-08).
- Security/performance on the delta: the only interpolated SQL identifiers are now the fixed allowlist and a constant column list; `req.file.path` is multer-generated inside a fixed `uploadsDir`, so the new unlink is not client-steerable; `fs.unlink` is async and off the response path, and `new Video(row)` adds only per-row field assignment.

## Findings

- F-01 closed, F-02 closed, F-03 closed, F-04 closed, F-05 closed, F-06 closed
- F-07 [P2] open - the `update()` allowlist can silently drift from the interface it mirrors (non-blocking)
- F-08 [P3] open - the `Video` constructor is coupled to database column names (non-blocking; `current-feature.md` records this placement as an explicit user request, so `accepted` may be the right resolution)

## Remaining risk

- No test runner is configured, so `npm test` is unavailable and all six repairs rest on manual evidence that nothing re-runs. The allowlist filter, the entity mapping, and the three new error-middleware branches have no regression protection; `/tests` would fix this.
- No backend lint command and no browser harness exist, so those signals were unavailable for this delta.
- `update()` still has no production caller, so F-01's repair is proven only by direct harness calls, not by a real request path.
- Bind parameters remain untyped (`run(...params: unknown[])`), exactly as permissive as the `@types/better-sqlite3` v9 `any[]` that F-03 cited; a runtime-invalid bind such as `undefined` would still surface as a 500.
- The local `better-sqlite3` declaration is deliberately narrow, so a future `db.pragma()`, `db.close()`, or two-argument `new Database(file, options)` fails to compile until it is extended.
- The error middleware's `fs.unlink` callback swallows its error, so a failed cleanup is silent, and `req.files` is not covered - neither is reachable while only `upload.single("video")` exists.
- Every `MulterError` code maps to the same generic 400 message; build-plan item 9 will need to distinguish `LIMIT_FILE_SIZE` from `LIMIT_UNEXPECTED_FILE`.
- The `Video` constructor still asserts `row.status as VideoStatus` with no runtime check, relying on the schema `CHECK` constraint. Unchanged from before this delta and outside F-02's suggested fix.
