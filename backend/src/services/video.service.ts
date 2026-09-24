import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import type { VideosSnapshotResponseDto } from "../dtos/video.dto";
import { backendRoot, hlsDir } from "../config/paths";
import type { Video } from "../entities/video.entity";
import type { IVideoRepository } from "../repositories/interfaces/IVideoRepository";
import type { ITranscoder } from "./interfaces/ITranscoder";
import type { CreateVideoInput, IVideoService } from "./interfaces/IVideoService";

export class VideoService implements IVideoService {
  constructor(
    private videoRepository: IVideoRepository,
    private transcoder: ITranscoder,
  ) {}

  async createVideo(input: CreateVideoInput): Promise<Video> {
    const trimmedTitle = input.title?.trim();
    const title =
      trimmedTitle && trimmedTitle.length > 0
        ? trimmedTitle
        : path.basename(input.originalFilename, path.extname(input.originalFilename));

    const video = this.videoRepository.create({ title, originalPath: input.storedPath });
    return this.transcode(video);
  }

  private async transcode(video: Video): Promise<Video> {
    const outputDir = path.join(hlsDir, String(video.id));

    try {
      const { playlistFile, duration } = await this.transcoder.transcode(
        path.join(backendRoot, video.originalPath),
        outputDir,
      );
      return this.videoRepository.update(video.id, {
        status: "READY",
        hlsPlaylistPath: path.relative(backendRoot, playlistFile),
        duration,
      });
    } catch (err) {
      console.error(`Transcoding failed for video ${video.id}:`, err);
      await fs.rm(outputDir, { recursive: true, force: true });
      return this.videoRepository.update(video.id, { status: "FAILED" });
    }
  }

  listVideos(): Video[] {
    return this.videoRepository.findAll();
  }

  getSnapshot(): VideosSnapshotResponseDto {
    const videos = this.videoRepository.findAll();
    const token = crypto
      .createHash("sha1")
      .update(JSON.stringify(videos.map((video) => [video.id, video.status, video.updatedAt])))
      .digest("hex");

    return { token, videos };
  }
}
