import { PollingDemoShell } from "@/components/polling/PollingDemoShell";
import { ClientFetchVideoList } from "@/components/videos/ClientFetchVideoList";
import { fetchVideosOrNull } from "@/lib/api";

export default async function ClientFetchDemoPage() {
  const videos = await fetchVideosOrNull();

  return (
    <PollingDemoShell
      title="Polling: client fetch"
      description="A client timer fetches JSON through the proxy and keeps the list in React state. A failed poll keeps the last good list."
    >
      <ClientFetchVideoList initialVideos={videos} />
    </PollingDemoShell>
  );
}
