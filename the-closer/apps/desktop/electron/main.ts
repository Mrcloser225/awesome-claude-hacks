import { app, BrowserWindow, globalShortcut, ipcMain, session, systemPreferences } from "electron";
import path from "node:path";

/**
 * The Closer overlay window.
 *
 * - Frameless, transparent, always on top, on every workspace.
 * - setContentProtection(true): the window is excluded from screen capture,
 *   so when the rep shares their screen in Teams the prospect never sees it.
 * - Grants loopback (system) audio to getDisplayMedia so the renderer can hear
 *   the meeting without a virtual audio device on Windows. On macOS, Electron's
 *   loopback support depends on the version; the renderer falls back to a
 *   virtual device (BlackHole) if loopback is unavailable.
 */
let win: BrowserWindow | null = null;
let clickThrough = false;

function createWindow(): void {
  win = new BrowserWindow({
    width: 420,
    height: 640,
    x: 40,
    y: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setContentProtection(true);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../dist/index.html"));

  win.on("closed", () => { win = null; });
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    await systemPreferences.askForMediaAccess("microphone");
  }

  // Hand system audio to the renderer's getDisplayMedia({ audio: true }) call.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    // No video: we only want what the rep hears.
    callback({ audio: "loopback" });
  }, { useSystemPicker: false });

  createWindow();

  globalShortcut.register("CommandOrControl+Shift+C", () => {
    if (!win) return;
    if (win.isVisible()) win.hide(); else win.show();
  });
  globalShortcut.register("CommandOrControl+Shift+X", () => {
    if (!win) return;
    clickThrough = !clickThrough;
    win.setIgnoreMouseEvents(clickThrough, { forward: true });
    win.webContents.send("closer:click-through", clickThrough);
  });

  ipcMain.handle("closer:config", () => ({
    apiUrl: process.env.VITE_CLOSER_API_URL ?? "ws://localhost:8787/v1/live",
    apiKey: process.env.VITE_CLOSER_API_KEY ?? "dev-local-key",
    platform: process.platform,
    electron: process.versions.electron,
  }));
  ipcMain.on("closer:resize", (_e, h: number) => {
    if (win) win.setSize(win.getSize()[0]!, Math.max(200, Math.min(900, Math.round(h))));
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
