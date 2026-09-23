import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

const migrationsDir = path.resolve(__dirname, "migrations");

export function runMigrations(db: Database.Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );

  const applied = new Set(
    db
      .prepare("SELECT filename FROM schema_migrations")
      .all()
      .map((row) => (row as { filename: string }).filename),
  );

  const filenames = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

  for (const filename of filenames) {
    if (applied.has(filename)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");

    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
      ).run(filename, new Date().toISOString());
    })();
  }
}
