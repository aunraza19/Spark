export function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (value) => r0 + ((value - d0) * (r1 - r0)) / (d1 - d0);
}

export const PRESSURE_VIEWS = {
  zoomed: [0, 20] as [number, number],
  full: [0, 80] as [number, number],
};

export type PressureView = keyof typeof PRESSURE_VIEWS;

export const MAP = {
  width: 640,
  height: 420,
  margin: { top: 16, right: 16, bottom: 52, left: 60 },
  oxygenDomain: [0, 45] as [number, number],
  markRadius: 4,
};

export type MapSize = { width: number; height: number };

export function mapSize(measuredWidth: number): MapSize {
  if (measuredWidth <= 0) return { width: MAP.width, height: MAP.height };
  const width = Math.round(measuredWidth);
  return { width, height: Math.round(width * (width < 560 ? 1.25 : 0.5)) };
}

export function mapScales(view: PressureView = "full", size: MapSize = { width: MAP.width, height: MAP.height }) {
  const { width, height } = size;
  const { margin, oxygenDomain } = MAP;
  return {
    x: linearScale(PRESSURE_VIEWS[view], [margin.left, width - margin.right]),
    y: linearScale(oxygenDomain, [height - margin.bottom, margin.top]),
  };
}
