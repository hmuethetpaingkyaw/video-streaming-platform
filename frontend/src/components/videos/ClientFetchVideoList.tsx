"use client";

import { useEffect, useState } from "react";
import { PollingStats } from "@/components/polling/PollingStats";
import { UpdateFailedNotice } from "@/components/polling/UpdateFailedNotice";
import { POLL_INTERVAL_MS, shouldPoll } from "@/lib/polling";
import type { Video } from "@/types/video";
import { VideoList } from "./VideoList";
import styles from "@/app/page.module.css";

export function ClientFetchVideoList({ initialVideos }: { initialVideos: Video[] | null }) {
  const [videos, setVideos] = useState<Video[] | null>(initialVideos);
  const [failed, setFailed] = useState(false);
  const [requests, setRequests] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const active = shouldPoll(videos);

  useEffect(() => {
    if (!active) {
      return;
    }

    const controller = new AbortController();

    const id = setInterval(async () => {
      setRequests((count) => count + 1);
      try {
        const response = await fetch("/api/backend/videos", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load videos (${response.status})`);
        }
        setVideos((await response.json()) as Video[]);
        setFailed(false);
        setLastUpdatedAt(new Date());
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [active]);

  return (
    <>
      <PollingStats
        technique="client fetch"
        state={active ? "polling" : "idle"}
        requests={requests}
        lastUpdatedAt={lastUpdatedAt}
      />
      {failed && videos !== null && <UpdateFailedNotice />}
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
