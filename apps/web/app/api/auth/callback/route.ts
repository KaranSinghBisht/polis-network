import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  generateClaimCode,
  sessionCookieAttributes,
  sessionMaxAge,
} from "@/lib/auth";
import {
  consumeMagicToken,
  getClaimCode,
  getUserByEmail,
  isKvConfigured,
  setClaimCode,
  setUser,
} from "@/lib/kv";
import { generateHandle } from "@/lib/handles";
import type { PolisUser } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.redirect(redirectUrl(request, "/login?error=auth-disabled"));
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.redirect(redirectUrl(request, "/login?error=missing-token"));
  }

  const email = await consumeMagicToken(token);
  if (!email) {
    return NextResponse.redirect(redirectUrl(request, "/login?error=expired-or-used"));
  }

  // First-login bootstrap: mint user with random handle + claim code.
  let user = await getUserByEmail(email);
  if (!user) {
    user = await ensureFreshUser(email);
  } else if (!(await getClaimCode(email))) {
    await setClaimCode(email, generateClaimCode());
  }

  const sessionToken = await createSessionToken(email);

  const res = NextResponse.redirect(redirectUrl(request, "/me"));
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionToken}; ${sessionCookieAttributes(sessionMaxAge())}`,
  );
  return res;
}

async function ensureFreshUser(email: string): Promise<PolisUser> {
  const handle = generateHandle();
  const user: PolisUser = {
    email: email.toLowerCase(),
    handle,
    createdAt: Date.now(),
    agents: [],
  };
  await setUser(user);
  await setClaimCode(email, generateClaimCode());
  return user;
}

function redirectUrl(request: Request, path: string): string {
  const base =
    process.env.POLIS_BASE_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  return `${base}${path}`;
}
