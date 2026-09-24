import styles from "./PollingStats.module.css";

interface PollingStatsProps {
  technique: string;
  state: string;
  requests: number;
  countLabel?: string;
  lastUpdatedAt: Date | null;
}

export function PollingStats({ technique, state, requests, countLabel = "Requests", lastUpdatedAt }: PollingStatsProps) {
  return (
    <dl className={styles.stats}>
      <div>
        <dt>Technique</dt>
        <dd>{technique}</dd>
      </div>
      <div>
        <dt>State</dt>
        <dd>{state}</dd>
      </div>
      <div>
        <dt>{countLabel}</dt>
        <dd>{requests}</dd>
      </div>
      <div>
        <dt>Last update</dt>
        <dd>{lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "-"}</dd>
      </div>
    </dl>
  );
}
