import type { BlockSpec } from "./api";
import raw from "./starters.txt?raw";

const byKind: Record<string, string[]> = {};
for (const line of raw.split(/\r?\n/)) {
  const match = /^(\w+): (.+)$/.exec(line);
  if (match) (byKind[match[1]] ??= []).push(match[2]);
}

export const startersFor = (block: BlockSpec): string[] => byKind[block.kind] ?? [];
