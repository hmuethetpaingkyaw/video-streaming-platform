import express from "express";
import healthRoutes from "./routes/health.routes";
import videosRoutes from "./routes/videos.routes";
import db from "./db/connection";
import { runMigrations } from "./db/migrate";
import { errorMiddleware } from "./middleware/error.middleware";

runMigrations(db);

const app = express();
const port = process.env.PORT ?? 4000;

app.use("/health", healthRoutes);
app.use("/videos", videosRoutes);

app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
