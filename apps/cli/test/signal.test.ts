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

test("formatSignal accepts 0G archive source URLs", () => {
  const root = "0g://0x71572d237316965aba06fc7aa4c7385b42974497af7b0de9780b4470780e5216";
  const signal = formatSignal({
    headline: "Archived TownMessage can be cited as source material",
    beat: "zero-g-storage",
    sources: [root],
    tags: ["archive"],
    confidence: "high",
  });

  assert.match(signal, new RegExp(`sources:\\n- ${root}`));
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
