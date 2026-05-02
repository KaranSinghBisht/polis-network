import { createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { canReadLocalFiles } from "@/lib/local-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OperatorProfile {
  address: `0x${string}`;
  peer?: string;
  network: "testnet" | "mainnet";
  chainId: number;
  rpcUrl: string;
  contracts: {
    registry?: `0x${string}`;
    paymentRouter?: `0x${string}`;
    postIndex?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  ens?: {
    name: string;
    peerText?: string;
    chainAddress?: `0x${string}`;
    primaryName?: string;
    verifiedAt: string;
  };
  storage?: {
    provider: "local" | "0g" | "none";
  };
}

export function GET(request: Request) {
  if (!canReadLocalFiles(request)) {
    return NextResponse.json({ profile: null, source: "disabled" });
  }

  const cfgPath = join(homedir(), ".polis", "config.json");
  if (!existsSync(cfgPath)) {
    return NextResponse.json({ profile: null, source: "no-config" });
  }

  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ profile: null, source: "parse-error" });
  }

  const address = cfg.address;
  if (typeof address !== "string" || !address.startsWith("0x")) {
    return NextResponse.json({ profile: null, source: "no-address" });
  }

  const ens = readEnsBlock(cfg.ens);
  const peer = derivePeerId((cfg.axl as Record<string, unknown> | undefined)?.keyPath);

  const profile: OperatorProfile = {
    address: address as `0x${string}`,
    peer,
    network: cfg.network === "mainnet" ? "mainnet" : "testnet",
    chainId: typeof cfg.chainId === "number" ? cfg.chainId : 685685,
    rpcUrl: typeof cfg.rpcUrl === "string" ? cfg.rpcUrl : "",
    contracts: {
      registry: optionalAddress(cfg.registryAddress),
      paymentRouter: optionalAddress(cfg.paymentRouterAddress),
      postIndex: optionalAddress(cfg.postIndexAddress),
      usdc: optionalAddress(cfg.usdc),
    },
    ens,
    storage: readStorageBlock(cfg.storage),
  };

  return NextResponse.json({ profile, source: "config" });
}

function optionalAddress(value: unknown): `0x${string}` | undefined {
  return typeof value === "string" && value.startsWith("0x") ? (value as `0x${string}`) : undefined;
}

function derivePeerId(keyPath: unknown): string | undefined {
  if (typeof keyPath !== "string" || !existsSync(keyPath)) return undefined;
  try {
    const pem = readFileSync(keyPath, "utf8");
    const privateKey = createPrivateKey(pem);
    const publicKey = createPublicKey(privateKey);
    const der = publicKey.export({ format: "der", type: "spki" }) as Buffer;
    if (der.length < 32) return undefined;
    return der.subarray(der.length - 32).toString("hex");
  } catch {
    return undefined;
  }
}

function readEnsBlock(value: unknown): OperatorProfile["ens"] {
  if (typeof value !== "object" || value === null) return undefined;
  const e = value as Record<string, unknown>;
  if (typeof e.name !== "string" || typeof e.verifiedAt !== "string") return undefined;
  return {
    name: e.name,
    peerText: typeof e.peerText === "string" ? e.peerText : undefined,
    chainAddress: optionalAddress(e.chainAddress),
    primaryName: typeof e.primaryName === "string" ? e.primaryName : undefined,
    verifiedAt: e.verifiedAt,
  };
}

function readStorageBlock(value: unknown): OperatorProfile["storage"] {
  if (typeof value !== "object" || value === null) return undefined;
  const s = value as Record<string, unknown>;
  const provider = s.provider;
  if (provider === "local" || provider === "0g" || provider === "none") {
    return { provider };
  }
  return undefined;
}

