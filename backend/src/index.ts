import express from "express";
import healthRoutes from "./routes/health.routes";
import db from "./db/connection";
import { runMigrations } from "./db/migrate";

runMigrations(db);

const app = express();
const port = process.env.PORT ?? 4000;

app.use("/health", healthRoutes);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
