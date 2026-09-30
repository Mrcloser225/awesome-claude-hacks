import { contextBridge, ipcRenderer } from "electron";

export interface CloserConfig { apiUrl: string; apiKey: string; platform: string; electron: string }

contextBridge.exposeInMainWorld("closer", {
  getConfig: (): Promise<CloserConfig> => ipcRenderer.invoke("closer:config"),
  onClickThrough: (cb: (on: boolean) => void) => { ipcRenderer.on("closer:click-through", (_e, on: boolean) => cb(on)); },
  resize: (height: number) => ipcRenderer.send("closer:resize", height),
});
