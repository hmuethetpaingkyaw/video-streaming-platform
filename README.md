# Video Streaming Platform (learning project)

A simple YouTube-style app: users upload videos, they get processed into
streamable format, and others can watch them. The goal is to learn the video
pipeline — upload, transcode, serve — not to build a production platform.

Monorepo: `backend` (Express + TypeScript) and `frontend` (Next.js).

## Stack

- **Backend:** Express + TypeScript
- **Frontend:** Next.js
- **Video processing:** FFmpeg (converts uploads to HLS)
- **Job queue:** BullMQ + Redis (background transcoding)
- **Storage:** local disk to start, swap to S3/MinIO later
- **Database:** Postgres or SQLite (video metadata)

## Build order

1. Upload a video file, save it to disk, store metadata as "processing."
2. Run FFmpeg to convert it to a single HLS quality, mark it "ready."
3. Play it back in the browser with `hls.js`.
4. Move transcoding into a background job queue so upload returns instantly.
5. Stretch goal: multiple bitrates (adaptive streaming).

## Commands

### Backend (`backend/`)

- Dev server: `npm run dev` (http://localhost:4000)
- Build: `npm run build`
- Start (built): `npm run start`

### Frontend (`frontend/`)

- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Start (built): `npm run start`
