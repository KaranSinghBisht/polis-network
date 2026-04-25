#!/usr/bin/env node --env-file=.env
// In-process smoke test for the LLM adapter layer.
// Runs two agents (scout + skeptic) against a stub AxlClient — no AXL node
// needed — and prints whatever the LLM returns. Use this to confirm the
// runtime + provider plumbing work end-to-end before the multi-machine demo.
//
// Usage:
//   node --env-file=.env scripts/smoke-llm.mjs
//
// Honours POLIS_LLM_PROVIDER (groq|anthropic) and the matching *_API_KEY.

import { Agent, encodeMessage, createLlmClient } from "../packages/runtime/dist/index.js";

class StubAxlClient {
  constructor() {
    this.sent = [];
  }
  async send(destPeerId, body) {
    const text = typeof body === "string" ? body : new TextDecoder().decode(body);
    this.sent.push({ destPeerId, text });
    return text.length;
  }
  async recv() {
    return null;
  }
  async topology() {
    return { our_ipv6: "::1", our_public_key: "stub", peers: [], tree: [] };
  }
}

const llm = createLlmClient();
console.log(`[smoke] llm provider=${llm.provider} model=${llm.defaultModel}\n`);

const HUMAN_PEER = "11" + "0".repeat(62);
const SCOUT_PEER = "aa" + "0".repeat(62);
const SKEPTIC_PEER = "bb" + "0".repeat(62);

const scoutAxl = new StubAxlClient();
const skepticAxl = new StubAxlClient();

const scout = new Agent(
  {
    name: "scout-1",
    role: "scout",
    persona:
      "You find primary sources fast. Cite specifics. No conclusions; that's the analyst's job.",
    peerIdHex: SCOUT_PEER,
    maxTokens: 220,
  },
  { axl: scoutAxl, llm },
);

const skeptic = new Agent(
  {
    name: "skeptic-1",
    role: "skeptic",
    persona:
      "You stress-test claims, request sources, and call out hallucinations. Brief and pointed.",
    peerIdHex: SKEPTIC_PEER,
    maxTokens: 220,
  },
  { axl: skepticAxl, llm },
);

const incomingFromHuman = {
  v: 1,
  kind: "post",
  topic: "town.gensyn",
  from: HUMAN_PEER,
  content:
    "What's the most interesting thing landing on Gensyn mainnet this week, and what should the town be sceptical of?",
  ts: Date.now(),
};

console.log("[smoke] human → scout-1:");
console.log(`  topic=${incomingFromHuman.topic}`);
console.log(`  body=${incomingFromHuman.content}\n`);

const t0 = Date.now();
const scoutReply = await scout.handle({
  fromPeerId: HUMAN_PEER,
  body: encodeMessage(incomingFromHuman),
});
const scoutMs = Date.now() - t0;

if (!scoutReply) {
  console.error("[smoke] scout-1 ignored the prompt — no reply emitted.");
  process.exit(1);
}

console.log(`\n[smoke] scout-1 reply (${scoutMs}ms):`);
console.log(scoutReply.content);
console.log(`  archived sends from scout: ${scoutAxl.sent.length}`);

const t1 = Date.now();
const skepticReply = await skeptic.handle({
  fromPeerId: SCOUT_PEER,
  body: encodeMessage(scoutReply),
});
const skepticMs = Date.now() - t1;

if (!skepticReply) {
  console.error(
    "\n[smoke] skeptic-1 ignored scout-1's reply — Agent.handle filters 'reply' kinds " +
      "to prevent loops; that's expected. Re-running with a 'post' kind for the skeptic.",
  );
  const repost = { ...scoutReply, kind: "post" };
  const t2 = Date.now();
  const retry = await skeptic.handle({
    fromPeerId: SCOUT_PEER,
    body: encodeMessage(repost),
  });
  const retryMs = Date.now() - t2;
  if (!retry) {
    console.error("[smoke] skeptic-1 still ignored. Aborting.");
    process.exit(1);
  }
  console.log(`\n[smoke] skeptic-1 reply (${retryMs}ms):`);
  console.log(retry.content);
} else {
  console.log(`\n[smoke] skeptic-1 reply (${skepticMs}ms):`);
  console.log(skepticReply.content);
}

console.log("\n[smoke] OK — both agents called the LLM and produced replies.");
console.log("[smoke] Next: run the 3-terminal AXL smoke for an end-to-end demo.");
