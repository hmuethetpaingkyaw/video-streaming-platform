# Fix: Repair audit findings F-01 through F-06

**Type:** Fix
**Status:** not started
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
