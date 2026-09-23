import db from "./db/connection";
import { VideoRepository } from "./repositories/video.repository";
import { VideoService } from "./services/video.service";
import { VideosController } from "./controllers/videos.controller";

const videoRepository = new VideoRepository(db);
const videoService = new VideoService(videoRepository);

export const videosController = new VideosController(videoService);
