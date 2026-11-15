import { useEffect, useState } from "react";
import {
  fetchHabitats,
  fetchMapSnapshot,
  fetchPoints,
  fetchReportConditions,
  type Habitat,
  type MapSnapshot,
  type Point,
  type ReportCondition,
  type Selection,
} from "./api";
import { AtmosphereMap } from "./AtmosphereMap";
import { HabitatSelector } from "./HabitatSelector";
import { MapSummary } from "./MapSummary";

type Loaded = { habitats: Habitat[]; points: Point[]; reports: ReportCondition[] };

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [selection, setSelection] = useState<Selection>({ habitatId: "lunar" });
  const [snapshot, setSnapshot] = useState<MapSnapshot | null>(null);

  useEffect(() => {
    Promise.all([fetchHabitats(), fetchPoints(), fetchReportConditions()])
      .then(([habitats, points, reports]) => setLoaded({ habitats, points, reports }))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    let current = true;
    setSnapshot(null);
    fetchMapSnapshot(selection)
      .then((result) => current && setSnapshot(result.snapshot))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [selection]);

  const target: Habitat | null =
    selection.habitatId === "custom" && selection.custom
      ? { id: "custom", label: "Custom", kind: "point", o2_pct: selection.custom.o2, pressure_psi: selection.custom.psi, source: "Your input" }
      : (loaded?.habitats.find((h) => h.id === selection.habitatId) ?? null);

  return (
    <main className="page">
      <h1>Flame in Freefall</h1>
      {failed && <p role="alert" className="error">Could not load the data. Is the API running?</p>}
      {loaded && (
        <>
          <HabitatSelector habitats={loaded.habitats} selection={selection} onChange={setSelection} />
          <section aria-labelledby="map-heading">
            <h2 id="map-heading">Atmosphere map</h2>
            <AtmosphereMap points={loaded.points} reportConditions={loaded.reports} habitat={target} />
            <MapSummary snapshot={snapshot} />
            <p data-testid="sources" className="sources">
              Sources: {loaded.points.length} test points from the PSI test tables (data/clean/test_points.json).{" "}
              {loaded.reports.length} report condition{loaded.reports.length === 1 ? "" : "s"} from{" "}
              {[...new Set(loaded.reports.map((r) => r.source.file))].join(", ")} (data/reference/report_conditions.json).
            </p>
          </section>
        </>
      )}
    </main>
  );
}
