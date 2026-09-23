import path from "node:path";
import type { Video } from "../entities/video.entity";
import type { IVideoRepository } from "../repositories/interfaces/IVideoRepository";
import type { CreateVideoInput, IVideoService } from "./interfaces/IVideoService";

export class VideoService implements IVideoService {
  constructor(private videoRepository: IVideoRepository) {}

  createVideo(input: CreateVideoInput): Video {
    const trimmedTitle = input.title?.trim();
    const title =
      trimmedTitle && trimmedTitle.length > 0
        ? trimmedTitle
        : path.basename(input.originalFilename, path.extname(input.originalFilename));

    return this.videoRepository.create({ title, originalPath: input.storedPath });
  }
}
