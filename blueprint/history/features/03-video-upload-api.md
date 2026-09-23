# Feature: Video Upload API

**From build-plan:** feature 3
**Build attempt:** 1
**Branch:** feature/video-upload-api
**Status:** Verified

## Goal

An endpoint that accepts a video file over HTTP, stores it to local disk, and
creates a `videos` row with status `PROCESSING`, wired through the full
Routes -> Controller -> Service -> Repository stack for the first time.

## In scope

- `POST /videos`: accepts one multipart file field (`video`) plus an optional
  `title` text field, saves the file under `backend/uploads/`, creates the
  video record, and returns it.
- The first `IVideoService`/`VideoService` (business logic layer) and
  `container.ts` (composition root), per the documented backend architecture.
- The project's first global error-handling middleware and its first custom
  `ValidationError`, since this is the first endpoint with a real failure path.
- Missing-file rejection (no file field at all cannot be turned into a video
  record).

## Out of scope

- File type/size validation (~2GB cap, mp4/mov/webm/mkv allowlist) - build-plan
  item 9 owns that policy and the fuller "consistent API error responses" pass.
  This feature accepts any file multer will take, unrestricted.
- Any frontend upload form - build-plan item 4.
- Triggering FFmpeg/transcoding - build-plan item 5. The created record stays
  `PROCESSING` until that feature exists to move it forward.
- A `GET /videos` list or `GET /videos/:id` read endpoint - no build-plan item
  before 4 asks for one; item 4 will need to add it as part of its own backend
  companion work.
- Concurrent-upload safety beyond what SQLite already guarantees - single
  local user, per the usage model.

## Build loop

Work through the build steps below one at a time, in order:

1. Implement the step.
2. Stop and show the diff plus how it was verified (commands run, output
   observed). Wait for review approval before continuing.
3. Once approved, create a checkpoint commit for that step, then move to the
   next step.

Do not start a later step before the current one is approved and committed.

## Build steps

