# Feature: FFmpeg transcoding (single quality)

**From build-plan:** feature 5
**Build attempt:** 1
**Branch:** feature/ffmpeg-transcoding-single-quality
**Status:** verified

## Goal

Turn an uploaded original into HLS (playlist + ~6s segments, source resolution, capped ~2-3 Mbps H.264/AAC) by running FFmpeg synchronously inside the upload request, then mark the video `READY` (with playlist path and duration) or `FAILED`. This is the core pipeline the project exists to teach.

## In scope

- Backend only. `POST /videos` still accepts the file and creates the `PROCESSING` record, then transcodes before responding.
- Duration extraction with `ffprobe`, stored in `duration` (seconds).
- HLS output on local disk under `backend/hls/<videoId>/` (`index.m3u8` + `segment_NNN.ts`).
- `hlsPlaylistPath` stored relative to `backend/`, matching the `uploads/<file>` convention: `hls/<videoId>/index.m3u8`.
- Success sets `status = READY`, `hlsPlaylistPath`, `duration`. Any failure sets `status = FAILED`, leaves `hlsPlaylistPath` null, removes partial HLS output, and logs the error (stderr tail) to the server console. The server never crashes on a bad file.
- Response: `201` with the video as it stands after transcoding (`READY` or `FAILED`). An upload that was stored but failed to transcode is still a created record, so a `FAILED` video is a 201, not an error response.
- FFmpeg and ffprobe are invoked with Node's `child_process.spawn` and an argument array (no shell, no new npm dependency).

## Out of scope

- Serving HLS files or playback (feature 6).
- Background queue / async processing (feature 7). The request blocks until FFmpeg finishes.
- Upload type/size validation and consistent FFmpeg-failure API responses (feature 9). Any uploaded file is attempted.
- Thumbnail generation (feature 10), logging framework (feature 12), multiple renditions (feature 13).
- Frontend changes, including waiting/progress UI (feature 4/8 territory).
- Transcode timeout, cancellation, or retry of `FAILED` videos.
- A `GET /videos` list endpoint (added separately by feature 4, not part of this feature).

## Build loop

`workflow.stepReview` is `every` and `checkpointCommits` is `enabled`. Implement one step at a time, stop after each for approval, and offer an optional checkpoint commit on the feature branch after each approved step. `/complete` creates the final feature commit.

## Build steps

- [x] 1. **Transcoder module.** Add `ITranscoder` (`src/services/interfaces/ITranscoder.ts`) and `FfmpegTranscoder` (`src/services/ffmpeg.transcoder.ts`). Method: `transcode(inputPath, outputDir): Promise<{ playlistFile: string; duration: number }>` (absolute paths in, rejects with an `Error` carrying the FFmpeg stderr tail on failure). It runs `ffprobe` for `format=duration` (reject if not a finite number > 0), creates `outputDir`, then runs `ffmpeg` with: `-map 0:v:0 -map 0:a:0?`, `-vf scale=trunc(iw/2)*2:trunc(ih/2)*2`, `-c:v libx264 -pix_fmt yuv420p -crf 23 -maxrate 3000k -bufsize 6000k`, `-force_key_frames expr:gte(t,n_forced*6)`, `-c:a aac -b:a 128k`, `-f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename <outputDir>/segment_%03d.ts <outputDir>/index.m3u8`. A missing binary (spawn `ENOENT`) rejects rather than throwing uncaught.
  **Done when:** `ffmpeg -version` works on the machine (prerequisite, see Notes); `npm run build` passes; running the transcoder once against a small sample video (via a `tsx` one-liner, not committed) produces `index.m3u8` and `segment_*.ts` in a temp dir, and a returned duration close to the source's.

- [x] 2. **Wire into upload.** Make `IVideoService.createVideo` async and inject an `ITranscoder` into `VideoService`. After creating the `PROCESSING` record, transcode `uploads/<file>` into `backend/hls/<id>/`, then `videoRepository.update` to `READY` with `hlsPlaylistPath` and `duration`. Catch any transcoder error, remove `hls/<id>/`, `console.error` it, and update to `FAILED`. Controller awaits and returns 201. Compose the transcoder in `src/container.ts`. Add `hls/` to the root `.gitignore` next to `uploads/`. Resolve `hls/` and `uploads/` from a single location each so path joins are not duplicated.
  **Done when:** `npm run build` passes; `curl -F video=@sample.mp4 localhost:4000/videos` returns 201 with `status: "READY"`, `hlsPlaylistPath: "hls/<id>/index.m3u8"`, numeric `duration`, and the files exist on disk; playing `backend/hls/<id>/index.m3u8` locally (e.g. `ffplay` or VLC) works; `git status` shows no `hls/` files.

