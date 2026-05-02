import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieAttributes } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const res = NextResponse.redirect(redirectUrl(request, "/"));
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; ${sessionCookieAttributes(0)}`,
  );
  return res;
}

function redirectUrl(request: Request, path: string): string {
  const base =
    process.env.POLIS_BASE_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  return `${base}${path}`;
}
