import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { ITranscoder, TranscodeResult } from "./interfaces/ITranscoder";

const STDERR_TAIL_BYTES = 4000;

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderrTail = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-STDERR_TAIL_BYTES);
    });
    child.on("error", (err) => reject(new Error(`${command} failed to start: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderrTail.trim()}`));
      }
    });
  });
}

export class FfmpegTranscoder implements ITranscoder {
  async transcode(inputPath: string, outputDir: string): Promise<TranscodeResult> {
    const probeOutput = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      inputPath,
    ]);
    const duration = Number.parseFloat(probeOutput.trim());
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`ffprobe returned no usable duration: "${probeOutput.trim()}"`);
    }

    await fs.mkdir(outputDir, { recursive: true });
    const playlistFile = path.join(outputDir, "index.m3u8");

    // H.264 needs even dimensions; forced keyframes every 6s let segments cut at ~6s.
    await run("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-crf", "23",
      "-maxrate", "3000k",
      "-bufsize", "6000k",
      "-force_key_frames", "expr:gte(t,n_forced*6)",
      "-c:a", "aac",
      "-b:a", "128k",
      "-f", "hls",
      "-hls_time", "6",
      "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(outputDir, "segment_%03d.ts"),
      playlistFile,
    ]);

    return { playlistFile, duration };
  }
}
