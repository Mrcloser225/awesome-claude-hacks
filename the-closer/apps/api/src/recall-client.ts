/**
 * Thin client for Recall.ai's meeting bot API. One call: create a bot that
 * joins the meeting URL and streams real-time transcript to our webhook.
 * Docs: https://docs.recall.ai (Create Bot, real-time transcription).
 */
export class RecallClient {
  constructor(private readonly opts: { apiKey: string; region: string; webhookUrl: string; fetchImpl?: typeof fetch }) {}

  async createBot(input: { meetingUrl: string; callId: string; repName: string; botName?: string }): Promise<{ botId: string }> {
    const f = this.opts.fetchImpl ?? fetch;
    const res = await f(`https://${this.opts.region}.recall.ai/api/v1/bot/`, {
      method: "POST",
      headers: { Authorization: `Token ${this.opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        bot_name: input.botName ?? "The Closer notetaker",
        metadata: { callId: input.callId, repName: input.repName },
        recording_config: {
          transcript: { provider: { deepgram_streaming: { model: "nova-3", language: "en-GB" } } },
          realtime_endpoints: [
            { type: "webhook", url: this.opts.webhookUrl, events: ["transcript.data", "transcript.partial_data"] },
          ],
        },
        // Lifecycle events (joining, in call, ended) come through the same webhook so the
        // rep's overlay can show the bot's status and the call is closed out automatically.
        status_webhook_url: this.opts.webhookUrl,
      }),
    });
    if (!res.ok) throw new Error(`Recall ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { id: string };
    return { botId: body.id };
  }
}
