---
name: content-shipper
description: Use this skill to move one article at a time out of the recovered SEO backlog and into publish-ready state. Triggers include 'ship the next article', 'what's next in the content queue', or 'draft the next SEO post'.
---

# Content Shipper

Tier 2 agent in the Glaxtons Claude OS. As of August 2026 there were 50+ fully-scoped
SEO articles sitting unpublished, alongside a ticket that admitted the content engine
was not producing inbound leads. The problem was never the ideas. This skill ships them
one at a time and tracks whether shipping them actually produces anything.

## How to run

1. Read `references/seo-queue.md` and take the next unshipped title in priority order.
2. Draft the full article using `seo-content-block` for structure and Glaxtons house
   style.
3. Produce: the article body, a meta title (under 60 characters), a meta description
   (under 155 characters), and the target keyword.
4. Add a Todoist task to project `6gXwrJGfX8QJ63Cx` (Glaxtons - Operations) titled
   "Publish: {article title}" with the drafted copy in the description and a checklist:
   confirm GA4 conversion tracking is live, publish to glaxtons.co.uk, note the
   publish date.
5. Cross the title off `references/seo-queue.md` (mark it shipped, do not delete the
   line, so the record of what has gone out stays intact).
6. On the next run, before drafting anything new, check whether any previously shipped
   article has driven an inbound enquiry (ask JP, or check `lead-router` output for a
   website-sourced lead) and report that back honestly. If nothing has landed after 4-5
   articles are live, say so plainly rather than continuing to ship on faith.

## Rules

- One article per run. Do not batch-draft the whole backlog: partial, unpublished
  drafts are exactly the failure mode this skill exists to fix.
- Publishing to the live site and confirming GA4 is not something this skill can do by
  itself; it produces the checklist item and the ready copy, and the publish step needs
  a human or the site's own CMS access to complete.
- No em dashes, no asterisks, UK English house style throughout.
