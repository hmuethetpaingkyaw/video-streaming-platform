# Feature: Processing status UI

**From build-plan:** feature 8
**Build attempt:** 1
**Branch:** feature/processing-status-ui
**Status:** Verified

## Goal

The video list reflects status changes (`PROCESSING` -> `READY` / `FAILED`)
without a manual reload. The real `/` page does this with `router.refresh()`
polling every 4 seconds. As an explicit learning exercise (a user decision, not
a product requirement), the same list is also built once per update technique
under `/polling/`, so the techniques can be compared side by side:

| Sub-item | Page | Technique |
|---|---|---|
| 8a | `/` and `/polling/refresh` | `router.refresh()` on an interval |
| 8b | `/polling/client-fetch` | client `fetch` on an interval, list held in state |
| 8c | `/polling/swr` | SWR with `refreshInterval` |
| 8d | `/polling/sse` | Server-Sent Events pushed from the backend |
| 8e | `/polling/long-poll` | long polling against a new backend endpoint |

## In scope

### Shared

- `/polling` index page listing the five demos; a "Polling demos" link in the
  `/` header. Each demo page reuses `VideoList` and `VideoStatusBadge` unchanged,
  seeded server-side with `fetchVideos()`, and keeps the existing
  "Could not load videos" alert when the initial fetch fails.
- A small stats readout on every demo page, so the techniques are observable:
  technique name, requests (or events) made since the page mounted, and the
  time of the last successful update. Rendered by one shared client component,
  `PollingStats`. Text only; no charts.
- One constant, `POLL_INTERVAL_MS = 4000` (inside the required 3-5s window),
  shared by 8a-8c.
- Timers, streams and in-flight requests are always cleaned up on unmount.

### 8a - `router.refresh()`

- `VideoListPoller` (client): while `active`, calls `router.refresh()` every
  `POLL_INTERVAL_MS`; renders nothing (or the stats on the demo page). Used by
  `/` and by `/polling/refresh`.
- Active when at least one video is `PROCESSING`, or when the last server fetch
  failed (so a transient backend error recovers by itself). Inactive when the
  list is empty or every video is `READY`/`FAILED`.

### 8b - client fetch with state

- Client component seeded with the server-rendered list; every
  `POLL_INTERVAL_MS` it fetches `/api/backend/videos` and replaces its state.
  Same active/inactive rule as 8a. On a failed poll it keeps the last good list
  and shows a small "Update failed, retrying" notice, instead of blanking the
  list; the notice clears on the next success.

### 8c - SWR

- Add the `swr` dependency to `frontend/` (authorized here, as the technique
  itself is the point). `useSWR("/api/backend/videos", fetcher, ...)` with
  `fallbackData` from the server render and `refreshInterval` returning
  `POLL_INTERVAL_MS` under the same active rule, else 0. Failure notice as in 8b.

### 8d - Server-Sent Events

- Backend `GET /videos/stream` (`text/event-stream`): sends the current
  snapshot on connect, then a new snapshot whenever the change token differs.
  Client uses `EventSource("/api/backend/videos/stream")`; the browser's
  built-in reconnect is relied on. The page shows connection state
  (connecting / open / reconnecting). Streams regardless of statuses (push
  semantics, no active/inactive rule).

### 8e - long polling

- Backend `GET /videos/changes?since=<token>`: holds the request open until the
  change token differs from `since`, then returns the snapshot; after 20s with
  no change returns `204 No Content`. Omitted `since` returns the snapshot
  immediately. Client loops: request, apply the result, request again;
  aborts on unmount; waits 2s before retrying after an error.

### Backend snapshot (used by 8d and 8e)

- `VideoService.getSnapshot()` returns `{ token, videos }`. `token` is a hex
  SHA-1 of the JSON of `[id, status, updatedAt]` for every video (from
  `findAll()`), so any status change, including a hand edit of the database,
  changes it.
- Change detection is a server-side re-check of `getSnapshot()` once per second
  inside the SSE and long-poll handlers, not an in-process event bus. Reason:
  status writers arrive with items 5 and 7, item 7's worker may be a separate
  process, and a bus would not see hand edits used to test today.
- Handlers stop their timers when the client disconnects (`req` `close`).

## Out of scope

- Transcoding, the queue, and anything that actually moves a video out of
  `PROCESSING`: items 5 and 7. Until then a status change is simulated by
  editing the SQLite file by hand (path in `backend/src/db/connection.ts`),
  changing `status` and `updatedAt`.
- WebSockets (a possible later sub-item; not part of this feature).
- Backoff/jitter, pausing on hidden tabs, screen-reader announcements.
- Auth, per-client cursors, event replay (`Last-Event-ID`), multiple-instance
  fan-out.
- Choosing a "winner": `/` stays on 8a; the other pages are labeled demos.
- Empty/loading/error polish: item 11.

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

Read the relevant bundled Next.js docs before writing frontend code
(`frontend/AGENTS.md`). Each "Done when" below assumes both dev servers are
running, a `PROCESSING` video exists, and the status change is simulated by a
manual database edit (see Out of scope); say so in every evidence report and do
not claim end-to-end pipeline behavior.

- [x] 1. 8a: shared pieces, demo index, `router.refresh()` polling
  - Confirm from the docs that `router.refresh()` re-runs the server component
    without showing `loading.tsx` or resetting the page.
  - Add `frontend/src/lib/polling.ts` (`POLL_INTERVAL_MS`), a shared helper for
    the active rule, `components/polling/PollingStats.tsx` (+ CSS Module),
    `components/videos/VideoListPoller.tsx`, `app/polling/page.tsx` (index) and
    `app/polling/refresh/page.tsx`; wire the poller into `app/page.tsx`; add the
    "Polling demos" link.
  - Done when: `npm run lint` and `npm run build` pass in `frontend/`; editing a
    video's `status` to `READY` updates an open `/` and `/polling/refresh`
    within about 4s without a reload; network panel shows periodic requests
    while a video is `PROCESSING` and none once all are `READY`/`FAILED`;
    stopping the backend shows the alert and restarting it clears the alert on
    its own; navigating away stops the requests.

