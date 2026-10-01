/**
 * Thin client for Recall.ai's meeting bot API. One call: create a bot that
 * joins the meeting URL and streams real-time transcript to our webhook.
 * Docs: https://docs.recall.ai (Create Bot, real-time transcription).
 */
export class RecallClient {
  constructor(private readonly opts: { apiKey: string; region: string; webhookUrl: string; fetchImpl?: typeof fetch }) {}

  /** Posts a message in the meeting chat as the bot. Used for the recording disclosure. */
  async sendChatMessage(botId: string, message: string): Promise<void> {
    const f = this.opts.fetchImpl ?? fetch;
    const res = await f(`https://${this.opts.region}.recall.ai/api/v1/bot/${botId}/send_chat_message/`, {
      method: "POST", headers: { Authorization: `Token ${this.opts.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Recall chat ${res.status}: ${await res.text()}`);
  }

  async createBot(input: { meetingUrl: string; callId: string; repName: string; botName?: string; joinAt?: number }): Promise<{ botId: string }> {
    const f = this.opts.fetchImpl ?? fetch;
    const res = await f(`https://${this.opts.region}.recall.ai/api/v1/bot/`, {
      method: "POST",
      headers: { Authorization: `Token ${this.opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        // Display name shown in the participant list. Defaults to "<rep> (notes)"; tenants can set anything.
        bot_name: input.botName ?? `${input.repName} (notes)`,
        metadata: { callId: input.callId, repName: input.repName },
        // Scheduled join: Recall holds the bot and sends it in at this time (ISO 8601).
        ...(input.joinAt ? { join_at: new Date(input.joinAt).toISOString() } : {}),
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
