# Video Streaming Platform - Project Overview

<!-- blueprint:source-hash d42d38774a189ed2a1d517a58b737f31e7ee05dcf83a2445abec83404173f97f -->

> A minimal YouTube-style app for learning the video pipeline: upload a video, transcode it to HLS, watch it stream in the browser.

## Problem

Uploaded video files (e.g. a phone or camera `.mp4`) aren't immediately playable smoothly in a browser — they need to be transcoded into a streaming-friendly format first. This project exists to learn that pipeline hands-on: upload → FFmpeg transcode to HLS → browser playback, with failures surfaced as FAILED rather than left silently stuck. It's a personal learning vehicle, not a production streaming platform.

## Users

- **Owner (uploader + viewer)** - the only user. One person plays both roles, with no login system, since authentication isn't the learning target.

## Usage model

- Single user (the project owner), no real traffic, not internet-facing in V1.
- Fully trusted uploader - no untrusted-submission review flow is needed, only basic file-type/size validation.
- Explicit non-requirements: enterprise-scale infrastructure, multi-tenancy, high availability, auth/authorization, CDN, adaptive bitrate streaming, native mobile apps, monetization.

## Features

MVP feature set, in build order:

1. **Project foundation** - Next.js frontend + Express backend scaffolding with TypeScript, env config, and a health-check verifying frontend → backend connectivity.
2. **Video database model** - SQLite schema (`better-sqlite3`, no ORM) for video metadata.
3. **Video upload API** - accepts a video file, stores it to local disk, creates a record with status PROCESSING.
4. **Upload UI** - upload form plus a video list page showing each video's status.
5. **FFmpeg transcoding (single quality)** - synchronous FFmpeg run producing HLS output (playlist + segments); marks the video READY or FAILED. This is the headline feature - the core pipeline the whole project exists to learn.
6. **HLS playback** - backend serves HLS files; frontend player page streams a READY video via hls.js.
7. **Background job queue** - moves transcoding off the request thread into BullMQ + Redis so upload returns immediately; Redis runs via Docker Compose (Redis only - frontend/backend stay local).
8. **Processing status UI** - video list reflects PROCESSING/READY/FAILED, polling every 3-5 seconds.
9. **Upload validation and error handling** - ~2GB size cap, accepts mp4/mov/webm/mkv only, handles FFmpeg failures without crashing the worker, consistent API error responses.
10. **Thumbnail generation** - extracts a frame during processing and shows it in the video list.
11. **Video list and player polish** - clean empty/loading/error states.
12. **Health check and logging** - formal `/health` endpoint and structured logging across upload, queue, and transcoding steps.

Deferred beyond V1 (tracked in `build-plan.md` "Later - Not V1"): adaptive bitrate streaming, cloud object storage, Postgres migration, full app containerization, search, user accounts, live streaming, CDN integration, production deployment.

## Data model

### Video

- `id` (integer, primary key)
- `title` (string)
- `originalPath` (string) - path to the stored original upload on local disk
- `hlsPlaylistPath` (string, nullable) - path to the generated `.m3u8` once processed
- `status` (enum: `PROCESSING` \| `READY` \| `FAILED`)
- `duration` (number, nullable, seconds) - extracted during processing
- `thumbnailPath` (string, nullable)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

> Lock this shape before feature 2 implements the SQLite schema - features 3-12 all depend on it as-is.

### Processing job (not a database table)

Lives entirely in BullMQ/Redis, keyed to a video id - not persisted to SQLite:

- job status: `queued` \| `active` \| `completed` \| `failed`
- error message, if failed

`Video.status` is the durable source of truth; the job record is transient and can be discarded once the video reaches READY or FAILED.

## Tech stack

- **Next.js + TypeScript** - frontend: upload form, video list, player page
- **Express + TypeScript** - backend: upload endpoint, metadata API, job enqueue, HLS file serving
- **FFmpeg** - transcodes uploaded video into HLS (playlist + segments); source resolution, capped bitrate (~2-3 Mbps H.264/AAC), ~6s segments
- **BullMQ + Redis** - background job queue for transcoding; Redis runs via Docker Compose (Redis only)
- **SQLite via `better-sqlite3`** - video metadata storage, raw SQL, no ORM, migrations as plain `.sql` files
- **hls.js** - HLS playback in the browser
- **Local disk** - stores original uploads and generated HLS output

## Monetization

Not in v1. This is a personal learning project, not a product.

## UI/UX

Minimal internal-tool feel, not a polished consumer product - functional over pretty, status always visible (Processing/Ready/Failed), no unnecessary UI complexity.

- `/` - video list (main screen): every video with its status, upload entry point, polls every 3-5s while any video is processing
- `/upload` - form to submit a new video file
- `/videos/[id]` - player page for a READY video, streamed via hls.js

## Deployment

No hosting target chosen - local development is the explicit goal, not an oversight.

**Local environment:**

- Frontend: Next.js dev server, local (`npm run dev`)
- Backend: Express dev server, local (`npm run dev`)
- Redis: Docker Compose (`docker compose up redis`) - Redis only, app itself stays local
- Database: SQLite file, local disk
- Storage: original uploads + HLS output, local disk

**Env vars:** `PORT`, `REDIS_URL`, `DATABASE_URL` (only if ever moved off SQLite)

> TODO: no deployment target chosen. If pursued later as a stretch goal: reverse proxy → Next.js → Express API → Redis + Postgres. No hosting provider picked.
