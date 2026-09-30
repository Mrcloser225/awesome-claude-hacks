# Teams meeting side panel

A static page that runs inside the Teams meeting window as a side panel, so the rep reads the live script without leaving Teams and without a second app on top. The prospect cannot see side panels; they are per-user.

It is a plain HTML file with the Teams JS SDK. It talks to the API over the same WebSocket protocol as the desktop overlay, using `session.attach`.

## Run locally

```bash
pnpm --filter @closer/teams-panel dev     # serves public/ on :5174
```

Open http://localhost:5174, enter the API URL and key, paste a Teams join link, press "Send the bot in".

## Install in Teams

1. Host `public/` on HTTPS (Vercel, Netlify, Azure Static Web Apps all work).
2. Edit `manifest/manifest.json`: set a GUID for `id`, replace the two `REPLACE-WITH-*` hosts, add `color.png` (192x192) and `outline.png` (32x32).
3. Zip `manifest.json` and the two icons, then Teams > Apps > Manage your apps > Upload a custom app.
4. In a meeting, press the plus at the top, add The Closer. It opens as a side panel.

Sideloading needs a tenant that allows custom apps. For customers, publish through the Teams admin centre or the Teams Store.
