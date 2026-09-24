import { PollingDemoShell } from "@/components/polling/PollingDemoShell";
import { LongPollVideoList } from "@/components/videos/LongPollVideoList";
import { fetchVideosOrNull } from "@/lib/api";

export default async function LongPollDemoPage() {
  const videos = await fetchVideosOrNull();

  return (
    <PollingDemoShell
      title="Polling: long polling"
      description="Each request is held open by the backend until something changes (or 20 seconds pass), then the client immediately asks again."
    >
      <LongPollVideoList initialVideos={videos} />
    </PollingDemoShell>
  );
}
