/** Finds a Teams, Zoom, Meet or Webex join link in free text (invite bodies, locations). */
const PATTERNS = [
  /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"')]+/i,
  /https:\/\/teams\.live\.com\/meet\/[^\s<>"')]+/i,
  /https:\/\/[\w.-]*zoom\.us\/[jw]\/[^\s<>"')]+/i,
  /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,
  /https:\/\/[\w.-]*webex\.com\/[^\s<>"')]+/i,
];

export function extractJoinUrl(...texts: Array<string | null | undefined>): string | null {
  for (const t of texts) {
    if (!t) continue;
    const clean = t.replace(/&amp;/g, "&");
    for (const re of PATTERNS) {
      const m = re.exec(clean);
      if (m) return m[0];
    }
  }
  return null;
}
