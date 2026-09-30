import { useCallback, useRef, useState } from "react";

export type CaptureSource = "loopback" | "virtual-device" | "mic-only";

export interface CaptureState {
  running: boolean;
  source: CaptureSource | null;
  error: string | null;
  level: { rep: number; prospect: number };
}

/**
 * Captures the rep's mic (channel 0) and the meeting audio (channel 1) into a
 * single stereo AudioWorklet that emits 20 ms PCM16 frames.
 *
 * Meeting audio source order:
 *   1. getDisplayMedia({ audio: true }) with Electron's loopback grant (Windows; macOS on
 *      Electron builds that support ScreenCaptureKit audio loopback)
 *   2. A virtual audio device (BlackHole / VB-Cable) chosen by name
 *   3. Mic only, with a visible warning: the coach then only hears the rep
 */
export function useAudioCapture(onFrame: (frame: ArrayBuffer) => void) {
  const [state, setState] = useState<CaptureState>({ running: false, source: null, error: null, level: { rep: 0, prospect: 0 } });
  const ctxRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const meterRef = useRef<number | null>(null);

  const stop = useCallback(async () => {
    if (meterRef.current) cancelAnimationFrame(meterRef.current);
    for (const s of streamsRef.current) for (const t of s.getTracks()) t.stop();
    streamsRef.current = [];
    await ctxRef.current?.close();
    ctxRef.current = null;
    setState((s) => ({ ...s, running: false, source: null }));
  }, []);

  const start = useCallback(async () => {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      streamsRef.current.push(mic);

      let meeting: MediaStream | null = null;
      let source: CaptureSource = "mic-only";
      try {
        // Electron's setDisplayMediaRequestHandler answers this with loopback audio.
        meeting = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false } as DisplayMediaStreamOptions);
        if (meeting.getAudioTracks().length > 0) source = "loopback";
        else meeting = null;
      } catch {
        meeting = null;
      }
      if (!meeting) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const virtual = devices.find((d) => d.kind === "audioinput" && /blackhole|vb-?cable|loopback|virtual/i.test(d.label));
        if (virtual) {
          meeting = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: virtual.deviceId }, channelCount: 1, echoCancellation: false, noiseSuppression: false } });
          source = "virtual-device";
        }
      }
      if (meeting) streamsRef.current.push(meeting);

      const ctx = new AudioContext({ sampleRate: 48000 });
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule("./worklet/pcm-processor.js");
      const merger = ctx.createChannelMerger(2);
      const micNode = ctx.createMediaStreamSource(mic);
      micNode.connect(merger, 0, 0);
      const repAnalyser = ctx.createAnalyser();
      micNode.connect(repAnalyser);
      let prospectAnalyser: AnalyserNode | null = null;
      if (meeting) {
        const meetNode = ctx.createMediaStreamSource(meeting);
        meetNode.connect(merger, 0, 1);
        prospectAnalyser = ctx.createAnalyser();
        meetNode.connect(prospectAnalyser);
      }
      const worklet = new AudioWorkletNode(ctx, "pcm-processor", { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: "explicit" });
      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onFrame(e.data);
      merger.connect(worklet);

      const buf = new Uint8Array(repAnalyser.fftSize);
      const rms = (a: AnalyserNode | null) => {
        if (!a) return 0;
        a.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i]! - 128) / 128; sum += v * v; }
        return Math.sqrt(sum / buf.length);
      };
      const tick = () => {
        setState((s) => ({ ...s, level: { rep: rms(repAnalyser), prospect: rms(prospectAnalyser) } }));
        meterRef.current = requestAnimationFrame(tick);
      };
      meterRef.current = requestAnimationFrame(tick);

      setState({ running: true, source, error: source === "mic-only" ? "No meeting audio found. Install BlackHole (macOS) or check loopback support. The coach will only hear you." : null, level: { rep: 0, prospect: 0 } });
    } catch (err) {
      setState((s) => ({ ...s, running: false, error: err instanceof Error ? err.message : String(err) }));
      await stop();
    }
  }, [onFrame, stop]);

  return { state, start, stop };
}
