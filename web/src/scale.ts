export function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (value) => r0 + ((value - d0) * (r1 - r0)) / (d1 - d0);
}

export const MAP = {
  width: 640,
  height: 420,
  margin: { top: 16, right: 16, bottom: 52, left: 60 },
  pressureDomain: [0, 80] as [number, number],
  oxygenDomain: [0, 45] as [number, number],
  markRadius: 4,
};

export function mapScales() {
  const { width, height, margin, pressureDomain, oxygenDomain } = MAP;
  return {
    x: linearScale(pressureDomain, [margin.left, width - margin.right]),
    y: linearScale(oxygenDomain, [height - margin.bottom, margin.top]),
  };
}
