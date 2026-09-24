import Link from "next/link";
import { UploadForm } from "@/components/videos/UploadForm";
import styles from "../page.module.css";

export default function UploadPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Upload a video</h1>
          <Link href="/">Back to videos</Link>
        </header>
        <UploadForm />
      </main>
    </div>
  );
}
