import { NextResponse } from "next/server";
import {
  createSessionToken,
  generateClaimCode,
  loginMessage,
  LOGIN_FRESHNESS_SECONDS,
  originParts,
  SESSION_COOKIE,
  sessionCookieAttributes,
  sessionMaxAge,
} from "@/lib/auth";
import { generateHandle, isValidHandle } from "@/lib/handles";
import {
  consumeLoginNonce,
  getLoginNonce,
  getUserByWallet,
  getWalletByHandle,
  isKvConfigured,
  setClaimCode,
  setUser,
} from "@/lib/kv";
import { verifyClaimSignature } from "@/lib/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerifyBody {
  wallet?: string;
  signature?: `0x${string}`;
  timestamp?: number;
}

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "auth not configured: KV missing" },
      { status: 503 },
    );
  }

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const walletRaw = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  const timestamp = typeof body.timestamp === "number" ? body.timestamp : 0;

  if (
    !/^0x[0-9a-fA-F]{40}$/.test(walletRaw) ||
    !/^0x[0-9a-fA-F]+$/.test(signature) ||
    !Number.isInteger(timestamp) ||
    timestamp <= 0
  ) {
    return NextResponse.json(
      { ok: false, error: "wallet, signature, timestamp all required" },
      { status: 400 },
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > LOGIN_FRESHNESS_SECONDS) {
    return NextResponse.json(
      { ok: false, error: `signature timestamp drift > ${LOGIN_FRESHNESS_SECONDS}s` },
      { status: 400 },
    );
  }

  const wallet = walletRaw.toLowerCase() as `0x${string}`;

  const nonce = await getLoginNonce(wallet);
  if (!nonce) {
    return NextResponse.json(
      { ok: false, error: "no pending nonce — request a new one" },
      { status: 400 },
    );
  }

  const message = loginMessage({ ...originParts(request.url), wallet, nonce, timestamp });
  const sigOk = await verifyClaimSignature({
    message,
    signature: signature as `0x${string}`,
    expectedOwner: wallet,
  });
  if (!sigOk) {
    return NextResponse.json(
      { ok: false, error: "signature does not match wallet" },
      { status: 401 },
    );
  }

  const consumedNonce = await consumeLoginNonce(wallet);
  if (consumedNonce !== nonce) {
    return NextResponse.json(
      { ok: false, error: "login nonce was already consumed — request a new one" },
      { status: 409 },
    );
  }

  let user = await getUserByWallet(wallet);
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const handle = await mintUniqueHandle();
    user = {
      wallet,
      handle,
      createdAt: Date.now(),
      agents: [],
    };
    await setUser(user);
    await setClaimCode(wallet, generateClaimCode());
  }

  const sessionToken = await createSessionToken(wallet);
  const res = NextResponse.json({
    ok: true,
    user: {
      wallet: user.wallet,
      handle: user.handle,
      createdAt: user.createdAt,
    },
    isNewUser,
  });
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionToken}; ${sessionCookieAttributes(sessionMaxAge())}`,
  );
  return res;
}

async function mintUniqueHandle(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = generateHandle();
    if (!isValidHandle(candidate)) continue;
    const taken = await getWalletByHandle(candidate);
    if (!taken) return candidate;
  }
  // Last-resort fallback: append a timestamp suffix.
  return `${generateHandle()}-${Date.now().toString(36).slice(-4)}`;
}
