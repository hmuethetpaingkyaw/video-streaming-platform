import { PollingDemoShell } from "@/components/polling/PollingDemoShell";
import { SseVideoList } from "@/components/videos/SseVideoList";
import { fetchVideosOrNull } from "@/lib/api";

export default async function SseDemoPage() {
  const videos = await fetchVideosOrNull();

  return (
    <PollingDemoShell
      title="Polling: Server-Sent Events"
      description="The backend keeps one connection open and pushes a new snapshot whenever a video changes. No client timer."
    >
      <SseVideoList initialVideos={videos} />
    </PollingDemoShell>
  );
}
