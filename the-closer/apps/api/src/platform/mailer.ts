export interface Mail { to: string; subject: string; text: string; html?: string }

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Development: prints the mail so the link can be copied from the log. */
export class ConsoleMailer implements Mailer {
  sent: Mail[] = [];
  constructor(private readonly log: (m: string) => void = (m) => console.log(m)) {}
  async send(mail: Mail) {
    this.sent.push(mail);
    this.log(`[mail] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}`);
  }
}

/** Resend (https://resend.com) over its REST API. Any transactional provider with a similar endpoint fits in ten lines. */
export class ResendMailer implements Mailer {
  constructor(private readonly o: { apiKey: string; from: string; fetchImpl?: typeof fetch }) {}
  async send(mail: Mail) {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.o.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.o.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

export const templates = {
  verify: (link: string) => ({ subject: "Confirm your email for The Closer", text: `Welcome to The Closer.\n\nConfirm your email by opening this link:\n${link}\n\nThe link is valid for 24 hours.` }),
  reset: (link: string) => ({ subject: "Reset your password", text: `Someone asked to reset the password on your The Closer account.\n\nIf that was you, open this link:\n${link}\n\nIt is valid for one hour. If it was not you, ignore this email.` }),
  invite: (link: string, inviter: string, company: string) => ({ subject: `${inviter} invited you to The Closer`, text: `${inviter} has invited you to join ${company} on The Closer, the live sales coach.\n\nAccept the invitation here:\n${link}\n\nThe link is valid for seven days.` }),
};