- [x] 3. **Failure paths.** Confirm and fix behavior for: a non-video file uploaded as `.mp4`, a video with no audio track, and FFmpeg not on `PATH`.
  **Done when:** the non-video file returns 201 with `status: "FAILED"`, null `hlsPlaylistPath`, no leftover `hls/<id>/` directory, error logged, and the server still answers `GET /health` and further uploads; the silent video reaches `READY`; with `PATH` lacking ffmpeg the upload returns 201 `FAILED` and does not crash the process.

## Files / areas

- New: `backend/src/services/interfaces/ITranscoder.ts`, `backend/src/services/ffmpeg.transcoder.ts`
- New: `backend/src/config/paths.ts` (single home for `uploads/` and `hls/` locations)
- Edit: `backend/tsconfig.json` (`include: ["src"]` so generated `hls/*.ts` segments are not compiled), `backend/src/services/video.service.ts`, `backend/src/services/interfaces/IVideoService.ts`, `backend/src/controllers/videos.controller.ts`, `backend/src/container.ts`, `.gitignore`
- No schema migration: all needed columns exist from feature 2. No repository changes expected; `update` already accepts `hlsPlaylistPath`, `status`, `duration`.

## Data / contracts

- `POST /videos` (multipart, field `video`, optional `title`): unchanged request. Response `201` body is the `Video` JSON: `status` is `READY` (with `hlsPlaylistPath`, `duration`) or `FAILED` (both null-valued as before; `hlsPlaylistPath` null, `duration` possibly null). `thumbnailPath` stays null.
- The failure reason is not stored or returned (no column for it); it is logged only.
- `Video.status` is written exactly once after the initial `PROCESSING`. A crash mid-request (process killed) leaves the row `PROCESSING`; recovery is out of scope.
- HLS layout: `backend/hls/<videoId>/index.m3u8`, `segment_000.ts`, ... Segment names are relative in the playlist so the directory can later be served statically.
- `duration` is seconds (float) from ffprobe of the original.

## Testing

No test runner is configured, so there is no logic-test gate; Verify is `cd backend && npm run build`. Evidence for this feature is manual and must be reported as such: the curl checks in steps 2 and 3, run against the real FFmpeg. Sample videos can be generated locally, e.g. `ffmpeg -f lavfi -i testsrc=duration=20:size=640x360:rate=30 -f lavfi -i sine=duration=20 -c:v libx264 -c:a aac sample.mp4` (and without the sine input for the silent case). No browser or frontend verification applies.

## Notes for the AI

- Follow the four-layer structure: the controller stays free of business logic; the service owns the status transitions; only the repository touches SQLite. The transcoder is an injected interface, per the manual-DI standard.
- Use `spawn` with argument arrays. Never build a shell string from paths; the stored filename is a server-generated UUID plus the original extension.
- Collect only the tail of stderr (bounded) to avoid unbounded memory from FFmpeg's chatty output.
- Do not add libraries (`fluent-ffmpeg` etc.), env vars, or config for bitrate/paths.
- Keep the request synchronous. Do not introduce a queue or fire-and-forget.
- Add no comments beyond non-obvious "why" notes (e.g. why the even-dimension scale and forced keyframes are needed).
- **Prerequisite observed:** `ffmpeg` and `ffprobe` were not installed when this was specced; they were installed before step 1 was checked. Build and Verify do not depend on them.
- Feature 4 (Upload UI) is still unchecked; this feature does not depend on it.

## Open questions

None blocking. Decisions taken by default and worth a glance at review: a failed transcode returns 201 with `status: "FAILED"` (rather than a 4xx/5xx), and the failure message is log-only because the data model has no field for it.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8256,"specSha256":"63547cf56d3badae3bd1ce6e0949270d72bad0d965d09207d308eb8fe7048791","branch":"refs/heads/docs/archive-ffmpeg-transcoding","head":"0607e6448df73ba504837131abece34120b5085f","baseRef":"refs/heads/main","baseCommit":"0607e6448df73ba504837131abece34120b5085f","sourceTree":"44697ea5f85e28e0ed157d12fff0dc08fcc778db","absentOptional":[]} -->
