import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../errors/ValidationError";
import { NotFoundError } from "../errors/NotFoundError";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { message: err.message } });
    return;
  }

  res.status(500).json({ error: { message: "Internal server error" } });
}
