import type Database from "better-sqlite3";
import { Video } from "../entities/video.entity";
import type { IVideoRepository } from "./interfaces/IVideoRepository";
import { NotFoundError } from "../errors/NotFoundError";

type UpdateChanges = Parameters<IVideoRepository["update"]>[1];

const UPDATABLE_FIELDS = ["hlsPlaylistPath", "status", "duration", "thumbnailPath"] as const;

const SELECT_COLUMNS =
  "id, title, originalPath, hlsPlaylistPath, status, duration, thumbnailPath, createdAt, updatedAt";

export class VideoRepository implements IVideoRepository {
  constructor(private db: Database.Database) {}

  create(input: { title: string; originalPath: string }): Video {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        "INSERT INTO videos (title, originalPath, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      )
      .run(input.title, input.originalPath, now, now);

    return this.findById(result.lastInsertRowid as number)!;
  }

  findById(id: number): Video | null {
    const row = this.db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM videos WHERE id = ?`)
      .get(id);

    return row ? new Video(row) : null;
  }

  findAll(): Video[] {
    return this.db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM videos ORDER BY id DESC`)
      .all()
      .map((row) => new Video(row));
  }

  update(id: number, changes: UpdateChanges): Video {
    const now = new Date().toISOString();
    const fields = (Object.keys(changes) as (keyof UpdateChanges)[]).filter((field) =>
      (UPDATABLE_FIELDS as readonly string[]).includes(field),
    );

    const assignments = [...fields.map((field) => `${field} = ?`), "updatedAt = ?"];
    const values = [...fields.map((field) => changes[field]), now, id];

    const result = this.db
      .prepare(`UPDATE videos SET ${assignments.join(", ")} WHERE id = ?`)
      .run(...values);

    if (result.changes === 0) {
      throw new NotFoundError(`Video ${id} not found`);
    }

    return this.findById(id)!;
  }
}
