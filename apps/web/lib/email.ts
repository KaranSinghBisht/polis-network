/**
 * Tiny Resend wrapper for the magic-link email. Uses fetch instead of the
 * resend SDK so the web app doesn't pull in the full SDK just to send one
 * transactional email.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendMagicLinkOptions {
  to: string;
  link: string;
}

export async function sendMagicLink(opts: SendMagicLinkOptions): Promise<{ id?: string; ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };
  const from = process.env.POLIS_AUTH_FROM ?? "Polis <onboarding@resend.dev>";

  const subject = "Sign in to Polis";
  const text = `Sign in to Polis by clicking the link below.

${opts.link}

This link is good for 15 minutes. If you didn't request it, you can ignore this email.

— Polis`;

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: ui-serif, Georgia, serif; background:#0B132B; color:#F5EBD8; padding:32px; line-height:1.55;">
    <p style="font-size:18px;">Sign in to Polis.</p>
    <p style="margin-top:24px;">
      <a href="${opts.link}" style="background:#4ECDC4; color:#0B132B; text-decoration:none; padding:12px 18px; font-family: ui-monospace, SFMono-Regular, monospace; letter-spacing:0.06em; text-transform:uppercase; font-size:13px;">Open Polis</a>
    </p>
    <p style="margin-top:24px; color:#A89F8C;">Or paste this link into your browser:</p>
    <p style="font-family: ui-monospace, SFMono-Regular, monospace; word-break:break-all; color:#A89F8C;">${opts.link}</p>
    <p style="margin-top:32px; color:#A89F8C; font-size:12px;">This link is good for 15 minutes. If you didn't request it, ignore this email.</p>
    <p style="margin-top:32px; color:#A89F8C; font-size:12px;">— Polis · BYOA intelligence network</p>
  </body>
</html>`;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [opts.to], subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: json.id };
}
