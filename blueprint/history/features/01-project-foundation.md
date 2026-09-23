# Feature: Project Foundation

**From build-plan:** feature 1
**Build attempt:** 1
**Branch:** feature/project-foundation
**Status:** Verified

## Goal

Connect the already-scaffolded Next.js frontend and Express backend so the
monorepo has a real, environment-configured foundation to build on: the
backend's `/health` endpoint is reachable through documented env config, and
the frontend proves that connectivity by rendering the live result.

## In scope

- Backend `PORT` read from the environment, with a documented `.env.example`
  and Node's native `.env` loading (no new dependency).
- Basic backend route structure: move the existing `/health` handler out of
  `src/index.ts` into its own router file, per the documented
  `src/routes/[feature].routes.ts` convention.
- Frontend `BACKEND_URL` env var, with a documented `.env.example`.
- The frontend home page (`/`) proving frontend -> backend connectivity by
  fetching the backend's `/health` endpoint server-side and rendering a
  connected or unreachable state.

## Out of scope

- The real video list UI at `/` (build-plan item 4 replaces this page's
  content once videos exist).
- CORS - the frontend reads the backend from a server component (server-to-
  server), so the browser never calls the Express server directly.
- Structured logging (build-plan item 12) and any database, upload, or queue
  work (items 2, 3, 7).
- A formal `/health` response contract beyond the existing `{ status: "ok" }`
  shape - richer health data isn't needed until item 12.

## Build loop

Work through the build steps below one at a time, in order:

1. Implement the step.
2. Stop and show the diff plus how it was verified (commands run, output
   observed). Wait for review approval before continuing.
3. Once approved, create a checkpoint commit for that step, then move to the
   next step.

Do not start a later step before the current one is approved and committed.

## Build steps

- [x] 1. Backend: environment-configured `PORT` and route structure
  - Add `backend/.env.example` documenting `PORT=4000`.
  - Update the backend `dev` script to use `nodemon` (per user request) to
    watch `src/**/*.ts` and re-run
    `tsx --env-file-if-exists=.env src/index.ts` on change, so a local
    `backend/.env` (already covered by the root `.gitignore`) can override
    `PORT` without a separate dotenv dependency (Node 20.6+ loads `.env`
    natively).
  - Move the `/health` route handler out of `backend/src/index.ts` into
    `backend/src/routes/health.routes.ts` as an Express `Router` exporting
    `GET /` (mounted at `/health`), keeping the response body unchanged.
    `index.ts` keeps only app setup and `app.listen`.
  - Done when: `npm run dev` in `backend/` starts, `GET
    http://localhost:4000/health` returns `{ "status": "ok" }`, and starting
    with `PORT=4100` in `backend/.env` makes the server log
    `http://localhost:4100` instead (manual verification with `curl` - no
    test runner is configured yet).

- [x] 2. Frontend: environment-configured backend URL and connectivity check
  - Add `!.env.example` to `frontend/.gitignore` (its existing `.env*` rule
    would otherwise exclude the example file), then add
    `frontend/.env.example` documenting `BACKEND_URL=http://localhost:4000`.
  - Replace the default `create-next-app` content of
    `frontend/src/app/page.tsx` with an async server component that:
    - Fetches `` `${process.env.BACKEND_URL ?? "http://localhost:4000"}/health` ``
      with `cache: "no-store"` (so `next build`/`next start` can't freeze the
      result at build time) and a short timeout via
      `AbortSignal.timeout(3000)`.
    - Renders a connected state (e.g. "Backend: connected") when the
      response is ok and its JSON body has `status: "ok"`.
    - Renders an unreachable/error state (e.g. "Backend: unreachable") for a
      network failure, timeout, or non-ok response, without throwing.
  - Simplify `frontend/src/app/page.module.css` to only the classes the new
    content uses; drop the unused `create-next-app` boilerplate styles.
  - Done when: with both dev servers running, loading `http://localhost:3000`
    shows the connected state; stopping the backend and reloading shows the
    unreachable state with no unhandled error overlay (manual browser
    verification - no test runner or browser-test harness is configured
    yet).

## Files / areas

- `backend/src/index.ts` - remove inline `/health` handler, mount the new
  router, keep `app.listen` reading `PORT`.
- `backend/src/routes/health.routes.ts` - new.
- `backend/package.json` - `dev` script only.
- `backend/.env.example` - new.
- `frontend/src/app/page.tsx` - replaced.
- `frontend/src/app/page.module.css` - trimmed to match.
- `frontend/.gitignore` - add `!.env.example`.
- `frontend/.env.example` - new.

## Data / contracts

- `GET /health` (backend, unchanged): `200 { "status": "ok" }`.
- Env vars:
  - `backend/.env` (optional, git-ignored): `PORT` (default `4000`).
  - `frontend/.env.local` (optional, git-ignored): `BACKEND_URL` (default
    `http://localhost:4000` in code, so the app runs with zero env files).

## Testing

No test runner is configured in either package yet (per `AGENTS.md`), and
this feature is UI/integration behavior (an HTTP route and a page render),
which the coding standards exempt from the unit-test gate even when a runner
exists. Verify with the running dev servers, `curl`, and a browser reload, as
described in each step's "Done when".

## Notes for the AI

- No CORS package: the browser never talks to Express directly in this
  feature, so don't add `cors` or any preflight handling.
- No `dotenv` dependency: Node 24 (installed) loads `.env` files natively via
  `--env-file`/`--env-file-if-exists`.
- Don't add a `src/services`/`src/repositories` skeleton for the health
  check - the layered backend architecture in `coding-standards.md` is for
  business logic, and a static health response has none yet. Introduce those
  layers starting with build-plan item 2 (the video model), not here.
- The home page's connectivity message is throwaway scaffolding; build-plan
  item 4 will overwrite `/` with the real upload/video-list UI.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6186,"specSha256":"40a3d7ebe2287ab984e0f9da47bb51d71d51cd7a7eb410a010f8cf16a078c75f","branch":"refs/heads/feature/project-foundation","head":"42547c1c8bca48f108f67bb04b579fa6fee10256","baseRef":"refs/heads/main","baseCommit":"7f7badaca46268a6be385c0bb9d73f27f441a3cb","sourceTree":"7150c00ab9a5db68fdd7aa8458cb0b52a65bbae6","absentOptional":[]} -->
