# Getting audio out of Microsoft Teams

Three ways exist. The Closer ships the first two.

## 1. Local capture on the rep's machine (shipped, default)

The Electron overlay captures the rep's microphone and the meeting audio the OS is playing, mixes them into a stereo stream and sends it to the API. No bot joins the call, nobody sees a "notetaker" participant, nothing requires tenant admin consent, and it works on Teams, Zoom, Meet, Webex and phone bridges alike.

- Windows: Electron's `setDisplayMediaRequestHandler` with `audio: "loopback"` gives WASAPI loopback of everything the rep hears.
- macOS: Electron loopback depends on the version and ScreenCaptureKit permissions. The fallback is a virtual audio device (BlackHole is free) set as the meeting output; the overlay picks it up automatically by name.
- The overlay calls `setContentProtection(true)` so it is excluded from screen sharing and screenshots.

Limits: only works while the rep has the app open on the machine they take calls on. Prospect audio arrives as one mixed channel, so a three-person call attributes everyone who is not the rep as "prospect".

## 2. Meeting bot via Recall.ai (shipped, needs an account)

`POST /v1/bots` with a Teams meeting URL creates a Recall bot that joins the meeting and streams real-time transcript to `/v1/webhooks/recall`. Participants are named, so multi-person calls attribute correctly. The bot is visible in the participant list as "The Closer notetaker", the same way Fireflies and Otter appear.

Recall handles the Teams, Zoom and Meet bot infrastructure and the transcription. Cost is per hour of meeting on top of your own Claude usage. Some enterprise tenants block unknown bots by policy; those customers need option 3.

Flow in this codebase:

1. `POST /v1/bots` creates a `LiveSession` for the call, registers it in the `SessionHub` against the Recall bot id, then asks Recall to join the meeting with our webhook as both the real-time transcript endpoint and the status endpoint.
2. Recall posts `bot.status_change` (joining, waiting room, in call) and `transcript.partial_data` / `transcript.data` events. Participant names come with every event; the rep is matched by the display name given at bot creation, everyone else is the prospect side.
3. Anyone with the API key can attach to the call: the desktop overlay, the Teams meeting side panel in `apps/teams-panel`, or a dashboard on `GET /v1/calls/:id/events` (server-sent events). Late joiners get a snapshot first.
4. `bot.done` or `bot.fatal` closes the session, runs the post-call summary and fires `onCallEnded` for CRM logging.

The Teams side panel is the rep's private view inside the meeting window itself. Teams renders side panels per user, so the prospect never sees it, and no second app sits on top of the screen.

## 3. Native Teams media bot (not shipped)

Microsoft Graph Communications API, application-hosted media. Requirements:

- Azure Bot registration and a Teams app manifest with calling permissions.
- Tenant admin consent for `Calls.JoinGroupCall.All` and `Calls.AccessMedia.All` in every customer tenant.
- The `Microsoft.Graph.Communications.Calls.Media` SDK, which is .NET on Windows Server only, with a public TLS endpoint and specific port ranges.
- Your own transcription pipeline on the raw per-participant audio.

This is a two to three month build for a small team and only worth it once an enterprise customer will pay for it. The `LiveSession.ingest()` entry point is already source-agnostic, so a native bot would post the same transcript segments the Recall webhook does.

## What Microsoft does not offer

There is no Graph API for third-party apps to read a meeting's live transcript or audio as it happens. Meeting transcripts are available through Graph after the meeting ends, which is fine for a summary product and useless for a live coach.
