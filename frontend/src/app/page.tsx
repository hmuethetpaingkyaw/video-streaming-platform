import Link from "next/link";
import { VideoList } from "@/components/videos/VideoList";
import { fetchVideos } from "@/lib/api";
import type { Video } from "@/types/video";
import styles from "./page.module.css";

export default async function Home() {
  let videos: Video[] | null = null;

  try {
    videos = await fetchVideos();
  } catch {
    videos = null;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Videos</h1>
          <Link href="/upload">Upload a video</Link>
        </header>
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
