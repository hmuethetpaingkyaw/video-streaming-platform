# Feature: Upload UI

**From build-plan:** feature 4
**Build attempt:** 1
**Branch:** feature/upload-ui
**Status:** Verified

## Goal

A `/upload` page with a form to submit a video file to the existing
`POST /videos`, and a `/` page listing every uploaded video with its status.
This is the first frontend feature that talks to the videos API, so it also adds
the missing read endpoint (`GET /videos`) the list needs.

## In scope

- Backend: `GET /videos` returning all videos newest first (the repository's
  existing `findAll` already orders by `id DESC`), through the existing
  Routes -> Controller -> Service -> Repository stack. Response shape is a JSON
  array of the same video object `POST /videos` already returns.
- Frontend `/` (server component): fetches `GET /videos` from the backend with
  `cache: "no-store"` and renders one row per video: title, status, created
  time. A link to `/upload`.
  - **Empty state:** "No videos yet" with the upload link.
  - **Error state:** if the backend is unreachable or returns non-2xx, show
    "Could not load videos" instead of the list (this also keeps the
    "backend unreachable" signal the foundation health-check gave on `/`).
  - **Loading state:** a route-level `loading.tsx`.
  - Status is always shown as text (`PROCESSING` / `READY` / `FAILED`), not by
    color alone. All three values are rendered even though only `PROCESSING`
    exists until feature 5.
- Frontend `/upload` (client component form): a required file input, an
  optional title input, a submit button.
  - Submits `multipart/form-data` (`video`, optional `title`) with `fetch`.
  - While submitting: button disabled and labeled "Uploading...".
  - Success (201): navigate to `/` (list is `no-store`, so the new video shows).
  - Failure: show the backend's `error.message` (or a generic fallback when the
    request itself fails) in an element with `role="alert"`; the form stays
    filled and usable.
  - Labels associated to inputs. A missing file is blocked with the native
    `required` attribute; the server's "A video file is required" is still
    displayed if it ever comes back.
  - Video title and filenames are rendered as React text (never as HTML).
- Browser -> backend transport: a Next.js `rewrites()` entry in
  `next.config.ts` that proxies `/api/backend/:path*` to `BACKEND_URL`, so the
  browser never makes a cross-origin call and the backend needs no CORS. The
  server component uses `BACKEND_URL` directly, as the existing health check does.
- Replace the scaffold `metadata` (title/description "Create Next App") with
  real values, since these are now the app's real pages.

## Out of scope

- File type/size validation, error-response consistency: item 9. The file input
  gets no `accept` restriction beyond a `video/*` hint; it is not validation.
- Transcoding, so videos stay `PROCESSING`: item 5.
- Auto-refresh/polling of the list: item 8. A manual reload is how status
  updates show until then.
- Playback links, player page: item 6.
- Thumbnails: item 10.
- Upload progress bar, drag and drop, cancel: not in the plan.
- Empty/loading/error *polish*: item 11. This feature only provides the basic
  states above.
- Delete/edit endpoints, pagination, search: not in the plan (17 owns search).
- Exposing `originalPath`/internal fields in the UI: the API keeps returning
  them (as `POST` already does); the UI does not render them.

## Build loop

`workflow.stepReview` is `every` and `workflow.checkpointCommits` is `enabled`.
Work through the build steps below one at a time, in order:

1. Implement the step.
2. Stop and show the diff plus how it was verified (commands run, output
   observed). Wait for review approval before continuing.
3. Once approved, create a checkpoint commit for that step, then move to the next.

Do not start a later step before the current one is approved and committed.
`/complete` creates the final feature commit.

## Build steps

- [x] 1. Environment baseline and `GET /videos`
  - Run `npm install` in `backend/` and `frontend/` (neither has `node_modules`
    in this worktree, so `tsc` and `eslint` cannot run yet), then record the
    baseline: `npm run build` in both and `npm run lint` in `frontend/`.
  - `IVideoService.listVideos(): Video[]`, implemented in `VideoService` via
    `videoRepository.findAll()`.
  - `VideosController.list` sends the array as JSON with 200; add
    `router.get("/", ...)` in `videos.routes.ts`.
  - Done when: `npm run build` passes in `backend/`; with the dev server and an
    upload made via `curl -F video=@<file> localhost:4000/videos`,
    `curl localhost:4000/videos` returns a JSON array with the newest video
    first, and returns `[]` on an empty database.

