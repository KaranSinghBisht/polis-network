import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export interface PolisResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const require = createRequire(import.meta.url);

function resolvePolisCommand(): { command: string; argsPrefix: string[]; installHint: string } {
  if (process.env.POLIS_CLI_BIN) {
    return {
      command: process.env.POLIS_CLI_BIN,
      argsPrefix: [],
      installHint: `POLIS_CLI_BIN=${process.env.POLIS_CLI_BIN}`,
    };
  }
  try {
    const pkgPath = require.resolve("polis-network/package.json");
    const binPath = join(dirname(pkgPath), "dist", "index.js");
    if (!existsSync(binPath)) throw new Error("polis-network dist/index.js not built");
    return {
      command: process.execPath,
      argsPrefix: [binPath],
      installHint: "bundled polis-network dependency",
    };
  } catch {
    return {
      command: "polis",
      argsPrefix: [],
      installHint: `"polis" on PATH (install with "npm install -g polis-network")`,
    };
  }
}

/**
 * Spawn the `polis` CLI binary as a subprocess, capturing stdout + stderr.
 * The MCP host's stdout is reserved for JSON-RPC, so we never let polis
 * write to the parent process's stdout directly.
 */
export async function spawnPolis(
  args: string[],
  env: Record<string, string | undefined> = {},
): Promise<PolisResult> {
  return new Promise((resolve) => {
    const command = resolvePolisCommand();
    const child = spawn(command.command, [...command.argsPrefix, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (err) => {
      resolve({
        ok: false,
        stdout: "",
        stderr: `spawn error: ${err.message}\nExpected ${command.installHint}.`,
        exitCode: null,
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: code,
      });
    });
  });
}
