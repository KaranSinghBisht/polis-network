import { spawn } from "node:child_process";

export interface PolisResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
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
    const child = spawn("polis", args, {
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
        stderr: `spawn error: ${err.message}\n(is "polis" on PATH? install with "npm install -g polis-network")`,
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
