import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe over its REST API: Checkout for new subscriptions, the customer
 * portal for changes and cancellation, and webhook verification. No SDK so
 * the surface stays small and testable with a stubbed fetch.
 */
export interface StripePlan { id: "solo" | "team"; priceId: string }

export class StripeClient {
  constructor(private readonly o: { secretKey: string; webhookSecret?: string; fetchImpl?: typeof fetch }) {}

  private async post<T>(path: string, form: Record<string, string>): Promise<T> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`https://api.stripe.com/v1${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.o.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    });
    const body = (await res.json()) as T & { error?: { message: string } };
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${body.error?.message ?? "unknown"}`);
    return body;
  }

  async createCheckout(i: { priceId: string; seats: number; orgId: string; customerEmail: string; customerId?: string; successUrl: string; cancelUrl: string }): Promise<{ url: string }> {
    const form: Record<string, string> = {
      mode: "subscription", "line_items[0][price]": i.priceId, "line_items[0][quantity]": String(i.seats),
      success_url: i.successUrl, cancel_url: i.cancelUrl, client_reference_id: i.orgId, "subscription_data[metadata][orgId]": i.orgId, allow_promotion_codes: "true",
    };
    if (i.customerId) form.customer = i.customerId; else form.customer_email = i.customerEmail;
    return this.post<{ url: string }>("/checkout/sessions", form);
  }

  async createPortal(i: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    return this.post<{ url: string }>("/billing_portal/sessions", { customer: i.customerId, return_url: i.returnUrl });
  }

  /** Verifies Stripe-Signature (t=..., v1=...) and returns the parsed event. */
  verifyWebhook(rawBody: string, header: string | undefined, now = Math.floor(Date.now() / 1000), toleranceSec = 300): StripeEvent {
    if (!this.o.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
    if (!header) throw new Error("missing Stripe-Signature");
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
    const t = parts.t, v1 = parts.v1;
    if (!t || !v1) throw new Error("malformed Stripe-Signature");
    if (Math.abs(now - Number(t)) > toleranceSec) throw new Error("Stripe signature too old");
    const expected = createHmac("sha256", this.o.webhookSecret).update(`${t}.${rawBody}`).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(v1);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("bad Stripe signature");
    return JSON.parse(rawBody) as StripeEvent;
  }
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: { id: string; customer?: string; subscription?: string; client_reference_id?: string; status?: string; metadata?: Record<string, string>; items?: { data: Array<{ price: { id: string }; quantity: number }> } } };
}

/** Maps a subscription's price to our plan id. */
export function planFromPrice(priceId: string | undefined, plans: StripePlan[]): "solo" | "team" | null {
  return plans.find((p) => p.priceId === priceId)?.id ?? null;
}
