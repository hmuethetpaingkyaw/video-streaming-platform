# Build Plan

V1 is a simple personal learning app: upload a video, turn it into HLS, watch it in the browser. The core flow is upload → background transcode → status update → playback. No accounts, live streaming, adaptive bitrate, comments, or cloud storage in V1 — those are explicitly deferred so the pipeline itself stays the focus.

The backend uses Express + TypeScript, the frontend uses Next.js, FFmpeg handles transcoding, BullMQ + Redis runs it in the background, and SQLite stores video metadata. Build the pipeline end-to-end with the simplest possible version first (one file, one quality, no queue), then add the background queue, then polish.

## V1

- [ ] 1. Project foundation — Next.js frontend and Express backend with TypeScript, environment configuration, basic project structure; verify frontend → backend connectivity with a health check
- [ ] 2. Video database model — SQLite schema for videos using `better-sqlite3`, no ORM: title, original file path, HLS playlist path, status (PROCESSING/READY/FAILED), duration, thumbnail path, timestamps
- [ ] 3. Video upload API — endpoint that accepts a video file upload, stores it to local disk, and creates a video record with status PROCESSING
- [ ] 4. Upload UI — a simple frontend form to upload a video file, and a list page showing uploaded videos with their status
- [ ] 5. FFmpeg transcoding (single quality) — run FFmpeg synchronously on the uploaded file to produce HLS output (playlist + segments), target: source resolution, capped bitrate (~2-3 Mbps H.264/AAC), ~6s HLS segments; update the video record to READY on success or FAILED on error
- [ ] 6. HLS playback — serve the HLS playlist/segments from the backend, and build a frontend player page that streams a READY video using hls.js
- [ ] 7. Background job queue — move transcoding off the request thread into BullMQ + Redis, so upload returns immediately and processing happens asynchronously; Redis runs via a new `docker-compose.yml` (Redis only), frontend/backend stay local
- [ ] 8. Processing status UI — reflect PROCESSING / READY / FAILED in the video list, updating without a manual page reload (poll every 3-5 seconds)
- [ ] 9. Upload validation and error handling — validate file type/size before accepting an upload (~2GB cap, accept mp4/mov/webm/mkv), handle FFmpeg failures without crashing the worker, consistent API error responses
- [ ] 10. Thumbnail generation — extract a frame from the video during processing and show it in the video list
- [ ] 11. Video list and player polish — clean up empty/loading/error states so the app is pleasant to use for its one real user (me)
- [ ] 12. Health check and logging — formal /health endpoint and basic structured logging across upload, queue, and transcoding steps, so pipeline failures are visible

## Later — Not V1

- [ ] 13. Adaptive bitrate streaming — encode multiple quality renditions and generate a master playlist so playback can switch quality automatically
- [ ] 14. Cloud object storage — move original files and HLS output from local disk to S3/MinIO
- [ ] 15. Postgres migration — move off SQLite if the project outgrows it
- [ ] 16. Docker Compose setup — containerize the frontend and backend too (Redis is already covered in V1 item 7), for full portability across machines
- [ ] 17. Search — search videos by title once there are enough of them to need it
- [ ] 18. User accounts — basic auth, only if multi-user access ever becomes relevant
- [ ] 19. Live streaming — RTMP ingest and live transcoding, as a separate learning track from VOD
- [ ] 20. CDN integration — serve HLS output through a CDN once there's real remote playback to optimize for
- [ ] 21. Production deployment — deploy frontend, backend, Redis, and storage; verify the full upload → process → playback flow in production
