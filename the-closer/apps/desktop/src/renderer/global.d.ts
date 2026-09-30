import type { CloserConfig } from "../../electron/preload";

declare global {
  interface Window {
    closer?: {
      getConfig: () => Promise<CloserConfig>;
      onClickThrough: (cb: (on: boolean) => void) => void;
      resize: (height: number) => void;
    };
  }
}
export {};
