import { useEffect, useRef, useState, type KeyboardEvent, type SVGProps } from "react";
import type { CardRequest, Habitat, Point, ReportCondition } from "./api";
import { formatNumber, formatRange } from "./format";
import { MAP, mapScales, mapSize, PRESSURE_VIEWS, type PressureView } from "./scale";
import { isVisible } from "./view";

type Props = {
  points: Point[];
  reportConditions: ReportCondition[];
  habitat: Habitat | null;
  view?: PressureView;
  onSelect?: (request: CardRequest) => void;
  references?: Habitat[];
};

type MarkProps = SVGProps<SVGGElement> & { "data-key"?: string };
type Scales = ReturnType<typeof mapScales>;
type Target = { key: string; pressure: number; o2: number; request: CardRequest };

const STEP: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i) => i + 1,
  ArrowDown: (i) => i + 1,
  ArrowLeft: (i) => i - 1,
  ArrowUp: (i) => i - 1,
  Home: () => 0,
  End: (_i, count) => count - 1,
};

const LINE = 18;

const ticks = (domain: [number, number], step: number) => {
  const found: number[] = [];
  for (let v = domain[0]; v <= domain[1]; v += step) found.push(v);
  return found;
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function Label({ cx, cy, offset, width, text }: { cx: number; cy: number; offset: number; width: number; text: string }) {
  const right = cx > width * 0.85;
  return (
    <text className="chart-label" x={right ? cx - offset : cx + offset} y={cy} dy="0.32em" textAnchor={right ? "end" : "start"}>
      {text}
    </text>
  );
}

function PointMark({ point, scales, mark }: { point: Point; scales: Scales; mark?: MarkProps }) {
  const { x, y } = scales;
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
    const t = r + 2;
    shape = <polygon points={`${cx},${cy - t - 1} ${cx - t - 1},${cy + t} ${cx + t + 1},${cy + t}`} />;
  } else {
    shape = <circle cx={cx} cy={cy} r={r} />;
  }
  return (
    <g data-testid="point" data-fuel-state={fuel} className={`mark mark-${fuel}`} {...mark} aria-label={mark && title}>
      <title>{title}</title>
      {shape}
    </g>
  );
}

function ReportMark({
  condition,
  scales,
  width,
  hideLabel,
  mark,
}: {
  condition: ReportCondition;
  scales: Scales;
  width: number;
  hideLabel?: boolean;
  mark?: MarkProps;
}) {
  const { x, y } = scales;
  const cx = x(condition.pressure_psi_min);
  const cy = y(condition.o2_pct_min);
  const r = MAP.markRadius + 2;
  const { file, page, figure } = condition.source;
  const title =
    `${condition.experiment_id} test ${condition.test_id} (from report): ` +
    `${formatRange(condition.o2_pct_min, condition.o2_pct_max)} % oxygen at ` +
    `${formatRange(condition.pressure_psi_min, condition.pressure_psi_max)} psi, ${condition.outcome}. ` +
    `Source: ${file}, page ${page}, ${figure}.`;
  return (
    <g data-testid="report-condition" className="mark-report" {...mark} aria-label={mark && title}>
      <title>{title}</title>
      <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} />
      {condition.preset_label && !hideLabel && <Label cx={cx} cy={cy} offset={r + 6} width={width} text={condition.preset_label} />}
    </g>
  );
}

function HabitatMark({ habitat, scales, width, label }: { habitat: Habitat; scales: Scales; width: number; label?: string }) {
  const { x, y } = scales;
  const cx = x(habitat.pressure_psi ?? 0);
  const cy = y(habitat.o2_pct ?? 0);
  const arm = 14;
  return (
    <g data-testid="habitat-marker" data-x={cx} data-y={cy} className="habitat-marker">
      <title>
        {`${habitat.label}: ${formatNumber(habitat.o2_pct ?? 0)} % oxygen at ${formatNumber(habitat.pressure_psi ?? 0)} psi. Source: ${habitat.source}`}
      </title>
      <line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} />
      <line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} />
      <circle cx={cx} cy={cy} r={arm - 6} fill="none" />
      <Label cx={cx} cy={cy} offset={arm + 6} width={width} text={label ?? (habitat.id === "custom" ? "Your target" : habitat.label)} />
    </g>
  );
}

