import type { TranscriptSegment } from "@closer/core";

/**
 * A speech-to-text provider that accepts interleaved stereo PCM16 @ 16 kHz and
 * emits channel-attributed transcript segments. Channel 0 = rep, 1 = prospect.
 */
export interface SttProvider {
  start(handlers: { onSegment: (seg: TranscriptSegment) => void; onError: (err: Error) => void; onClose: () => void }): Promise<void>;
  sendAudio(frame: Buffer): void;
  stop(): Promise<void>;
}

export type SttFactory = () => SttProvider;
