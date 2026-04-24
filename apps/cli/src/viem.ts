import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Account,
  type Chain,
  type HttpTransport,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PolisConfig } from "./config.js";

export function buildChain(cfg: PolisConfig): Chain {
  return defineChain({
    id: cfg.chainId,
    name: cfg.network === "mainnet" ? "Gensyn Mainnet" : "Gensyn Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
}

export interface Clients {
  account: Account;
  chain: Chain;
  publicClient: PublicClient<HttpTransport, Chain>;
  walletClient: WalletClient<HttpTransport, Chain, Account>;
}

export function buildClients(cfg: PolisConfig): Clients {
  const account = privateKeyToAccount(cfg.privateKey);
  const chain = buildChain(cfg);
  const transport = http(cfg.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  return { account, chain, publicClient, walletClient };
}