function ReferenceMark({ habitat, scales, width }: { habitat: Habitat; scales: Scales; width: number }) {
  const { x, y } = scales;
  const cx = x(habitat.pressure_psi ?? 0);
  const cy = y(habitat.o2_pct ?? 0);
  const arm = 6;
  return (
    <g data-testid="reference-marker" className="reference-marker">
      <title>
        {`${habitat.label}: ${formatNumber(habitat.o2_pct ?? 0)} % oxygen at ${formatNumber(habitat.pressure_psi ?? 0)} psi. Source: ${habitat.source}`}
      </title>
      <line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} />
      <line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} />
      <Label cx={cx} cy={cy} offset={arm + 6} width={width} text={habitat.label} />
    </g>
  );
}

function Legend({ zone }: { zone: boolean }) {
  return (
    <ul aria-label="Legend" className="legend">
      <li><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" className="mark-gas legend-mark" /></svg> Gas (circle)</li>
      <li><svg width="14" height="14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" className="mark-liquid legend-mark" /></svg> Liquid (square)</li>
      <li><svg width="14" height="14" aria-hidden="true"><polygon points="7,1 1,12 13,12" className="mark-solid legend-mark" /></svg> Solid (black triangle)</li>
      <li><svg width="14" height="14" aria-hidden="true"><polygon points="7,1 13,7 7,13 1,7" className="mark-report legend-report" /></svg> Report condition (diamond): from a PSI report, not a test table</li>
      {zone ? <li><span className="legend-zone" aria-hidden="true" /> Target zone</li> : <li>+ Target point</li>}
    </ul>
  );
}

