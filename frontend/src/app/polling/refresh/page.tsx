import { PollingDemoShell } from "@/components/polling/PollingDemoShell";
import { VideoList } from "@/components/videos/VideoList";
import { VideoListPoller } from "@/components/videos/VideoListPoller";
import { fetchVideosOrNull } from "@/lib/api";
import { shouldPoll } from "@/lib/polling";
import styles from "../../page.module.css";

export default async function RefreshDemoPage() {
  const videos = await fetchVideosOrNull();

  return (
    <PollingDemoShell
      title="Polling: router.refresh()"
      description="A client timer calls router.refresh(), so the server component re-fetches the list. Same technique as the home page."
    >
      <VideoListPoller active={shouldPoll(videos)} showStats />
      {videos === null ? (
        <p className={styles.unreachable} role="alert">
          Could not load videos
        </p>
      ) : (
        <VideoList videos={videos} />
      )}
    </PollingDemoShell>
  );
}
