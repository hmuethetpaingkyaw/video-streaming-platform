import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import type { IVideoService } from "../services/interfaces/IVideoService";
import type { CreateVideoRequestDto } from "../dtos/video.dto";

const CHANGE_CHECK_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 15000;
const LONG_POLL_TIMEOUT_MS = 20000;

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

  stream(req: Request, res: Response): void {
    // Computed before the headers go out so a failure still reaches the error middleware.
    let snapshot = this.videoService.getSnapshot();
    let lastToken: string | null = null;

    res.set({
      "Content-Type": "text/event-stream",
      // no-transform stops Next's rewrite proxy from gzip-buffering the stream.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.flushHeaders();

    const send = (): void => {
      if (snapshot.token !== lastToken) {
        lastToken = snapshot.token;
        res.write(`event: videos\ndata: ${JSON.stringify(snapshot)}\n\n`);
      }
    };

    send();

    const stop = (): void => {
      clearInterval(timer);
      clearInterval(heartbeat);
    };

    const timer = setInterval(() => {
      try {
        snapshot = this.videoService.getSnapshot();
        send();
      } catch (err) {
        console.error(err);
        stop();
        res.end();
      }
    }, CHANGE_CHECK_INTERVAL_MS);

    // A comment line keeps the connection from going idle; the rewrite proxy
    // aborts a response that is silent for 30 seconds.
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), HEARTBEAT_INTERVAL_MS);

    res.on("close", stop);
  }

  changes(req: Request, res: Response, next: NextFunction): void {
    const since = typeof req.query.since === "string" ? req.query.since : undefined;

    const first = this.videoService.getSnapshot();
    if (since === undefined || first.token !== since) {
      res.json(first);
      return;
    }

    const stop = (): void => {
      clearInterval(timer);
      clearTimeout(timeout);
    };

    const timer = setInterval(() => {
      try {
        const snapshot = this.videoService.getSnapshot();
        if (snapshot.token !== since) {
          stop();
          res.json(snapshot);
        }
      } catch (err) {
        stop();
        next(err);
      }
    }, CHANGE_CHECK_INTERVAL_MS);

    const timeout = setTimeout(() => {
      stop();
      res.status(204).end();
    }, LONG_POLL_TIMEOUT_MS);

    res.on("close", stop);
  }
}
