import { useEffect, useRef, useState } from "react";
import type { Habitat, Preset, Selection } from "./api";
import { formatNumber } from "./format";

type Props = {
  habitats: Habitat[];
  selection: Selection;
  onChange: (selection: Selection) => void;
  presets?: Preset[];
};

function describe(habitat: Habitat): string {
  if (habitat.kind === "zone") {
    return `${habitat.label}: oxygen at least ${formatNumber(habitat.o2_pct_min ?? 0)} % and pressure at most ${formatNumber(habitat.pressure_psi_max ?? 0)} psi. Source: ${habitat.source}`;
  }
  return `${habitat.label}: oxygen ${formatNumber(habitat.o2_pct ?? 0)} % at ${formatNumber(habitat.pressure_psi ?? 0)} psi. Source: ${habitat.source}`;
}

function check(o2Text: string, psiText: string): { o2: number; psi: number } | string {
  const o2 = o2Text.trim() === "" ? NaN : Number(o2Text);
  const psi = psiText.trim() === "" ? NaN : Number(psiText);
  if (!Number.isFinite(o2) || o2 <= 0 || o2 > 100) return "Oxygen must be above 0 and at most 100 %.";
  if (!Number.isFinite(psi) || psi <= 0) return "Pressure must be above 0 psi.";
  return { o2, psi };
}

export function HabitatSelector({ habitats, selection, onChange, presets = [] }: Props) {
  const choices = habitats.filter((h) => h.kind !== "note");
  const notes = habitats.filter((h) => h.kind === "note");
  const [o2Text, setO2Text] = useState(String(selection.custom?.o2 ?? ""));
  const [psiText, setPsiText] = useState(String(selection.custom?.psi ?? ""));
  const [error, setError] = useState<string | null>(null);
  const lastCustom = useRef(selection.custom);
  const isCustom = selection.habitatId === "custom";
  const chosen = choices.find((h) => h.id === selection.habitatId);

  useEffect(() => {
    const custom = selection.custom;
    if (!custom) return;
    if (Number(o2Text) !== custom.o2) setO2Text(String(custom.o2));
    if (Number(psiText) !== custom.psi) setPsiText(String(custom.psi));
  }, [selection.custom?.o2, selection.custom?.psi]);

  const pickCustom = () => {
    const start = lastCustom.current ?? firstPoint(choices);
    if (!start) return;
    setO2Text(String(start.o2));
    setPsiText(String(start.psi));
    setError(null);
    onChange({ habitatId: "custom", custom: start });
  };

  const edit = (nextO2: string, nextPsi: string) => {
    setO2Text(nextO2);
    setPsiText(nextPsi);
    const result = check(nextO2, nextPsi);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setError(null);
    lastCustom.current = result;
    onChange({ habitatId: "custom", custom: result });
  };

  return (
    <section aria-labelledby="habitat-heading" className="habitat">
      <h3 id="habitat-heading">Habitat</h3>
      <fieldset>
        <legend>Which atmosphere do you want to compare with the tests?</legend>
        {choices.map((h) => (
          <label key={h.id} className="choice" title={`Source: ${h.source}`}>
            <input
              type="radio"
              name="habitat"
              checked={selection.habitatId === h.id}
              onChange={() => onChange({ habitatId: h.id })}
            />
            {h.label}
          </label>
        ))}
        <label className="choice" title="Your own oxygen and pressure">
          <input type="radio" name="habitat" checked={isCustom} onChange={pickCustom} />
          Custom
        </label>
      </fieldset>
      {presets.length > 0 && (
        <div className="presets">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="button"
              title={`Source: ${preset.source}`}
              aria-pressed={isCustom && selection.custom?.o2 === preset.o2 && selection.custom?.psi === preset.psi}
              onClick={() => onChange({ habitatId: "custom", custom: { o2: preset.o2, psi: preset.psi } })}
            >
              {`${preset.label} (${formatNumber(preset.o2)} %, ${formatNumber(preset.psi)} psi)`}
            </button>
          ))}
        </div>
      )}
      {isCustom && (
        <div className="custom-fields">
          <label>
            Oxygen (%)
            <input type="number" step="any" value={o2Text} onChange={(e) => edit(e.target.value, psiText)} />
          </label>
          <label>
            Pressure (psi)
            <input type="number" step="any" value={psiText} onChange={(e) => edit(o2Text, e.target.value)} />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      )}
      <p data-testid="habitat-description" className="description">
        {chosen
          ? describe(chosen)
          : selection.custom
            ? `Custom: oxygen ${formatNumber(selection.custom.o2)} % at ${formatNumber(selection.custom.psi)} psi. Source: your input.`
            : ""}
      </p>
      {notes.map((n) => (
        <p key={n.id} className="note">
          {n.label}: {formatNumber(n.o2_pct ?? 0)} % oxygen at {formatNumber(n.pressure_psi ?? 0)} psi. Note only, off the chart. Source: {n.source}
        </p>
      ))}
    </section>
  );
}

function firstPoint(choices: Habitat[]): { o2: number; psi: number } | null {
  const point = choices.find((h) => h.kind === "point");
  return point ? { o2: point.o2_pct ?? 0, psi: point.pressure_psi ?? 0 } : null;
}