- [x] 1. `VideoService` (business logic layer)
  - Add `backend/src/services/interfaces/IVideoService.ts`: a `CreateVideoInput`
    type (`{ title?: string; originalFilename: string; storedPath: string }` -
    plain data, no Express/Multer type, so the service stays transport-agnostic)
    and `IVideoService.createVideo(input: CreateVideoInput): Video`.
  - Add `backend/src/services/video.service.ts`: `VideoService implements
    IVideoService`, constructed with an `IVideoRepository`. `createVideo`
    trims `input.title`; when it's missing or empty, defaults it to
    `input.originalFilename` with its extension stripped
    (`path.basename(name, path.extname(name))`); then calls
    `videoRepository.create({ title, originalPath: input.storedPath })` and
    returns the result (`status` is `PROCESSING` by the schema default from
    build-plan item 2).
  - Done when: a manual `npx tsx` script constructs `VideoService` with a real
    `VideoRepository` (as feature 2's smoke test did) and confirms: calling
    `createVideo({ originalFilename: "My Vacation.mp4", storedPath:
    "uploads/abc123.mp4" })` returns a video with `title: "My Vacation"`,
    `originalPath: "uploads/abc123.mp4"`, `status: "PROCESSING"`; and calling
    with an explicit `title: "Custom Title"` returns that title unchanged - no
    test runner is configured yet, so this isn't an automated test.

- [x] 2. `POST /videos` (HTTP layer, error handling, and wiring)
  - Add `multer` (dependency) and `@types/multer` (dev dependency, only if
    multer doesn't already ship its own types) and `zod` (dependency, per the
    documented validation convention - not installed yet).
  - Add `backend/src/errors/ValidationError.ts`, matching `NotFoundError`'s
    shape.
  - Add `backend/src/middleware/error.middleware.ts`: the one global Express
    error-handling middleware. Maps `ValidationError` to `400`, `NotFoundError`
    to `404`, anything else to `500` with a generic message (never the raw
    error message or stack). Response body shape for every mapped error:
    `{ "error": { "message": string } }`. Register it last, after every route,
    in `backend/src/index.ts`.
  - Add `backend/src/dtos/video.dto.ts`: `createVideoSchema = z.object({ title:
    z.string().trim().min(1).optional() })` and the inferred
    `CreateVideoRequestDto` type, validating the multipart request's text
    field only (the file itself is multer's concern, not Zod's).
  - Add `backend/src/routes/videos.routes.ts`:
    - Configure multer with `diskStorage`: `destination` resolves to
      `backend/uploads/` from `__dirname` (creating it with `fs.mkdirSync(...,
      { recursive: true })` if absent, matching `db/connection.ts`'s
      `data/` pattern) and `filename` generates
      `` `${crypto.randomUUID()}${path.extname(file.originalname)}` `` - never
      the client-supplied name, so no path-traversal or collision risk.
    - `router.post("/", upload.single("video"), requireVideoFile,
      validate(createVideoSchema), videosController.create)`, where
      `requireVideoFile` is a small local middleware that calls
      `next(new ValidationError("A video file is required"))` when
      `req.file` is absent, and `validate` is a small reusable Zod-validating
      middleware factory at `backend/src/middleware/validate.middleware.ts`
      (`(schema) => (req, res, next) => ...`, replacing `req.body` with the
      parsed result or calling `next` with a `ValidationError` built from the
      Zod issues).
  - Add `backend/src/controllers/videos.controller.ts`: `VideosController`
    constructed with an `IVideoService`. `create(req, res)` reads the already-
    validated `req.body.title` and `req.file` (present and typed by this
    point), builds `storedPath = path.join("uploads", req.file.filename)`
    (a path relative to the backend root, not the absolute disk path multer
    reports), calls `videoService.createVideo({ title: req.body.title,
    originalFilename: req.file.originalname, storedPath })`, and responds
    `201` with the created `Video` as JSON (reusing the entity type directly -
    no fields need hiding, so no separate response DTO).
  - Add `backend/src/container.ts`: the composition root. Constructs
    `VideoRepository(db)` -> `VideoService(videoRepository)` ->
    `VideosController(videoService)` once, and exports the controller (and any
    instance a future route needs) for `index.ts` to wire into
    `videos.routes.ts`.
  - Wire `app.use("/videos", videosRoutes)` and the error-handling middleware
    (last) into `backend/src/index.ts`.
  - Done when: with the backend running, `curl -F "video=@<any local file>"
    http://localhost:4000/videos` returns `201` with a JSON video whose
    `title` matches the uploaded file's basename and `status` is
    `"PROCESSING"`; the file appears under `backend/uploads/` with a generated
    name; `sqlite3 backend/data/app.db "SELECT * FROM videos"` shows the new
    row; and `curl -X POST http://localhost:4000/videos` (no file) returns
    `400` with `{"error":{"message":"A video file is required"}}` - no test
    runner is configured yet, so this is manual `curl`/`sqlite3` evidence.

## Files / areas

- `backend/package.json` - add `multer`, `zod`, and `@types/multer` if needed.
- `backend/src/services/interfaces/IVideoService.ts` - new.
- `backend/src/services/video.service.ts` - new.
- `backend/src/errors/ValidationError.ts` - new.
- `backend/src/middleware/error.middleware.ts` - new.
- `backend/src/middleware/validate.middleware.ts` - new.
- `backend/src/dtos/video.dto.ts` - new.
- `backend/src/routes/videos.routes.ts` - new.
- `backend/src/controllers/videos.controller.ts` - new.
- `backend/src/container.ts` - new.
- `backend/src/index.ts` - mount `/videos`, register the error middleware
  last.

## Data / contracts

`POST /videos` (multipart/form-data):

- Request: one file field `video` (required); one optional text field
  `title`.
- Success: `201`, body is the created `Video` entity (from
  `backend/src/entities/video.entity.ts`, unchanged from feature 2):
  `{ id, title, originalPath, hlsPlaylistPath: null, status: "PROCESSING",
  duration: null, thumbnailPath: null, createdAt, updatedAt }`.
- Missing file: `400`, `{ "error": { "message": "A video file is required" } }`.
- Any other thrown error: `500`, `{ "error": { "message": "Internal server
  error" } }` - never the underlying message or stack.
- `originalPath` stored value: `uploads/<generated-filename>` (relative to the
  backend root, not an absolute path) - `<generated-filename>` is
  `crypto.randomUUID()` plus the original file's extension.
- `title` default when omitted or blank: the uploaded file's original
  filename with its extension stripped.

## Testing

No test runner is configured yet (per `AGENTS.md`). Step 1 is pure logic
without a runner to enforce a gate, verified manually per its "Done when".
Step 2 is an HTTP/integration surface, verified with `curl` and the `sqlite3`
CLI per its "Done when", consistent with the coding standards' testing scope
(integration surfaces ride on direct evidence, not unit tests).

## Notes for the AI

- Keep the service's input a plain object, not `Express.Multer.File` - the
  service layer must stay usable without Express/Multer in scope, matching how
  `IVideoRepository` already stays free of `better-sqlite3` types outside the
  repository.
- `requireVideoFile` throwing before `validate(createVideoSchema)` runs is
  deliberate: a request with no file at all is a shape problem, not a
  title-validation problem, and should fail with the clearer message.
- Do not add `express.json()` or any other global body parser - this endpoint
  is multipart-only and multer parses that directly; no other route needs a
  JSON body yet.
- Do not add file-type or file-size limits to the multer config - that is
  build-plan item 9's explicit job, including the friendlier error shape for
  it. Leave a comment-free TODO out of the code; the build plan already tracks
  this.
- `container.ts` only wires what exists today (one repository, one service,
  one controller). Extend it in place for item 4 rather than redesigning it.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10254,"specSha256":"0f4e5a977e39ad22edfff0f2c73076ce62971f8aca1d4f305a80c2a13d8a0b80","branch":"refs/heads/feature/video-upload-api","head":"1a069abd51dd165973248f4c3c5cf0ac15ece70f","baseRef":"refs/heads/main","baseCommit":"22ba9ffa76150b9876ace7fbbb6bf53bf1befd79","sourceTree":"2ce39ef94f48c00b86cb386b88cbec1cd87be5f0","absentOptional":[]} -->


