import styles from "./UpdateFailedNotice.module.css";

export function UpdateFailedNotice() {
  return (
    <p className={styles.notice} role="status">
      Update failed, retrying
    </p>
  );
}
