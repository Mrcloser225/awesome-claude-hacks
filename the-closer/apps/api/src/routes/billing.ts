import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Principal } from "../auth.js";
import type { OrgStore } from "../org-store.js";
import { planFromPrice, type StripeClient, type StripePlan } from "../platform/stripe.js";
import { PLAN_LIMITS } from "../platform/rate-limit.js";

export interface BillingDeps {
  orgs: OrgStore;
  stripe?: StripeClient;
  plans: StripePlan[];
  webUrl: string;
  log?: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void };
}

type Authed = { principal: Principal };
const p = (req: unknown) => (req as Authed).principal;

export function registerBillingRoutes(app: FastifyInstance, d: BillingDeps): void {
  app.get("/v1/billing", async (req) => {
    const org = await d.orgs.getOrg(p(req).orgId);
    return { plan: org?.plan ?? "trial", seats: org?.seats ?? 1, limits: PLAN_LIMITS[org?.plan ?? "trial"], trialCallsUsed: org?.trialCallsUsed ?? 0, configured: Boolean(d.stripe), hasSubscription: Boolean(org?.stripeSubscriptionId) };
  });

  app.post("/v1/billing/checkout", async (req, reply) => {
    const me = p(req);
    if (me.role !== "admin") return reply.code(403).send({ error: "This needs admin access" });
    if (!d.stripe) return reply.code(501).send({ error: "Billing is not configured on this server (STRIPE_SECRET_KEY)" });
    const body = z.object({ plan: z.enum(["solo", "team"]), seats: z.number().int().min(1).max(500).default(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const plan = d.plans.find((x) => x.id === body.data.plan);
    if (!plan) return reply.code(400).send({ error: "That plan has no Stripe price configured" });
    const org = await d.orgs.getOrg(me.orgId);
    const session = await d.stripe.createCheckout({ priceId: plan.priceId, seats: body.data.seats, orgId: me.orgId, customerEmail: me.email ?? "", customerId: org?.stripeCustomerId, successUrl: `${d.webUrl}/app/billing?status=success`, cancelUrl: `${d.webUrl}/app/billing?status=cancelled` });
    return { url: session.url };
  });

  app.post("/v1/billing/portal", async (req, reply) => {
    const me = p(req);
    if (me.role !== "admin") return reply.code(403).send({ error: "This needs admin access" });
    if (!d.stripe) return reply.code(501).send({ error: "Billing is not configured on this server" });
    const org = await d.orgs.getOrg(me.orgId);
    if (!org?.stripeCustomerId) return reply.code(400).send({ error: "No subscription yet" });
    return d.stripe.createPortal({ customerId: org.stripeCustomerId, returnUrl: `${d.webUrl}/app/billing` });
  });

  /** Stripe webhook. Raw body is required for signature verification; the content type parser below keeps it. */
  app.post("/v1/webhooks/stripe", { config: { rawBody: true } }, async (req, reply) => {
    if (!d.stripe) return reply.code(501).send({ error: "billing not configured" });
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    let event;
    try { event = d.stripe.verifyWebhook(raw, req.headers["stripe-signature"] as string | undefined); } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : "bad signature" }); }
    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        const orgId = obj.client_reference_id ?? obj.metadata?.orgId;
        if (orgId && obj.customer) await d.orgs.updateOrg(orgId, { stripeCustomerId: obj.customer, stripeSubscriptionId: obj.subscription ?? undefined });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const org = obj.metadata?.orgId ? await d.orgs.getOrg(obj.metadata.orgId) : obj.customer ? await d.orgs.findOrgByStripeCustomer(obj.customer) : null;
        if (!org) break;
        const item = obj.items?.data[0];
        const plan = planFromPrice(item?.price.id, d.plans);
        const active = obj.status === "active" || obj.status === "trialing" || obj.status === "past_due";
        await d.orgs.updateOrg(org.id, { stripeCustomerId: obj.customer ?? org.stripeCustomerId, stripeSubscriptionId: obj.id, plan: active && plan ? plan : "trial", seats: active ? item?.quantity ?? 1 : 1 });
        d.log?.info({ orgId: org.id, plan, status: obj.status }, "billing: subscription updated");
        break;
      }
      case "customer.subscription.deleted": {
        const org = obj.customer ? await d.orgs.findOrgByStripeCustomer(obj.customer) : null;
        if (org) await d.orgs.updateOrg(org.id, { plan: "trial", seats: 1, stripeSubscriptionId: undefined });
        break;
      }
      default:
        break;
    }
    return { received: true };
  });
}
