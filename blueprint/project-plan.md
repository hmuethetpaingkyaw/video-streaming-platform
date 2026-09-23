# Project Plan

## 1. Problem - What problem are we solving?

I want to learn how video streaming actually works under the hood: how a video gets uploaded, processed into a streamable format, and played back smoothly in a browser.

The main purpose of this project is to build a simple YouTube-style app as a vehicle for learning the video pipeline, not to build a production streaming platform.

A user should be able to:

- Upload a video file.
- Have the video automatically processed into a playable format.
- Browse a list of uploaded videos.
- Watch a video in the browser.

This is a personal learning project. The primary (and likely only) user is myself.

### The pipeline problem

A raw uploaded video file (e.g. .mp4 from a phone or camera) is not immediately good for streaming. It needs to be:

```
Raw upload
    ↓
 PROCESSING (FFmpeg converts to HLS)
    ↓
   READY
    ↓
Playable in browser
```

If processing fails, the video should be marked as failed rather than silently stuck.

### Important learning principle

The MVP should focus on the core learning goal:

> "Upload a video. Turn it into something a browser can stream smoothly. Watch it."

Features that don't teach something about the video pipeline itself should be excluded from the initial version.

## 2. Users - Who is this for?

### Primary user

Myself, learning how video upload/processing/streaming works.

There is no real external audience for this project. It is not meant to be launched publicly.

### Roles (conceptual, not necessarily separate accounts)

- **Uploader** — adds a video.
- **Viewer** — browses and watches videos.

For the MVP, these can be the same person with no login system, since authentication is not the learning target here.

## 3. Features - What does the MVP need?

### Video upload

- Upload a video file from the browser.
- Store the original file.
- Create a video record with status PROCESSING.
- Reject uploads before processing that exceed ~2GB or aren't a recognized video type (mp4, mov, webm, mkv).

### Video processing

- Run FFmpeg on the uploaded file to produce an HLS stream (playlist + segments), encoding at the source resolution with a capped bitrate (~2-3 Mbps, H.264/AAC) and ~6-second segments — no downscaling in V1.
- Update the video record to READY on success, or FAILED on error.
- Run processing in the background (job queue) so upload doesn't block on it.

### Video playback

- List videos (title, status, thumbnail if available).
- Play a READY video using an HLS-capable player (hls.js) in the browser.

### Explicit MVP exclusions

The following are intentionally excluded from the MVP:

- Live streaming.
- User accounts / authentication.
- Comments, likes, ratings.
- Recommendations.
- Search.
- Social features.
- Monetization / ads.
- DRM / content protection.
- CDN integration.
- Multiple resolution/bitrate outputs (adaptive streaming) — this is a stretch goal after single-quality HLS works.
- Mobile native apps.

## 4. Data - What are we storing?

### Video

- ID
- Title
- Original filename / storage path
- HLS playlist path (once processed)
- Status: PROCESSING, READY, FAILED
- Duration, if extracted
- Thumbnail path, if generated
- Created timestamp
- Updated timestamp

### Processing job (conceptual, backed by the job queue)

- Video ID it belongs to
- Job status (queued, active, completed, failed)
- Error message, if failed

This can live entirely in the job queue (BullMQ/Redis) rather than a separate database table, since it's transient — the `Video.status` field is the durable source of truth.

### Storage

Original uploaded files and generated HLS output are stored on local disk for the MVP.

No cloud object storage (S3/MinIO) required initially — can be added later as a learning stretch goal, not a requirement.

## 5. Tech - What stack are we using?

### Frontend

- Next.js
- TypeScript
- hls.js for HLS playback in the browser

The frontend will provide:

- Upload form.
- Video list.
- Video player page.

### Backend

- Express
- TypeScript

The backend will handle:

- Upload endpoint.
- Video metadata API.
- Enqueuing processing jobs.
- Serving HLS files (playlist + segments).

### Video processing

FFmpeg, invoked from Node, to convert uploaded video into HLS output.

### Job queue

BullMQ + Redis, so transcoding happens in the background instead of blocking the upload request.

### Database

SQLite via `better-sqlite3` (no ORM) for video metadata — raw SQL, migrations as plain `.sql` files you run yourself. Matches the "learn the pipeline, not a framework" goal and keeps the repository layer thin. Postgres migration remains a later stretch goal if ever needed.

### Local development

Redis runs via Docker Compose (`docker compose up redis`) — the compose file covers Redis only. The frontend and backend keep running locally with `npm run dev` for fast iteration; they are not containerized in V1.

## 6. Monetize - How will this make money?

No monetization. This is a personal learning project, not a product.

## 7. UI/UX - How should this look and feel?

The app should feel like a minimal internal tool, not a polished consumer product. Visual design is not the point — the pipeline is.

### Initial flow

```
Open app
   ↓
Upload a video
   ↓
See it listed as "Processing..."
   ↓
(Video list polls for status updates every 3-5 seconds while any video is processing.)
   ↓
Status becomes "Ready"
   ↓
Click it
   ↓
Watch it stream (HLS)
```

### Main screen

```
🎬 My Videos

[ Upload a video ]

┌─────────────────────────┐
│ Video A                 │
│ Ready                   │
└─────────────────────────┘

┌─────────────────────────┐
│ Video B                 │
│ Processing...           │
└─────────────────────────┘
```

### Design principles

- Functional over pretty.
- Status should always be visible (processing vs. ready vs. failed).
- No unnecessary UI complexity.

## 8. Deployment - Where and how will this ship?

This project's primary target is local development — running it on my own machine to learn the pipeline is the goal, not deploying it publicly.

### Local environment

```
Next.js frontend (local)
        +
Express backend (local)
        +
Redis (Docker Compose)
        +
SQLite (metadata)
        +
Local disk (video files)
```

### Optional future deployment

If deployment is attempted later purely as a stretch goal:

```
Internet
   ↓
Reverse Proxy
   ↓
Next.js
   ↓
Express API
   ↓
Redis + Postgres
```

No hosting provider has been chosen, and none is required to complete the learning goals.

### Environment variables

- `PORT`
- `REDIS_URL`
- `DATABASE_URL` (if moved off SQLite)

## 9. Usage model and constraints

### Expected users

Just myself. No real traffic, no external users.

### Operation

Runs locally. Not internet-facing unless I later choose to deploy it as a stretch goal.

### Data trust model

I control all uploads, so there's no untrusted-submission review flow like a public app would need — basic file-type/size validation on upload is enough.

### Security

Even as a learning project, apply normal basics:

- Validate uploaded file type/size before processing.
- Don't execute arbitrary user input as shell commands (careful with how FFmpeg is invoked).
- Keep secrets (if any) out of source control.

### Explicit non-requirements

- Enterprise-scale infrastructure.
- Multi-tenancy.
- High availability.
- Authentication/authorization system.
- CDN.
- Adaptive bitrate streaming (stretch goal, not required for MVP).
- Native mobile apps.
- Monetization.