- [x] 2. Frontend plumbing: proxy, API types, list page
  - Read the relevant Next.js guides under `frontend/node_modules/next/dist/docs/`
    first (per `frontend/AGENTS.md`): rewrites, `loading.tsx`, client components.
  - Add the `rewrites()` entry to `frontend/next.config.ts`.
  - `src/types/video.ts`: `Video` and `VideoStatus` types matching the API
    response.
  - `src/lib/api.ts`: a server-side `fetchVideos()` that calls
    `${BACKEND_URL}/videos` with `cache: "no-store"` and a timeout, and throws
    on failure.
  - `src/components/videos/VideoList.tsx` and `VideoStatusBadge.tsx`; rewrite
    `src/app/page.tsx` as the list page with the empty and error states, add
    `src/app/loading.tsx`, update `metadata` in `layout.tsx`, and adjust
    `page.module.css` (or add CSS Modules next to the components).
  - Done when: `npm run lint` and `npm run build` pass in `frontend/`; with
    both servers running, `/` shows the videos uploaded via `curl` with their
    status text, shows the empty state on an empty database, and shows the error
    state with the backend stopped.

- [x] 3. Upload page
  - `src/app/upload/page.tsx` (server component shell) rendering a client
    `src/components/videos/UploadForm.tsx` with the behavior under In scope
    (posting to `/api/backend/videos`, disabled/"Uploading..." state,
    `role="alert"` errors, redirect to `/` on success).
  - Link `/` <-> `/upload`.
  - Done when: `npm run lint` and `npm run build` pass; in the browser, submitting
    a small `.mp4` with and without a title lands on `/` with the new row (title
    defaults to the filename, per the existing service); submitting through the
    proxy with a file of roughly 100MB succeeds (check for proxy body-size or
    timeout limits here, and report if the rewrite cannot carry it rather than
    silently switching approach); stopping the backend and submitting shows the
    generic error and keeps the form filled.

## Files / areas

- Backend: `backend/src/services/interfaces/IVideoService.ts`,
  `backend/src/services/video.service.ts`,
  `backend/src/controllers/videos.controller.ts`,
  `backend/src/routes/videos.routes.ts`.
- Frontend: `frontend/next.config.ts`, `frontend/src/app/page.tsx`,
  `frontend/src/app/page.module.css`, `frontend/src/app/loading.tsx`,
  `frontend/src/app/layout.tsx`, `frontend/src/app/upload/page.tsx`,
  `frontend/src/components/videos/*`, `frontend/src/lib/api.ts`,
  `frontend/src/types/video.ts`.

## Data / contracts

- `GET /videos` -> `200` with `Video[]`, newest first. Each item:
  `{ id: number, title: string, originalPath: string, hlsPlaylistPath: string | null,
  status: "PROCESSING" | "READY" | "FAILED", duration: number | null,
  thumbnailPath: string | null, createdAt: string, updatedAt: string }`
  (the `Video` entity as `POST /videos` already serializes it).
- `POST /videos` is unchanged: multipart `video` (required) plus optional
  `title`; `201` with the video; errors as `{ error: { message } }`.
- Browser calls go to `/api/backend/videos`; the rewrite maps it to
  `${BACKEND_URL}/videos`. No new environment variables, and no schema change.

## Testing

No test runner or Verify command is configured (see `AGENTS.md` Commands), and
the coding standards exclude UI components from testing, so there is no
automated test gate. Evidence per step is the build/lint commands above plus the
manual observations named in each Done when. Live-browser and large-file
behavior are only claimed once actually run at those steps.

## Notes for the AI

- `frontend/AGENTS.md`: this Next.js version has breaking changes; read the
  bundled docs in `node_modules/next/dist/docs/` before writing frontend code
  (note `LayoutProps<"/">` in `layout.tsx` as evidence of newer APIs).
- Follow the backend layering standards; controllers and routes stay thin.
- Standards say uploads with progress or long operations may need API routes;
  progress is out of scope here, so the rewrite proxy is the simplest option.
  If step 3 shows it cannot carry large files, stop and raise it instead of
  adding CORS or a route handler on your own.
- CSS Modules only, no inline styles, honor `prefers-color-scheme` tokens.
- Do not add validation, polling, or playback; they belong to items 9, 8, 6.
- The `/` page replaces the "Backend: connected" indicator; the error state
  now covers the unreachable case.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9096,"specSha256":"4fd98557ea53edf0f98734fb7e8b709f977c6a5aa58edc58e56a6984f86d542f","branch":"refs/heads/feature/upload-ui","head":"c0131cbecd733f39357019b285292e0b2603d2c7","baseRef":"refs/heads/main","baseCommit":"e43be1c091272d24ca3360aedc68f01e7b4c52fd","sourceTree":"f2f13b34a8e4bb963f6cc06d6a0d5ce1dcbe40f1","absentOptional":[]} -->
