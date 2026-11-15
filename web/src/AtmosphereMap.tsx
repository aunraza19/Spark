import type { Habitat, Point, ReportCondition } from "./api";
import { formatNumber, formatRange } from "./format";
import { MAP, mapScales } from "./scale";

type Props = { points: Point[]; reportConditions: ReportCondition[]; habitat: Habitat | null };

const ticks = (domain: [number, number], step: number) => {
  const found: number[] = [];
  for (let v = domain[0]; v <= domain[1]; v += step) found.push(v);
  return found;
};

function PointMark({ point }: { point: Point }) {
  const { x, y } = mapScales();
  const r = MAP.markRadius;
  const ranged = point.o2_pct_min !== point.o2_pct_max || point.pressure_psi_min !== point.pressure_psi_max;
  const fuel = point.fuel_state ?? "unknown";
  const title =
    `${point.experiment_id}${point.test_id ? `, test ${point.test_id}` : ""}: ` +
    `${formatRange(point.o2_pct_min, point.o2_pct_max)} % oxygen, ` +
    `${formatRange(point.pressure_psi_min, point.pressure_psi_max)} psi ` +
    `(${point.fuel_state ?? "fuel state not reported"}). ` +
    `Source: ${point.source_file}, row ${point.source_row}.` +
    (point.pressure_basis === "record" ? " Note: pressure from the experiment record, not the test table." : "");
  const cx = x(point.pressure_psi_min);
  const cy = y(point.o2_pct_min);
  let shape;
  if (ranged) {
    shape = (
      <rect
        data-ranged="true"
        x={x(point.pressure_psi_min) - r}
        y={y(point.o2_pct_max) - r}
        width={x(point.pressure_psi_max) - x(point.pressure_psi_min) + 2 * r}
        height={y(point.o2_pct_min) - y(point.o2_pct_max) + 2 * r}
        rx={r}
      />
    );
  } else if (point.fuel_state === "liquid") {
    shape = <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} />;
  } else if (point.fuel_state === "solid") {
    shape = <polygon points={`${cx},${cy - r - 1} ${cx - r - 1},${cy + r} ${cx + r + 1},${cy + r}`} />;
  } else {
    shape = <circle cx={cx} cy={cy} r={r} />;
  }
  return (
    <g data-testid="point" data-fuel-state={fuel} className={`mark mark-${fuel}`}>
      <title>{title}</title>
      {shape}
    </g>
  );
}

function ReportMark({ condition }: { condition: ReportCondition }) {
  const { x, y } = mapScales();
  const cx = x(condition.pressure_psi_min);
  const cy = y(condition.o2_pct_min);
  const r = MAP.markRadius + 3;
  const { file, page, figure } = condition.source;
  const title =
    `${condition.experiment_id} test ${condition.test_id} (from report): ` +
    `${formatRange(condition.o2_pct_min, condition.o2_pct_max)} % oxygen at ` +
    `${formatRange(condition.pressure_psi_min, condition.pressure_psi_max)} psi, ${condition.outcome}. ` +
    `Source: ${file}, page ${page}, ${figure}.`;
  return (
    <g data-testid="report-condition" className="mark-report">
      <title>{title}</title>
      <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} />
    </g>
  );
}

function HabitatMark({ habitat }: { habitat: Habitat }) {
  const { x, y } = mapScales();
  const cx = x(habitat.pressure_psi ?? 0);
  const cy = y(habitat.o2_pct ?? 0);
  const arm = 9;
  return (
    <g data-testid="habitat-marker" data-x={cx} data-y={cy} className="habitat-marker">
      <title>
        {`${habitat.label}: ${formatNumber(habitat.o2_pct ?? 0)} % oxygen at ${formatNumber(habitat.pressure_psi ?? 0)} psi. Source: ${habitat.source}`}
      </title>
      <line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} />
      <line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} />
      <circle cx={cx} cy={cy} r={arm - 3} fill="none" />
    </g>
  );
}

function Legend({ zone }: { zone: boolean }) {
  return (
    <ul aria-label="Legend" className="legend">
      <li><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" className="mark-gas legend-mark" /></svg> Gas</li>
      <li><svg width="14" height="14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" className="mark-liquid legend-mark" /></svg> Liquid</li>
      <li><svg width="14" height="14" aria-hidden="true"><polygon points="7,1 1,12 13,12" className="mark-solid legend-mark" /></svg> Solid</li>
      <li><svg width="14" height="14" aria-hidden="true"><polygon points="7,1 13,7 7,13 1,7" className="mark-report legend-report" /></svg> Report condition (from a PSI report, not a test table)</li>
      {zone ? <li><span className="legend-zone" aria-hidden="true" /> Target zone</li> : <li>+ Target point</li>}
    </ul>
  );
}

export function AtmosphereMap({ points, reportConditions, habitat }: Props) {
  const { x, y } = mapScales();
  const { width, height, margin, pressureDomain, oxygenDomain } = MAP;
  const zone = habitat?.kind === "zone" ? habitat : null;
  return (
    <figure className="map">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Oxygen against pressure: one mark for each ambient test point"
      >
        {ticks(pressureDomain, 10).map((v) => (
          <g key={`x${v}`} className="tick">
            <line x1={x(v)} y1={margin.top} x2={x(v)} y2={height - margin.bottom} />
            <text x={x(v)} y={height - margin.bottom + 16} textAnchor="middle">{v}</text>
          </g>
        ))}
        {ticks(oxygenDomain, 10).map((v) => (
          <g key={`y${v}`} className="tick">
            <line x1={margin.left} y1={y(v)} x2={width - margin.right} y2={y(v)} />
            <text x={margin.left - 8} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        <text x={(margin.left + width - margin.right) / 2} y={height - 8} textAnchor="middle" className="axis-title">Pressure (psi)</text>
        <text transform={`translate(14 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">Oxygen (% by volume)</text>
        {zone && (
          <rect
            data-testid="zone"
            data-o2-min={zone.o2_pct_min}
            data-psi-max={zone.pressure_psi_max}
            className="zone"
            x={x(0)}
            y={y(oxygenDomain[1])}
            width={x(zone.pressure_psi_max ?? 0) - x(0)}
            height={y(zone.o2_pct_min ?? 0) - y(oxygenDomain[1])}
          >
            <title>{`${zone.label}: oxygen at least ${formatNumber(zone.o2_pct_min ?? 0)} % and pressure at most ${formatNumber(zone.pressure_psi_max ?? 0)} psi. Source: ${zone.source}`}</title>
          </rect>
        )}
        {points.map((p) => (
          <PointMark key={`${p.source_file}:${p.source_row}`} point={p} />
        ))}
        {reportConditions.map((c) => (
          <ReportMark key={`${c.experiment_id}:${c.test_id}`} condition={c} />
        ))}
        {habitat && habitat.kind === "point" && <HabitatMark habitat={habitat} />}
      </svg>
      <Legend zone={zone !== null} />
    </figure>
  );
}