- [x] 2. 8b: client fetch demo
  - Add the client list component and `app/polling/client-fetch/page.tsx`.
  - Done when: lint and build pass; the status edit appears within about 4s; with
    the backend stopped, the last good list stays visible with the retry notice,
    and the notice clears after restart.

- [x] 3. 8c: SWR demo
  - `npm install swr` in `frontend/` (only `package.json` and the lockfile
    change), add the SWR list component and `app/polling/swr/page.tsx`.
  - Done when: lint and build pass; same observable behavior as step 2. Record
    whether SWR also refetches on tab focus and how that shows in the stats.

- [x] 4. Backend snapshot + 8d: SSE demo
  - Backend: `VideoService.getSnapshot()`, `IVideoService` method, a
    `VideosSnapshot` response DTO next to the existing DTOs, controller `stream`,
    `router.get("/stream", ...)` registered before any `/:id` route.
  - Frontend: `VideosSnapshot` type, EventSource list component,
    `app/polling/sse/page.tsx`.
  - Check first, and report rather than work around: the Next.js rewrite must
    pass the stream through unbuffered. If it does not, stop and raise it; do
    not add CORS or a direct backend URL on your own.
  - Done when: backend `npm run build` and frontend lint/build pass;
    `curl -N localhost:4000/videos/stream` prints an initial event and a second
    one within about 1s of a database status edit; the demo page updates within
    about 2s; killing the backend shows "reconnecting" and the page recovers when
    it restarts; closing the tab leaves no open handlers (the backend logs or a
    second `curl` show no leaked timers, e.g. process stays idle).

- [x] 5. 8e: long polling demo
  - Backend: `GET /videos/changes` per the contract above, on the same snapshot.
  - Frontend: long-poll list component and `app/polling/long-poll/page.tsx`.
  - Check first: a 20s held request must get through the rewrite without a
    proxy timeout; report if not.
  - Done when: backend build and frontend lint/build pass;
    `curl "localhost:4000/videos/changes?since=<current token>"` hangs, returns
    the snapshot within about 1s of a database status edit, and returns `204`
    after 20s with no change; the demo page updates within about 2s of an edit
    and its request counter stays low while idle; leaving the page aborts the
    in-flight request.

## Files / areas

- Backend: `backend/src/services/interfaces/IVideoService.ts`,
  `backend/src/services/video.service.ts`,
  `backend/src/controllers/videos.controller.ts`,
  `backend/src/routes/videos.routes.ts`, `backend/src/dtos/video.dto.ts`.
- Frontend: `frontend/src/lib/polling.ts`,
  `frontend/src/components/polling/*`, `frontend/src/components/videos/*`,
  `frontend/src/app/page.tsx`, `frontend/src/app/polling/**`,
  `frontend/src/types/video.ts`, `frontend/package.json` + lockfile (swr).

## Data / contracts

- `GET /videos` is unchanged (`Video[]`).
- `VideosSnapshot`: `{ token: string, videos: Video[] }`.
- `GET /videos/stream`: `200 text/event-stream`, events named `videos` with a
  `VideosSnapshot` JSON `data:` payload; headers `Cache-Control: no-cache, no-transform`
  (no-transform keeps Next's rewrite proxy from gzip-buffering the stream),
  `Connection: keep-alive`. A `: keep-alive` comment is written every 15 s, because
  the proxy aborts a response that is silent for 30 s.
- `GET /videos/changes?since=<token>`: `200 VideosSnapshot` on change or when
  `since` is absent, `204` after 20s idle. Unexpected failures use the existing
  `{ error: { message } }` handler.
- Change token: SHA-1 hex over the JSON of `[id, status, updatedAt]` for all
  videos ordered as `findAll()` returns them. Not a security value.
- Polling interval 4000 ms; long-poll hold 20 s; server check 1 s.

## Testing

No test runner or Verify command is configured (see `AGENTS.md` Commands), and
the coding standards exclude UI components from testing. Evidence per step is
build/lint output plus the manual observations named in its Done when. The token
function is small logic, but there is no runner and none may be installed
here; verify it through the live `curl` checks. Do not claim end-to-end pipeline
behavior; status changes are simulated.

## Notes for the AI

- The single-feature packaging of five techniques is the user's decision; this
  spec is deliberately larger than a normal feature. Keep each step's diff small
  and separately reviewable.
- Pages stay server components that only seed data; only the polling/streaming
  pieces are client components. CSS Modules only, no inline styles.
- Follow the backend layering: routes -> controller -> service interface ->
  service -> repository. Only the controller touches `req`/`res`.
- Video titles are user text; render as React text only.
- No dependency other than `swr`, and no event bus, queue, or WebSocket code.
- `blueprint/build-plan.md` and `project-overview.md` item 8 wording were
  already updated when this spec was written; `/complete` only ticks the
  checkbox and refreshes the overview hash.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":11832,"specSha256":"cec9ed0eec55ac9f9f42795cc4e46b5bda27073056678428f4c6d6ff63f18b71","branch":"refs/heads/feature/processing-status-ui","head":"80b20cf16023d1f4dd32f414d1c37c4591fc0c64","baseRef":"refs/heads/main","baseCommit":"0607e6448df73ba504837131abece34120b5085f","sourceTree":"12c4681e094b8d028dcf1988e0c01cfa108cea1d","absentOptional":[]} -->
