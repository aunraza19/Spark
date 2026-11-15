import type { BlockSpec, Habitat } from "./api";
import { formatNumber } from "./format";

const target = (o2: number, psi: number) => `your target (${formatNumber(o2)} % oxygen, ${formatNumber(psi)} psi)`;

function habitatName(block: { habitat: string; o2?: number; psi?: number }, habitats: Habitat[]): string {
  if (block.habitat === "custom") return target(block.o2 ?? 0, block.psi ?? 0);
  const found = habitats.find((h) => h.id === block.habitat);
  return found ? (found.short_name ?? found.label) : block.habitat;
}

/** One plain phrase for what the chat is about, shown at the top of the panel. */
export function describeBlock(block: BlockSpec, habitats: Habitat[]): string {
  switch (block.kind) {
    case "map":
      return `${habitatName(block, habitats)} map`;
    case "scenario":
      return target(block.o2, block.psi);
    case "ranking":
      return `the ranked list for ${habitatName(block, habitats)}`;
    case "experiment":
      return `experiment ${block.experiment_id}`;
  }
}
