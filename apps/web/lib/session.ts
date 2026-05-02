/**
 * Session helpers for Next.js 15 server contexts (route handlers + RSCs).
 */

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";
import { getUserByWallet } from "./kv";
import type { PolisUser } from "./types";

export async function getCurrentUser(): Promise<PolisUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return await getUserByWallet(session.wallet);
}
