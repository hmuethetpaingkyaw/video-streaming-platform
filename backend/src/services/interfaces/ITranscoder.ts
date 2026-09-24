export interface TranscodeResult {
  playlistFile: string;
  duration: number;
}

export interface ITranscoder {
  transcode(inputPath: string, outputDir: string): Promise<TranscodeResult>;
}
