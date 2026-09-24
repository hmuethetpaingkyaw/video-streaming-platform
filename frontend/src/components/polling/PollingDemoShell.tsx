import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/page.module.css";

interface PollingDemoShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function PollingDemoShell({ title, description, children }: PollingDemoShellProps) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>{title}</h1>
          <Link href="/polling">All demos</Link>
        </header>
        <p>{description}</p>
        {children}
      </main>
    </div>
  );
}
