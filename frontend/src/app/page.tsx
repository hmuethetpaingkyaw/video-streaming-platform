import styles from "./page.module.css";

async function checkBackendConnected(): Promise<boolean> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${backendUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

export default async function Home() {
  const connected = await checkBackendConnected();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Video Streaming Platform</h1>
        <p className={connected ? styles.connected : styles.unreachable}>
          Backend: {connected ? "connected" : "unreachable"}
        </p>
      </main>
    </div>
  );
}
