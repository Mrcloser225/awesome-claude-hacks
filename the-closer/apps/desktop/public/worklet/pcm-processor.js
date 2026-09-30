/**
 * AudioWorklet: takes a stereo float32 input (ch0 = rep mic, ch1 = meeting
 * audio), downsamples from the context rate to 16 kHz, converts to interleaved
 * PCM16 and posts 20 ms frames (1280 bytes) to the main thread.
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;
    this.frameSamples = (this.targetRate / 1000) * 20; // 320 per channel
    this.acc = [[], []];
    this.pos = 0;
    this.out = new Int16Array(this.frameSamples * 2);
    this.outIdx = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0] || new Float32Array(128);
    const ch1 = input[1] || new Float32Array(128);
    // Simple decimation with a running phase accumulator. Good enough for speech;
    // a proper polyphase filter can replace this later without changing the wire format.
    for (let i = 0; i < ch0.length; i++) {
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        this.out[this.outIdx++] = clamp16(ch0[i]);
        this.out[this.outIdx++] = clamp16(ch1[i]);
        if (this.outIdx >= this.out.length) {
          const copy = this.out.slice();
          this.port.postMessage(copy.buffer, [copy.buffer]);
          this.outIdx = 0;
        }
      }
    }
    return true;
  }
}

function clamp16(x) {
  const s = Math.max(-1, Math.min(1, x));
  return s < 0 ? s * 0x8000 : s * 0x7fff;
}

registerProcessor("pcm-processor", PcmProcessor);
