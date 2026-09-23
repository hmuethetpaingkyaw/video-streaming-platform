import fs from "node:fs";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ValidationError } from "../errors/ValidationError";
import { NotFoundError } from "../errors/NotFoundError";

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (req.file) {
    fs.unlink(req.file.path, () => {});
  }

  if (err instanceof ValidationError) {
    res.status(400).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: { message: "Invalid file upload" } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: "Internal server error" } });
}
