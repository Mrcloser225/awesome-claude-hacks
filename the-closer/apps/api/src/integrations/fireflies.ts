import type { TranscriptSegment } from "@closer/core";

/**
 * Fireflies.ai GraphQL client. Lets a customer bring the calls Fireflies
 * already recorded into The Closer and work them with Claude: summary,
 * objections missed, follow-up, and chat about the call.
 */
export interface FirefliesTranscriptMeta { id: string; title: string; date: number; duration: number; organizer_email?: string | null }

interface Sentence { index: number; speaker_name: string | null; text: string; start_time: number; end_time: number }

const LIST = `query List($limit: Int) { transcripts(limit: $limit) { id title date duration organizer_email } }`;
const GET = `query Get($id: String!) { transcript(id: $id) { id title date duration organizer_email sentences { index speaker_name text start_time end_time } } }`;

export class FirefliesClient {
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch, private readonly endpoint = "https://api.fireflies.ai/graphql") {}

  private async gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Fireflies ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new Error(`Fireflies: ${body.errors.map((e) => e.message).join("; ")}`);
    if (!body.data) throw new Error("Fireflies: empty response");
    return body.data;
  }

  async list(limit = 20): Promise<FirefliesTranscriptMeta[]> {
    return (await this.gql<{ transcripts: FirefliesTranscriptMeta[] }>(LIST, { limit })).transcripts;
  }

  /** Returns the transcript as our segments. `repName` decides which speaker is the rep. */
  async get(id: string, repName?: string): Promise<{ meta: FirefliesTranscriptMeta; segments: TranscriptSegment[] }> {
    const t = (await this.gql<{ transcript: FirefliesTranscriptMeta & { sentences: Sentence[] } }>(GET, { id })).transcript;
    const rep = repName?.toLowerCase();
    const segments: TranscriptSegment[] = (t.sentences ?? []).map((s) => ({
      id: `ff_${t.id}_${s.index}`,
      speaker: rep && s.speaker_name?.toLowerCase() === rep ? "rep" : "prospect",
      participant: s.speaker_name ?? undefined,
      text: s.text,
      startMs: Math.round(s.start_time * 1000),
      endMs: Math.round(s.end_time * 1000),
      isFinal: true,
    }));
    const { sentences: _drop, ...meta } = t;
    return { meta, segments };
  }
}
