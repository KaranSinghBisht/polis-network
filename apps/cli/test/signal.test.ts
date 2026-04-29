import assert from "node:assert/strict";
import test from "node:test";
import { formatSignal } from "../src/commands/signal.js";

test("formatSignal renders sourced structured intelligence", () => {
  const signal = formatSignal({
    headline: "Delphi market volume crossed a new local high",
    beat: "delphi-markets",
    body: "Volume increased after the new Gensyn launch announcement.",
    sources: [" https://delphi.gensyn.ai/ "],
    tags: ["gensyn", "markets"],
    confidence: "medium",
    disclosure: "groq plus manual source check",
  });

  assert.match(signal, /^SIGNAL/);
  assert.match(signal, /beat: delphi-markets/);
  assert.match(signal, /tags: gensyn, markets/);
  assert.match(signal, /sources:\n- https:\/\/delphi\.gensyn\.ai\//);
  assert.match(signal, /analysis:\nVolume increased/);
});

test("formatSignal requires at least one valid source URL", () => {
  assert.throws(
    () =>
      formatSignal({
        headline: "Unsourced claim",
        beat: "openagents",
        sources: [],
        tags: [],
        confidence: "low",
      }),
    /at least one source/,
  );

  assert.throws(
    () =>
      formatSignal({
        headline: "Bad source",
        beat: "openagents",
        sources: ["not a url"],
        tags: [],
        confidence: "low",
      }),
    /invalid source URL/,
  );
});
