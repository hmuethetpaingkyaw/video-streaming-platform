import type { Video } from "../../entities/video.entity";

export interface IVideoRepository {
  create(input: { title: string; originalPath: string }): Video;
  findById(id: number): Video | null;
  findAll(): Video[];
  update(
    id: number,
    changes: Partial<
      Pick<Video, "hlsPlaylistPath" | "status" | "duration" | "thumbnailPath">
    >,
  ): Video;
}