export function AtmosphereMap({ points, reportConditions, habitat, view = "full", onSelect, references = [] }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const figure = useRef<HTMLElement>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    const element = figure.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setMeasured(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const size = mapSize(measured);
  const scales = mapScales(view, size);
  const { x, y } = scales;
  const shownPoints = points.filter((p) => isVisible(p.pressure_psi_max, view));
  const shownReports = reportConditions.filter((c) => isVisible(c.pressure_psi_max, view));
  const targets: Target[] = [
    ...shownPoints.map((p) => ({
      key: `point:${p.source_file}:${p.source_row}`,
      pressure: p.pressure_psi_min,
      o2: p.o2_pct_min,
      request: { source_file: p.source_file, source_row: p.source_row },
    })),
    ...shownReports.map((c) => ({
      key: `report:${c.experiment_id}:${c.test_id}`,
      pressure: c.pressure_psi_min,
      o2: c.o2_pct_min,
      request: { experiment_id: c.experiment_id, test_id: c.test_id },
    })),
  ].sort((a, b) => a.pressure - b.pressure || a.o2 - b.o2 || a.key.localeCompare(b.key));
  const tabStop = targets.some((t) => t.key === activeKey) ? activeKey : targets[0]?.key;

  const focusMark = (key: string) => {
    setActiveKey(key);
    [...(svg.current?.querySelectorAll<SVGGElement>("[data-key]") ?? [])].find((el) => el.getAttribute("data-key") === key)?.focus();
  };

  const interactive = (target: Target): MarkProps | undefined => {
    if (!onSelect) return undefined;
    return {
      role: "button",
      tabIndex: target.key === tabStop ? 0 : -1,
      "data-key": target.key,
      onClick: () => onSelect(target.request),
      onFocus: () => setActiveKey(target.key),
      onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(target.request);
        } else if (STEP[event.key]) {
          event.preventDefault();
          const next = STEP[event.key](targets.indexOf(target), targets.length);
          focusMark(targets[Math.max(0, Math.min(targets.length - 1, next))].key);
        }
      },
    };
  };
  const byKey = new Map(targets.map((t) => [t.key, t]));
  const targetOf = (key: string) => byKey.get(key) as Target;

  const pressureDomain = PRESSURE_VIEWS[view];
  const { width, height } = size;
  const { margin, oxygenDomain } = MAP;
  const zone = habitat?.kind === "zone" ? habitat : null;
  const o2Limit = `${formatNumber(zone?.o2_pct_min ?? 0)} % oxygen`;
  const psiLimit = `${formatNumber(zone?.pressure_psi_max ?? 0)} psi`;
  const zoneLines = zone
    ? [
        capital(zone.short_name ?? zone.label),
        ...(width < 560 ? [o2Limit, "or more", psiLimit, "or less"] : [`${o2Limit} or more`, `${psiLimit} or less`]),
      ]
    : [];
  const zoneBottom = y(zone?.o2_pct_min ?? 0);
  const onPreset =
    habitat?.id === "custom"
      ? shownReports.find(
          (c) =>
            c.preset_label &&
            Math.abs(c.o2_pct_min - (habitat.o2_pct ?? 0)) < 0.005 &&
            Math.abs(c.pressure_psi_min - (habitat.pressure_psi ?? 0)) < 0.005,
        )
      : undefined;
  const otherPoints = references.filter((h) => h.kind === "point" && h.id !== habitat?.id);

  return (
    <figure className="map" ref={figure}>
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Oxygen against pressure: one mark for each ambient test point"
      >
        {ticks(pressureDomain, view === "zoomed" ? 5 : 10).map((v) => (
          <g key={`x${v}`} className="tick">
            <line x1={x(v)} y1={margin.top} x2={x(v)} y2={height - margin.bottom} />
            <text x={x(v)} y={height - margin.bottom + 20} textAnchor="middle">{v}</text>
          </g>
        ))}
        {ticks(oxygenDomain, 10).map((v) => (
          <g key={`y${v}`} className="tick">
            <line x1={margin.left} y1={y(v)} x2={width - margin.right} y2={y(v)} />
            <text x={margin.left - 8} y={y(v) + 5} textAnchor="end">{v}</text>
          </g>
        ))}
        <text x={(margin.left + width - margin.right) / 2} y={height - 8} textAnchor="middle" className="axis-title">Pressure (psi)</text>
        <text transform={`translate(14 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">Oxygen (% by volume)</text>
        {zone && (
          <>
            <rect
              data-testid="zone"
              data-o2-min={zone.o2_pct_min}
              data-psi-max={zone.pressure_psi_max}
              className="zone"
              x={x(0)}
              y={y(oxygenDomain[1])}
              width={x(zone.pressure_psi_max ?? 0) - x(0)}
              height={zoneBottom - y(oxygenDomain[1])}
            >
              <title>{`${zone.label}: oxygen at least ${formatNumber(zone.o2_pct_min ?? 0)} % and pressure at most ${formatNumber(zone.pressure_psi_max ?? 0)} psi. Source: ${zone.source}`}</title>
            </rect>
            <text data-testid="zone-label" className="zone-label" x={x(0) + 8} y={zoneBottom - 8 - LINE * (zoneLines.length - 1)}>
              {zoneLines.map((line, i) => (
                <tspan key={line} x={x(0) + 8} dy={i === 0 ? 0 : LINE} className={i === 0 ? "zone-name" : undefined}>
                  {line}
                </tspan>
              ))}
            </text>
          </>
        )}
        {[...shownPoints.filter((p) => p.fuel_state !== "solid"), ...shownPoints.filter((p) => p.fuel_state === "solid")].map((p) => {
          const key = `point:${p.source_file}:${p.source_row}`;
          return <PointMark key={key} point={p} scales={scales} mark={interactive(targetOf(key))} />;
        })}
        {shownReports.map((c) => {
          const key = `report:${c.experiment_id}:${c.test_id}`;
          return (
            <ReportMark
              key={key}
              condition={c}
              scales={scales}
              width={width}
              hideLabel={c === onPreset}
              mark={interactive(targetOf(key))}
            />
          );
        })}
        {otherPoints.map((h) => (
          <ReferenceMark key={h.id} habitat={h} scales={scales} width={width} />
        ))}
        {habitat && habitat.kind === "point" && (
          <HabitatMark habitat={habitat} scales={scales} width={width} label={onPreset?.preset_label} />
        )}
      </svg>
      {onSelect && <p className="map-hint">Click a mark, or press Tab and use the arrow keys, then Enter.</p>}
      <Legend zone={zone !== null} />
    </figure>
  );
}
