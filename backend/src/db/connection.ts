import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const dataDir = path.resolve(__dirname, "../../data");
fs.mkdirSync(dataDir, { recursive: true });

const db: Database.Database = new Database(path.join(dataDir, "app.db"));

export default db;
