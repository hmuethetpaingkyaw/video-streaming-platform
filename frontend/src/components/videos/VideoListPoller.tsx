"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PollingStats } from "@/components/polling/PollingStats";
import { POLL_INTERVAL_MS } from "@/lib/polling";

interface VideoListPollerProps {
  active: boolean;
  showStats?: boolean;
}

export function VideoListPoller({ active, showStats = false }: VideoListPollerProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const id = setInterval(() => {
      router.refresh();
      setRequests((count) => count + 1);
      setLastUpdatedAt(new Date());
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [active, router]);

  if (!showStats) {
    return null;
  }

  return (
    <PollingStats
      technique="router.refresh()"
      state={active ? "polling" : "idle"}
      requests={requests}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