## Independent review

**Status:** passed
**Target commit:** 1a069abd51dd165973248f4c3c5cf0ac15ece70f
**Base commit:** 22ba9ffa76150b9876ace7fbbb6bf53bf1befd79
**Base ref:** refs/heads/main
**Spec hash:** 0f4e5a977e39ad22edfff0f2c73076ce62971f8aca1d4f305a80c2a13d8a0b80
**Prepared by:** claude
**Builder model:** claude-sonnet-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5
**Requested execution:** automatic
**Requested at:** 2026-09-23T08:59:03Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-23T09:06:27Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD` / `git merge-base HEAD refs/heads/main` / `shasum -a 256 blueprint/context/current-feature.md`: pass (target, base, and spec hash all match the request)
- `git status --porcelain`: pass (only `blueprint/context/review.md` differs from the target)
- `npx tsc --noEmit` (backend): pass
- `npm run build` (backend): pass
- `npm test` (backend): unavailable (placeholder script, no runner configured)
- Manual `curl` probes against `src/index.ts` on an unused port: pass (see Evidence)

## Evidence

- Upload filename is server-generated. `videos.routes.ts:18` builds it from `crypto.randomUUID()` plus `path.extname(file.originalname)`; the client name never reaches the path. A request sending `filename=../../../../tmp/pwned.mp4` stored `uploads/5fe3512e-....mp4` and created no file outside the upload directory.
- The client's original filename is only read to derive `title`, which reaches SQLite through the parameterized `INSERT` in `video.repository.ts:15`. Nothing writes it to disk.
- Spec contract verified live: upload returns `201` with the filename-derived title and `status: "PROCESSING"`; an explicit title is trimmed and kept; a missing file returns `400 {"error":{"message":"A video file is required"}}`.
- `dtos/video.dto.ts:4` is `z.string().trim().optional()` with no `.min(1)`. A whitespace-only `title` was accepted and fell through to the service default in `video.service.ts:12`, as the spec requires.
- `req.file!` in `videos.controller.ts:11` is safe: `requireVideoFile` sits between `upload.single("video")` and the controller in the `videos.routes.ts:32` chain and calls `next(err)`, which skips the remaining route handlers on every path.
- `error.middleware.ts:21` returns a fixed `"Internal server error"` string with no error message, stack, or filesystem path. Verified on two distinct `500` responses.
- No caller of `videoRepository.update()` exists anywhere in `backend/src` (checked by search), so the existing P2 finding F-01 stays unreachable in this delta.
- Port 4000 was held by a leftover `pnpm dev` process from an earlier session whose database file had been deleted underneath it; every upload against it returned `500`. Three clean processes running the same committed source, including an exact `index.ts` wiring clone, all returned `201`. The stale process, not the code, produced those failures.

## Findings

- F-04 [P2] open - a rejected upload leaves its file orphaned in `uploads/`
- F-05 [P2] open - unexpected `500`s leave no server-side trace at all
- F-06 [P3] open - a file part under the wrong field name returns `500`, not `400`
- F-02 [P2] open - Resolution updated: this feature makes the predicted entity-to-JSON exposure path live

## Remaining risk

- `npm test` is a placeholder and no test runner is configured, so this delta has no automated regression coverage. All behavioral evidence above is manual `curl` from this session and does not survive into CI.
- The multer config sets no `limits`, so upload size, field count, and part count are unbounded on this route. The spec defers this to build plan item 9 and the project overview records a single, fully trusted, non-internet-facing local user, so it is accepted interim scope rather than a finding. It becomes load-bearing the moment the app is exposed.
- `title` is unbounded in length and holds arbitrary client text. Safe at the database boundary, but build plan item 4 is the first code to render it and owns the escaping decision.
- No lint command exists for the backend, so no style or dead-code signal beyond `tsc` was available.
- Performance review is static only. No profiling or load evidence was gathered, and the synchronous `better-sqlite3` driver's effect under concurrent uploads is untested.
