export type VideoStatus = "PROCESSING" | "READY" | "FAILED";

export class Video {
  id: number;
  title: string;
  originalPath: string;
  hlsPlaylistPath: string | null;
  status: VideoStatus;
  duration: number | null;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt: string;

  constructor(row: unknown) {
    const r = row as Record<string, unknown>;
    this.id = r.id as number;
    this.title = r.title as string;
    this.originalPath = r.originalPath as string;
    this.hlsPlaylistPath = (r.hlsPlaylistPath as string | null) ?? null;
    this.status = r.status as VideoStatus;
    this.duration = (r.duration as number | null) ?? null;
    this.thumbnailPath = (r.thumbnailPath as string | null) ?? null;
    this.createdAt = r.createdAt as string;
    this.updatedAt = r.updatedAt as string;
  }
}
