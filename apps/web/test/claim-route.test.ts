import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { encodeFunctionResult } from "viem";
import { claimMessage } from "../lib/auth";

const PEER = "a".repeat(64);
const OTHER_PEER = "b".repeat(64);
const ENS_NAME = "Scout-7.Polis-Agent.eth";
const NORMALIZED_ENS_NAME = "scout-7.polis-agent.eth";
const CLAIM_CODE = "AB23CD45";
const OTHER_CLAIM_CODE = "CD45EF67";
const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f094538f5e38dfca2e46e1b702a71a08590dca4b";

const AGENT_REGISTRY_ABI = [
  {
    name: "agents",
    type: "function",
    inputs: [{ name: "peerId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "metadataURI", type: "string" },
      { name: "registeredAt", type: "uint64" },
      { name: "reputation", type: "uint64" },
    ],
    stateMutability: "view",
  },
] as const;

async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prior: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prior[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function redisResult(value: unknown): unknown {
  if (typeof value === "string" && value !== "OK") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  return value;
}

async function bodyJson(init?: RequestInit): Promise<unknown> {
  if (typeof init?.body === "string") return JSON.parse(init.body);
  if (init?.body instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(init.body));
  }
  throw new Error("test fetch expected a JSON string body");
}

function installMockFetch(redis: Map<string, string>, owner: `0x${string}`): () => void {
  const priorFetch = globalThis.fetch;
  const runRedisCommand = (command: unknown[]): unknown => {
    const [rawName, ...args] = command;
    const name = String(rawName).toLowerCase();
    if (name === "get") {
      const key = String(args[0]);
      if (key.toLowerCase().startsWith("wallet-by-code:")) return owner.toLowerCase();
      return redis.get(key) ?? null;
    }
    if (name === "set") {
      const key = String(args[0]);
      const options = args.slice(2);
      const nx = options.some((arg) => {
        if (typeof arg === "string") return arg.toLowerCase() === "nx";
        return Boolean(arg && typeof arg === "object" && "nx" in arg && (arg as { nx?: boolean }).nx);
      });
      if (nx && redis.has(key)) return null;
      redis.set(key, String(args[1]));
      return "OK";
    }
    if (name === "del") {
      let removed = 0;
      for (const key of args) {
        if (redis.delete(String(key))) removed += 1;
      }
      return removed;
    }
    throw new Error(`unexpected Redis command ${name}`);
  };

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://upstash.test")) {
      const body = (await bodyJson(init)) as unknown[];
      if (Array.isArray(body[0])) {
        return json(body.map((command) => ({ result: redisResult(runRedisCommand(command as unknown[])) })));
      }
      return json({ result: redisResult(runRedisCommand(body)) });
    }

    if (url.startsWith("https://gensyn.test")) {
      const payload = (await bodyJson(init)) as { id?: number; method?: string };
      if (payload.method === "eth_chainId") {
        return json({ jsonrpc: "2.0", id: payload.id, result: "0xa7675" });
      }
      if (payload.method === "eth_call") {
        return json({
          jsonrpc: "2.0",
          id: payload.id,
          result: encodeFunctionResult({
            abi: AGENT_REGISTRY_ABI,
            functionName: "agents",
            result: [owner, `ens://${NORMALIZED_ENS_NAME}?peer=${PEER}`, 1_777_777_777n, 0n],
          }),
        });
      }
      throw new Error(`unexpected RPC method ${payload.method}`);
    }

    throw new Error(`unexpected fetch URL ${url}`);
  };
  return () => {
    globalThis.fetch = priorFetch;
  };
}

test("claim route accepts the CLI-signed peer format and reserves ENS names for routing", async () => {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const redis = new Map<string, string>([
    [`wallet-by-code:${CLAIM_CODE}`, account.address.toLowerCase()],
    [`wallet-by-code:${OTHER_CLAIM_CODE}`, account.address.toLowerCase()],
  ]);
  const restoreFetch = installMockFetch(redis, account.address);

  await withEnv(
    {
      KV_REST_API_URL: "https://upstash.test",
      KV_REST_API_TOKEN: "token",
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      GENSYN_RPC_URL: "https://gensyn.test",
    },
    async () => {
      try {
        const [{ POST }, { getAgentClaimByEnsName }] = await Promise.all([
          import("../app/api/claim/route"),
          import("../lib/kv"),
        ]);
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await account.signMessage({
          message: claimMessage({
            domain: "polis.example",
            uri: "https://polis.example",
            peer: PEER,
            code: CLAIM_CODE,
            ensName: NORMALIZED_ENS_NAME,
            timestamp,
          }),
        });

        const accepted = await POST(
          new Request("https://polis.example/api/claim", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              peer: PEER,
              code: CLAIM_CODE,
              signature,
              signerAddress: account.address,
              timestamp,
              ensName: ENS_NAME,
            }),
          }),
        );
        const acceptedBody = await accepted.json() as {
          ok?: boolean;
          claim?: { peer?: string; ownerWallet?: string; ensName?: string; ensStatus?: string };
        };

        assert.equal(accepted.status, 200, JSON.stringify(acceptedBody));
        assert.equal(acceptedBody.ok, true);
        assert.equal(acceptedBody.claim?.peer, PEER);
        assert.equal(acceptedBody.claim?.ownerWallet, account.address.toLowerCase());
        assert.equal(acceptedBody.claim?.ensName, NORMALIZED_ENS_NAME);
        assert.equal(acceptedBody.claim?.ensStatus, "reserved");

        const routedClaim = await getAgentClaimByEnsName("SCOUT-7.POLIS-AGENT.ETH");
        assert.equal(routedClaim?.peer, PEER);
        assert.equal(routedClaim?.ownerWallet, account.address.toLowerCase());

        const replay = await POST(
          new Request("https://polis.example/api/claim", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              peer: PEER,
              code: CLAIM_CODE,
              signature,
              signerAddress: account.address,
              timestamp,
              ensName: ENS_NAME,
            }),
          }),
        );
        const replayBody = await replay.json() as { ok?: boolean; error?: string };
        assert.equal(replay.status, 409);
        assert.equal(replayBody.ok, false);
        assert.match(replayBody.error ?? "", /signature already used/);

        const otherTimestamp = Math.floor(Date.now() / 1000);
        const otherSignature = await account.signMessage({
          message: claimMessage({
            domain: "polis.example",
            uri: "https://polis.example",
            peer: OTHER_PEER,
            code: OTHER_CLAIM_CODE,
            ensName: NORMALIZED_ENS_NAME,
            timestamp: otherTimestamp,
          }),
        });
        const duplicate = await POST(
          new Request("https://polis.example/api/claim", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              peer: OTHER_PEER,
              code: OTHER_CLAIM_CODE,
              signature: otherSignature,
              signerAddress: account.address,
              timestamp: otherTimestamp,
              ensName: NORMALIZED_ENS_NAME,
            }),
          }),
        );
        const duplicateBody = await duplicate.json() as { ok?: boolean; error?: string };

        assert.equal(duplicate.status, 409);
        assert.equal(duplicateBody.ok, false);
        assert.match(duplicateBody.error ?? "", /already bound to another Polis agent/);
      } finally {
        restoreFetch();
      }
    },
  );
});
