import type { Video } from "@/types/video";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function fetchVideos(): Promise<Video[]> {
  const response = await fetch(`${BACKEND_URL}/videos`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Failed to load videos (${response.status})`);
  }

  return (await response.json()) as Video[];
}
