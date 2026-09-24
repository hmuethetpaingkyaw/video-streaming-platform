import { PollingDemoShell } from "@/components/polling/PollingDemoShell";
import { SwrVideoList } from "@/components/videos/SwrVideoList";
import { fetchVideosOrNull } from "@/lib/api";

export default async function SwrDemoPage() {
  const videos = await fetchVideosOrNull();

  return (
    <PollingDemoShell
      title="Polling: SWR"
      description="SWR owns the fetching: refreshInterval polls while something is processing, and it also revalidates on tab focus and reconnect by default."
    >
      <SwrVideoList initialVideos={videos} />
    </PollingDemoShell>
  );
}
