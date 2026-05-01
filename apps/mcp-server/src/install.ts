import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

export interface InstallOptions {
  desktop?: boolean;
}

export async function runInstall(opts: InstallOptions): Promise<void> {
  const target = opts.desktop ? resolveDesktopConfig() : resolveCodeConfig();
  const label = opts.desktop ? "Claude Desktop" : "Claude Code";
  process.stdout.write(`Configuring ${label} → ${displayPath(target)}\n`);

  let config: Record<string, unknown> = {};
  if (existsSync(target)) {
    try {
      config = JSON.parse(readFileSync(target, "utf8"));
    } catch (err) {
      process.stderr.write(
        `Failed to parse existing config at ${target}: ${(err as Error).message}\n`,
      );
      process.exit(1);
    }
  } else {
    mkdirSync(dirname(target), { recursive: true });
  }

  const mcpServers = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
  mcpServers.polis = {
    command: "npx",
    args: ["-y", "polis-mcp-server@latest"],
  };
  config.mcpServers = mcpServers;

  writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);

  process.stdout.write("Polis MCP server registered.\n\n");
  process.stdout.write(
    opts.desktop
      ? "Restart Claude Desktop to pick up the change.\n"
      : "Restart your Claude Code session.\n",
  );
  process.stdout.write("\nThe `polis` CLI must be on PATH. Install with:\n");
  process.stdout.write("  npm install -g polis-network\n");
}

function resolveCodeConfig(): string {
  return join(homedir(), ".claude.json");
}

function resolveDesktopConfig(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32":
      return join(process.env.APPDATA ?? home, "Claude", "claude_desktop_config.json");
    default:
      return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

function displayPath(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? path.replace(home, "~") : path;
}
