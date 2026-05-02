import { NextResponse } from "next/server";
import { generateMagicToken } from "@/lib/auth";
import { isKvConfigured, setMagicToken } from "@/lib/kv";
import { sendMagicLink } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "auth not configured: KV missing" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const email = typeof (body as { email?: unknown }).email === "string"
    ? ((body as { email: string }).email).trim()
    : "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400 });
  }

  const token = generateMagicToken();
  await setMagicToken(token, email);

  const baseUrl = resolveBaseUrl(request);
  const link = `${baseUrl}/auth/callback?token=${token}`;

  const result = await sendMagicLink({ to: email, link });
  if (!result.ok) {
    // In dev (no Resend key) we still want the flow to be usable; surface the
    // link in the response so the developer can paste it.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        ok: true,
        devLink: link,
        warning: result.error,
      });
    }
    return NextResponse.json(
      { ok: false, error: `mail send failed: ${result.error}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sendId: result.id });
}

function resolveBaseUrl(request: Request): string {
  const fromEnv = process.env.POLIS_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
