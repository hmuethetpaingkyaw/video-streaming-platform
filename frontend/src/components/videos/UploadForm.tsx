"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./UploadForm.module.css";

interface ErrorResponse {
  error?: { message?: string };
}

const GENERIC_ERROR = "Upload failed. Please try again.";

export function UploadForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/backend/videos", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });

      if (response.ok) {
        router.push("/");
        return;
      }

      const body = (await response.json().catch(() => null)) as ErrorResponse | null;
      setError(body?.error?.message ?? GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    }

    setSubmitting(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        Video file
        <input type="file" name="video" accept="video/*" required />
      </label>
      <label className={styles.field}>
        Title (optional)
        <input type="text" name="title" />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
