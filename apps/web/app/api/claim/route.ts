import { NextResponse } from "next/server";
import {
  CLAIM_FRESHNESS_SECONDS,
  claimMessage,
} from "@/lib/auth";
import {
  getEmailByClaimCode,
  isKvConfigured,
  setAgentClaim,
} from "@/lib/kv";
import { getRegistryOwner, normalizePeerId, verifyClaimSignature } from "@/lib/registry";
import type { AgentClaim } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClaimBody {
  peer?: string;
  code?: string;
  signature?: `0x${string}`;
  signerAddress?: `0x${string}`;
  timestamp?: number;
}

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "claim not configured: KV missing" },
      { status: 503 },
    );
  }

  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const peer = typeof body.peer === "string" ? body.peer : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const signature = typeof body.signature === "string" ? (body.signature as `0x${string}`) : null;
  const signerAddress = typeof body.signerAddress === "string"
    ? (body.signerAddress as `0x${string}`)
    : null;
  const timestamp = typeof body.timestamp === "number" ? body.timestamp : 0;

  if (!peer || !code || !signature || !signerAddress || !timestamp) {
    return NextResponse.json(
      { ok: false, error: "peer, code, signature, signerAddress, timestamp all required" },
      { status: 400 },
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > CLAIM_FRESHNESS_SECONDS) {
    return NextResponse.json(
      { ok: false, error: `signature timestamp drift > ${CLAIM_FRESHNESS_SECONDS}s` },
      { status: 400 },
    );
  }

  let normalizedPeer: `0x${string}`;
  try {
    normalizedPeer = normalizePeerId(peer);
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }

  const email = await getEmailByClaimCode(code);
  if (!email) {
    return NextResponse.json({ ok: false, error: "claim code unknown or revoked" }, { status: 404 });
  }

  const message = claimMessage({ peer: normalizedPeer, code, timestamp });
  const sigOk = await verifyClaimSignature({
    message,
    signature,
    expectedOwner: signerAddress,
  });
  if (!sigOk) {
    return NextResponse.json({ ok: false, error: "signature does not match signerAddress" }, { status: 401 });
  }

  const registryOwner = await getRegistryOwner(normalizedPeer);
  if (!registryOwner) {
    return NextResponse.json(
      { ok: false, error: "peer is not registered in AgentRegistry; run polis register first" },
      { status: 412 },
    );
  }
  if (registryOwner.toLowerCase() !== signerAddress.toLowerCase()) {
    return NextResponse.json(
      {
        ok: false,
        error: `signerAddress ${signerAddress} does not match the AgentRegistry owner ${registryOwner} for that peer`,
      },
      { status: 401 },
    );
  }

  const claim: AgentClaim = {
    peer: normalizedPeer.slice(2), // store as 64-char hex without 0x
    ownerEmail: email,
    ownerWallet: signerAddress,
    signature,
    signedMessage: message,
    claimedAt: Date.now(),
  };
  await setAgentClaim(claim);

  return NextResponse.json({
    ok: true,
    claim: {
      peer: claim.peer,
      ownerEmail: claim.ownerEmail,
      ownerWallet: claim.ownerWallet,
      claimedAt: claim.claimedAt,
    },
  });
}
