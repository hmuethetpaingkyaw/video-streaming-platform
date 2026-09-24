import path from "node:path";

export const backendRoot = path.resolve(__dirname, "../..");
export const uploadsDir = path.join(backendRoot, "uploads");
export const hlsDir = path.join(backendRoot, "hls");
