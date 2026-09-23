# Feature: Video Database Model

**From build-plan:** feature 2
**Build attempt:** 1
**Branch:** feature/video-database-model
**Status:** Verified

## Goal

Lock the `Video` persistence shape - a SQLite schema, a plain-`.sql` migration,
and a repository behind the documented layered architecture - so every later
feature (3-12) can read and write video records without touching the schema
or repository contract again.

## In scope

- `better-sqlite3` added as the SQLite driver, per the overview's tech stack.
- A minimal, file-based migration runner (plain `.sql` files, per the
  overview - no migration library) applied once at backend startup.
- The `videos` table, with exactly the columns the overview's data model
  locks: `id`, `title`, `originalPath`, `hlsPlaylistPath`, `status`,
  `duration`, `thumbnailPath`, `createdAt`, `updatedAt`.
- A `Video` domain entity and an `IVideoRepository`/`VideoRepository` pair
  covering the operations later features need: create, find by id, list all,
  and update the processing-result fields.

## Out of scope

- Any route, controller, or service - build-plan item 3 (Video upload API)
  is the first consumer and introduces those layers, plus the `container.ts`
  wiring, since nothing calls the repository yet.
- Any HTTP surface, validation middleware, or DTOs for video data.
- Deleting videos - no build-plan item needs it in V1.
- Postgres/`DATABASE_URL` - explicitly deferred beyond V1 per the overview.

## Build loop

Work through the build steps below one at a time, in order:

1. Implement the step.
2. Stop and show the diff plus how it was verified (commands run, output
   observed). Wait for review approval before continuing.
3. Once approved, create a checkpoint commit for that step, then move to the
   next step.

Do not start a later step before the current one is approved and committed.

## Build steps

- [x] 1. SQLite connection, migration runner, and the `videos` table
  - Add `better-sqlite3` (dependency) and `@types/better-sqlite3` (dev
    dependency) to `backend`.
  - Add `backend/src/db/connection.ts`: opens (creating if absent)
    `backend/data/app.db`, resolved from `__dirname` so it's independent of
    the process's working directory, and exports the shared `Database`
    instance.
  - Add `backend/src/db/migrate.ts`: exports `runMigrations(db)`. Ensures a
    `schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`
    bookkeeping table exists, then applies any `.sql` file from
    `backend/src/db/migrations/` (sorted by filename) not yet recorded there,
    each inside its own transaction.
  - Add `backend/src/db/migrations/0001_create_videos.sql` creating `videos`
    with the exact columns/types/constraints in Data / contracts below.
  - Call `runMigrations(db)` once in `backend/src/index.ts`, right after
    opening the connection and before `app.listen`.
  - Add `backend/data/` to the root `.gitignore` (the SQLite file is local,
    generated state, like `uploads/` already is).
  - Done when: `npm run dev` (backend) starts without error, creates
    `backend/data/app.db`, and `sqlite3 backend/data/app.db ".schema
    videos"` shows exactly the locked columns and constraints; restarting
    the server a second time does not error or duplicate the migration
    (manual verification with the `sqlite3` CLI - no test runner is
    configured yet).

