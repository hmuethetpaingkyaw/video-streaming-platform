import path from "node:path";
import type { Request, Response } from "express";
import type { IVideoService } from "../services/interfaces/IVideoService";
import type { CreateVideoRequestDto } from "../dtos/video.dto";

export class VideosController {
  constructor(private videoService: IVideoService) {}

  async create(req: Request, res: Response): Promise<void> {
    const { title } = req.body as CreateVideoRequestDto;
    const file = req.file!;

    const video = await this.videoService.createVideo({
      title,
      originalFilename: file.originalname,
      storedPath: path.join("uploads", file.filename),
    });

    res.status(201).json(video);
  }

  list(_req: Request, res: Response): void {
    res.json(this.videoService.listVideos());
  }
}
