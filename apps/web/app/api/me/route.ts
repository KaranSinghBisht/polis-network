import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAgentClaim, getClaimCode } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const code = await getClaimCode(user.email);
  const claims = await Promise.all(
    user.agents.map(async (peer) => {
      const claim = await getAgentClaim(peer);
      if (!claim) return null;
      return {
        peer: claim.peer,
        ownerWallet: claim.ownerWallet,
        claimedAt: claim.claimedAt,
      };
    }),
  );

  return NextResponse.json({
    user: {
      email: user.email,
      handle: user.handle,
      createdAt: user.createdAt,
    },
    claimCode: code,
    agents: claims.filter((c): c is NonNullable<typeof c> => c !== null),
  });
}
