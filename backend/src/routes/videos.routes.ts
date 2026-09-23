import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { createVideoSchema } from "../dtos/video.dto";
import { ValidationError } from "../errors/ValidationError";
import { validate } from "../middleware/validate.middleware";
import { videosController } from "../container";

const uploadsDir = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
});

function requireVideoFile(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(new ValidationError("A video file is required"));
    return;
  }
  next();
}

const router = Router();

router.post(
  "/",
  upload.single("video"),
  requireVideoFile,
  validate(createVideoSchema),
  (req, res) => videosController.create(req, res),
);

export default router;
