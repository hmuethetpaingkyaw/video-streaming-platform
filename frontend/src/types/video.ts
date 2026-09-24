export type VideoStatus = "PROCESSING" | "READY" | "FAILED";

export interface Video {
  id: number;
  title: string;
  originalPath: string;
  hlsPlaylistPath: string | null;
  status: VideoStatus;
  duration: number | null;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt: string;
}
