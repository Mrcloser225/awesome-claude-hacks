import type { SttProvider } from "./types.js";

/** Used when transcripts arrive from outside (meeting bot path) and no audio is streamed. */
export class NoopStt implements SttProvider {
  async start(): Promise<void> {}
  sendAudio(): void {}
  async stop(): Promise<void> {}
}
