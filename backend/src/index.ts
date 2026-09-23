import express from "express";
import healthRoutes from "./routes/health.routes";

const app = express();
const port = process.env.PORT ?? 4000;

app.use("/health", healthRoutes);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
