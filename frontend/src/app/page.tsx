import Link from "next/link";
import { VideoList } from "@/components/videos/VideoList";
import { VideoListPoller } from "@/components/videos/VideoListPoller";
import { fetchVideosOrNull } from "@/lib/api";
import { shouldPoll } from "@/lib/polling";
import styles from "./page.module.css";

export default async function Home() {
  const videos = await fetchVideosOrNull();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Videos</h1>
          <span>
            <Link href="/polling">Polling demos</Link> | <Link href="/upload">Upload a video</Link>
          </span>
        </header>
        <VideoListPoller active={shouldPoll(videos)} />
        {videos === null ? (
          <p className={styles.unreachable} role="alert">
            Could not load videos
          </p>
        ) : (
          <VideoList videos={videos} />
        )}
      </main>
    </div>
  );
}
