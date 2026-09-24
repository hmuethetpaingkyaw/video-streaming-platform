"use client";

import { useEffect, useState } from "react";
import { PollingStats } from "@/components/polling/PollingStats";
import { UpdateFailedNotice } from "@/components/polling/UpdateFailedNotice";
import type { Video, VideosSnapshot } from "@/types/video";
import { VideoList } from "./VideoList";
import styles from "@/app/page.module.css";

const CHANGES_URL = "/api/backend/videos/changes";
const RETRY_DELAY_MS = 2000;

export function LongPollVideoList({ initialVideos }: { initialVideos: Video[] | null }) {
  const [videos, setVideos] = useState<Video[] | null>(initialVideos);
  const [failed, setFailed] = useState(false);
  const [requests, setRequests] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loop() {
      let token: string | undefined;

      while (!controller.signal.aborted) {
        try {
          setRequests((count) => count + 1);
          const url = token ? `${CHANGES_URL}?since=${encodeURIComponent(token)}` : CHANGES_URL;
          const response = await fetch(url, { cache: "no-store", signal: controller.signal });

          if (response.status === 204) {
            continue;
          }
          if (!response.ok) {
            throw new Error(`Failed to load videos (${response.status})`);
          }

          const snapshot = (await response.json()) as VideosSnapshot;
          token = snapshot.token;
          setVideos(snapshot.videos);
          setFailed(false);
          setLastUpdatedAt(new Date());
        } catch {
          if (controller.signal.aborted) {
            return;
          }
          setFailed(true);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    void loop();

    return () => controller.abort();
  }, []);

  return (
    <>
      <PollingStats
        technique="long polling"
        state={failed ? "retrying" : "waiting"}
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
