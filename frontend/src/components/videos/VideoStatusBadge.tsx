import type { VideoStatus } from "@/types/video";
import styles from "./VideoStatusBadge.module.css";

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{status}</span>;
}
