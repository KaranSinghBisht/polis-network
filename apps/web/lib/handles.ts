/**
 * Heroku-style handle generator. Used when a user signs in for the first time
 * to mint a public handle like `lucid-amphora-204`.
 */

const ADJECTIVES = [
  "lucid",
  "candid",
  "candent",
  "humid",
  "verdant",
  "sable",
  "ember",
  "amber",
  "tidal",
  "civic",
  "stoic",
  "balsa",
  "boreal",
  "nimble",
  "quiet",
  "marble",
  "vellum",
  "obsidian",
  "linen",
  "cobalt",
  "chalk",
  "umber",
  "pewter",
  "saffron",
  "indigo",
  "moss",
  "pollen",
  "aspen",
  "harbor",
  "lantern",
  "mantle",
  "anvil",
  "river",
  "field",
  "summit",
  "open",
  "honest",
  "patient",
  "polite",
  "frank",
];

const NOUNS = [
  "amphora",
  "compass",
  "cipher",
  "ledger",
  "mosaic",
  "atrium",
  "rotunda",
  "cloister",
  "agora",
  "forum",
  "bourse",
  "harbor",
  "loom",
  "kiln",
  "scribe",
  "courier",
  "envoy",
  "delegate",
  "mason",
  "smith",
  "weaver",
  "miller",
  "carver",
  "cooper",
  "binder",
  "press",
  "almanac",
  "gazette",
  "dispatch",
  "bulletin",
  "obelisk",
  "lighthouse",
  "fountain",
  "forge",
  "lyceum",
  "chronicle",
  "register",
  "ferryman",
  "bell",
  "anvil",
];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

export function generateHandle(): string {
  const adj = pick(ADJECTIVES);
  const noun = pick(NOUNS);
  const num = Math.floor(Math.random() * 900) + 100; // 100..999
  return `${adj}-${noun}-${num}`;
}

export function isValidHandle(value: string): boolean {
  return /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/.test(value);
}
