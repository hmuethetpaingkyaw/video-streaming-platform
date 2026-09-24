import Link from "next/link";
import type { Video } from "@/types/video";
import { VideoStatusBadge } from "./VideoStatusBadge";
import styles from "./VideoList.module.css";

export function VideoList({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <p>
        No videos yet. <Link href="/upload">Upload one</Link>.
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {videos.map((video) => (
        <li key={video.id} className={styles.row}>
          <span className={styles.title}>{video.title}</span>
          <VideoStatusBadge status={video.status} />
          <time className={styles.created} dateTime={video.createdAt}>
            {new Date(video.createdAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
