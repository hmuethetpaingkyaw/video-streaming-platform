"use client";

import { useState } from "react";
import useSWR from "swr";
import { PollingStats } from "@/components/polling/PollingStats";
import { UpdateFailedNotice } from "@/components/polling/UpdateFailedNotice";
import { POLL_INTERVAL_MS, shouldPoll } from "@/lib/polling";
import type { Video } from "@/types/video";
import { VideoList } from "./VideoList";
import styles from "@/app/page.module.css";

const VIDEOS_URL = "/api/backend/videos";

export function SwrVideoList({ initialVideos }: { initialVideos: Video[] | null }) {
  const [requests, setRequests] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const { data, error } = useSWR<Video[]>(
    VIDEOS_URL,
    async (url: string) => {
      setRequests((count) => count + 1);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load videos (${response.status})`);
      }
      return (await response.json()) as Video[];
    },
    {
      fallbackData: initialVideos ?? undefined,
      refreshInterval: (latest) => (shouldPoll(latest ?? null) ? POLL_INTERVAL_MS : 0),
      onSuccess: () => setLastUpdatedAt(new Date()),
    },
  );

  const videos = data ?? null;

  return (
    <>
      <PollingStats
        technique="SWR"
        state={shouldPoll(videos) ? "polling" : "idle"}
        requests={requests}
        lastUpdatedAt={lastUpdatedAt}
      />
      {error && videos !== null && <UpdateFailedNotice />}
      {videos === null ? (
        <p className={styles.unreachable} role="alert">
          Could not load videos
        </p>
      ) : (
        <VideoList videos={videos} />
      )}
    </>
  );
}
