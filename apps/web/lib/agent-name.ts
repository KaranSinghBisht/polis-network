const DEFAULT_PARENT = "polis-agent.eth";

export function defaultEnsParentName(): string {
  return normalizeEnsName(process.env.POLIS_ENS_PARENT_NAME ?? DEFAULT_PARENT);
}

export function normalizeRequestedAgentName(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw) throw new Error("agent ENS name is empty");
  const parent = defaultEnsParentName();
  const fullName = normalizeEnsName(raw.includes(".") ? raw : `${raw}.${parent}`);
  if (!fullName.endsWith(`.${parent}`)) {
    throw new Error(`agent ENS name must be a subname under ${parent}`);
  }
  return fullName;
}

export function normalizeEnsName(input: string): string {
  const name = input.trim().toLowerCase();
  if (!name.endsWith(".eth")) {
    throw new Error("agent ENS name must end in .eth");
  }
  const labels = name.split(".");
  if (labels.length < 2 || labels.at(-1) !== "eth") {
    throw new Error("invalid ENS name");
  }
  for (const label of labels.slice(0, -1)) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
      throw new Error(
        "ENS labels must use lowercase letters, numbers, or hyphens and cannot start/end with a hyphen",
      );
    }
  }
  return name;
}
