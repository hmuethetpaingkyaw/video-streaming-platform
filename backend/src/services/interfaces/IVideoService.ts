import type { Video } from "../../entities/video.entity";

export interface CreateVideoInput {
  title?: string | undefined;
  originalFilename: string;
  storedPath: string;
}

export interface IVideoService {
  createVideo(input: CreateVideoInput): Promise<Video>;
  listVideos(): Video[];
}
