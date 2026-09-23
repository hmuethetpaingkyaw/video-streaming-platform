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
**Resolution:** 2026-09-23, independent review of feature 3: the predicted
serialization path is now live. `videos.controller.ts:19` sends the repository's
`Video` straight to the client with `res.status(201).json(video)`, so any column a
later migration adds to `videos` will reach the API response with nobody deciding
to expose it. Nothing sensitive is exposed today (the current schema has no
internal-only column), so severity stays P2 and status stays `open`, but the
"once item 3 serializes the entity" condition in the original finding is no longer
hypothetical.

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

### F-04 [P2] open - A rejected upload leaves its file orphaned in `uploads/`

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
**Resolution:**

### F-05 [P2] open - Unexpected `500`s leave no server-side trace at all

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
**Resolution:**

### F-06 [P3] open - A file part under the wrong field name returns `500`, not `400`

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
**Resolution:**
