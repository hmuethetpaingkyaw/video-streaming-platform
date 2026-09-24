import styles from "./page.module.css";

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p>Loading videos...</p>
      </main>
    </div>
  );
}
