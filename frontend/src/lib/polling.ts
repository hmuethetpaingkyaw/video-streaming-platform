import type { Video } from "@/types/video";

export const POLL_INTERVAL_MS = 4000;

// Poll while something is still processing, or while the last fetch failed
// (videos === null) so a transient backend error recovers on its own.
export function shouldPoll(videos: Video[] | null): boolean {
  return videos === null || videos.some((video) => video.status === "PROCESSING");
}
