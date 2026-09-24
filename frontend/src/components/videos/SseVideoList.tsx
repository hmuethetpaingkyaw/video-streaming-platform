"use client";

import { useEffect, useState } from "react";
import { PollingStats } from "@/components/polling/PollingStats";
import type { Video, VideosSnapshot } from "@/types/video";
import { VideoList } from "./VideoList";
import styles from "@/app/page.module.css";

type ConnectionState = "connecting" | "open" | "reconnecting";

const STREAM_URL = "/api/backend/videos/stream";
const RECONNECT_DELAY_MS = 3000;

export function SseVideoList({ initialVideos }: { initialVideos: Video[] | null }) {
  const [videos, setVideos] = useState<Video[] | null>(initialVideos);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [events, setEvents] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      source = new EventSource(STREAM_URL);

      source.onopen = () => setConnection("open");

      source.addEventListener("videos", (event) => {
        const snapshot = JSON.parse((event as MessageEvent<string>).data) as VideosSnapshot;
        setVideos(snapshot.videos);
        setEvents((count) => count + 1);
        setLastUpdatedAt(new Date());
      });

      source.onerror = () => {
        setConnection("reconnecting");
        // Network drops are retried by the browser. A non-200 answer (e.g. the
        // proxy reporting the backend is down) closes the source for good, so
        // reconnect by hand in that case.
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return (
    <>
      <PollingStats
        technique="Server-Sent Events"
        state={connection}
        requests={events}
        countLabel="Events"
        lastUpdatedAt={lastUpdatedAt}
      />
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
