import Link from "next/link";
import styles from "../page.module.css";

const DEMOS = [
  { href: "/polling/refresh", name: "router.refresh()", note: "Timer re-runs the server component." },
  { href: "/polling/client-fetch", name: "Client fetch", note: "Timer fetches JSON into client state." },
  { href: "/polling/swr", name: "SWR", note: "Library-managed refresh interval." },
  { href: "/polling/sse", name: "Server-Sent Events", note: "Backend pushes changes." },
  { href: "/polling/long-poll", name: "Long polling", note: "Request held open until something changes." },
];

export default function PollingIndexPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Polling demos</h1>
          <Link href="/">Back to videos</Link>
        </header>
        <p>The same video list, updated five different ways. Learning exercise; the home page uses router.refresh().</p>
        <ul>
          {DEMOS.map((demo) => (
            <li key={demo.href}>
              <Link href={demo.href}>{demo.name}</Link> - {demo.note}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