- [x] 2. `Video` entity and repository
  - Add `backend/src/entities/video.entity.ts`: the `VideoStatus` union
    (`"PROCESSING" | "READY" | "FAILED"`) and the `Video` entity matching
    Data / contracts below.
  - Add `backend/src/errors/NotFoundError.ts`: a typed error for an update
    targeting a missing row, per the documented error-handling convention.
  - Add `backend/src/repositories/interfaces/IVideoRepository.ts` and
    `backend/src/repositories/video.repository.ts` implementing it:
    - `create({ title, originalPath })` - inserts a row (status defaults to
      `PROCESSING` at the schema level), returns the created `Video`.
    - `findById(id)` - returns the `Video` or `null` when no row matches.
    - `findAll()` - returns every `Video`, newest first (`ORDER BY id DESC`).
    - `update(id, changes)` - `changes` is a partial `Pick<Video,
      "hlsPlaylistPath" | "status" | "duration" | "thumbnailPath">`; sets
      `updatedAt` to the current time and returns the updated `Video`; throws
      `NotFoundError` when `id` doesn't exist.
    - The repository generates `createdAt`/`updatedAt` as
      `new Date().toISOString()`; it is the only layer that imports
      `better-sqlite3` or touches SQL, per the documented backend
      architecture.
  - Done when: a manual script run with `npx tsx` against the dev database
    creates a video, updates its `status` to `READY` with an
    `hlsPlaylistPath`, confirms `findById` reflects the change, confirms
    `findAll` includes it, and confirms `update` on a non-existent id throws
    `NotFoundError` - output shown (no test runner is configured yet, so
    this isn't an automated test).

## Files / areas

- `backend/package.json` - add `better-sqlite3`, `@types/better-sqlite3`.
- `backend/src/db/connection.ts` - new.
- `backend/src/db/migrate.ts` - new.
- `backend/src/db/migrations/0001_create_videos.sql` - new.
- `backend/src/index.ts` - open the connection and run migrations at startup.
- `backend/src/entities/video.entity.ts` - new.
- `backend/src/errors/NotFoundError.ts` - new.
- `backend/src/repositories/interfaces/IVideoRepository.ts` - new.
- `backend/src/repositories/video.repository.ts` - new.
- `.gitignore` (root) - add `backend/data/`.

## Data / contracts

`videos` table:

```sql
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  originalPath TEXT NOT NULL,
  hlsPlaylistPath TEXT,
  status TEXT NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'READY', 'FAILED')),
  duration REAL,
  thumbnailPath TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

`Video` entity (`backend/src/entities/video.entity.ts`):

```ts
type VideoStatus = "PROCESSING" | "READY" | "FAILED";

interface Video {
  id: number;
  title: string;
  originalPath: string;
  hlsPlaylistPath: string | null;
  status: VideoStatus;
  duration: number | null;
  thumbnailPath: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

`IVideoRepository`:

- `create(input: { title: string; originalPath: string }): Video`
- `findById(id: number): Video | null`
- `findAll(): Video[]`
- `update(id: number, changes: Partial<Pick<Video, "hlsPlaylistPath" | "status" | "duration" | "thumbnailPath">>): Video` (throws `NotFoundError` if `id` is unknown)

## Testing

No test runner is configured yet (per `AGENTS.md`), so there is no automated
test gate. Verify with the `sqlite3` CLI (schema) and a manual `npx tsx`
script exercising the repository (data), as described in each step's "Done
when".

## Notes for the AI

- Don't add a Service, Controller, Route, or `container.ts` in this feature -
  nothing calls the repository yet. Build-plan item 3 introduces the first
  consumer and wires the repository through the container at that point.
- Don't add `DATABASE_URL` or any other env var - the overview only expects
  that once the project ever moves off SQLite, which is explicitly out of
  V1.
- `better-sqlite3` is synchronous by design; call it directly from the
  repository without wrapping it in promises.
- Keep the exact column names and casing (`originalPath`, `hlsPlaylistPath`,
  `thumbnailPath`, `createdAt`, `updatedAt`) - later features read/write
  these as-is per the overview's locked data model.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":7673,"specSha256":"0bdffacfd25b91579fe4947213a07b6ca8714bb8e55ffdb63589f10e3f68a1c1","branch":"refs/heads/feature/video-database-model","head":"b132f2435fb85187d771fdbed14ff335c09eb9c6","baseRef":"refs/heads/main","baseCommit":"5487a3b0b37ea2cdb53488236dfb3b70762bf7dc","sourceTree":"cdaf1996f2c0019733a635112359ba174466fbc0","absentOptional":[]} -->


## Independent review

**Status:** passed
**Target commit:** b132f2435fb85187d771fdbed14ff335c09eb9c6
**Base commit:** 5487a3b0b37ea2cdb53488236dfb3b70762bf7dc
**Base ref:** refs/heads/main
**Spec hash:** 0bdffacfd25b91579fe4947213a07b6ca8714bb8e55ffdb63589f10e3f68a1c1
**Prepared by:** claude
**Builder model:** claude-sonnet-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5
**Requested execution:** automatic
**Requested at:** 2026-09-23T05:43:50Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-23T05:48:29Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git diff 5487a3b..b132f24` / `git log 5487a3b..b132f24`: pass (4 commits, 12 files reviewed)
- `npx tsc --noEmit` (backend): pass
- `npm run build` (backend, includes `postbuild`): pass, `dist/db/migrations/0001_create_videos.sql` present
- `npm test` (backend): unavailable (placeholder script, no runner configured)

## Evidence

- Migration runner verified against the real driver in an isolated in-memory
  database: `db.exec(<migration>)` inside `db.transaction()` applies and rolls
  back correctly on failure, so a partial migration cannot be recorded.
- Idempotency is enforced by the `schema_migrations` primary key plus the
  applied-set check; re-running applies nothing.
- Schema matches the spec's locked column list exactly: the `CHECK (status IN
  (...))` constraint rejects an out-of-union value and `status` defaults to
  `PROCESSING` on insert.
- All repository reads and writes bind values with `?` placeholders; no user
  data is string-interpolated into SQL.
- `update()` correctly raises `NotFoundError` only for a missing row: an UPDATE
  with identical values still reports `changes = 1`, so no false negative.
- `connection.ts` resolves `backend/data` from `__dirname`, which lands on the
  same directory from `src/db` under `tsx` and from `dist/db` after a build.
- `backend/data/` is gitignored; the build leaves the tracked tree clean.

## Findings

- F-01 [P2] open - `update()` builds its SET clause from unvalidated runtime keys
- F-02 [P2] open - `SELECT *` rows are cast to `Video` with no row-to-entity mapping
- F-03 [P2] open - `@types/better-sqlite3@^9.6.0` types a `better-sqlite3@^13.0.3` driver

## Remaining risk

- No test runner is configured (`npm test` is a placeholder), so there is no
  automated coverage of the repository or migration runner. This matches
  `AGENTS.md` and the spec's Testing section, so no test gate applies, but the
  tests lens has no executable signal to report.
- Both build steps' "Done when" evidence was manual (`sqlite3` CLI schema dump
  and an `npx tsx` script). Check was not required for this request and no dev
  server was started, so that manual evidence was not independently re-run.
- The migration runner records filenames only, with no content checksum, so an
  edit to an already-applied `.sql` file is silently ignored. Acceptable for a
  deliberately minimal runner; worth knowing before schema changes land.
- Two backend processes starting concurrently against the same database file
  could both see a migration as unapplied; the loser's transaction fails and
  crashes that process. Not reachable in the V1 single-local-user setup.
- `findAll()` is unbounded by design per the locked repository contract, so list
  size will need revisiting once a real library size exists.
- No dependency vulnerability scanner was run; manifest inspection is not a
  vulnerability scan.

## Handoff

Review the active spec and the complete `<base>..<target>` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.
