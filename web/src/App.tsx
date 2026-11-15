import { useEffect, useState } from "react";
import {
  fetchAbout,
  fetchHabitats,
  fetchMapSnapshot,
  fetchPoints,
  fetchReportConditions,
  fetchScenarioSnapshot,
  type About,
  type CardRequest,
  type Habitat,
  type MapSnapshot,
  type Point,
  type Preset,
  type ReportCondition,
  type ScenarioSnapshot,
  type Selection,
  type Summary,
} from "./api";
import { AboutFooter } from "./AboutFooter";
import { AboutFooterLoader } from "./AboutFooterLoader";
import { AtmosphereMap } from "./AtmosphereMap";
import { DataSaysCard } from "./DataSaysCard";
import { ExperimentList } from "./ExperimentList";
import { ExperimentPage } from "./ExperimentPage";
import { HabitatSelector } from "./HabitatSelector";
import { Hero } from "./Hero";
import { KnowDontKnow } from "./KnowDontKnow";
import { MapSummary } from "./MapSummary";
import { PointCard } from "./PointCard";
import { RankedList } from "./RankedList";
import { useRoute } from "./route";
import { PRESSURE_VIEWS } from "./scale";
import { ScenarioPanel } from "./ScenarioPanel";
import { ThreeLines } from "./ThreeLines";
import { hiddenCounts, needsFullRange, viewNote } from "./view";

type Loaded = { habitats: Habitat[]; points: Point[]; reports: ReportCondition[] };

function presetsFrom(reports: ReportCondition[]): Preset[] {
  return reports
    .filter((r) => r.preset_label && r.o2_pct_min === r.o2_pct_max && r.pressure_psi_min === r.pressure_psi_max)
    .map((r) => ({
      label: r.preset_label as string,
      o2: r.o2_pct_min,
      psi: r.pressure_psi_min,
      source: `${r.source.file}, page ${r.source.page}, ${r.source.figure}`,
    }));
}

function Home() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [about, setAbout] = useState<About | null>(null);
  const [aboutFailed, setAboutFailed] = useState(false);
  const [selection, setSelection] = useState<Selection>({ habitatId: "lunar" });
  const [snapshot, setSnapshot] = useState<MapSnapshot | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chosen, setChosen] = useState<CardRequest | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [scenario, setScenario] = useState<ScenarioSnapshot | null>(null);
  const [scenarioFailed, setScenarioFailed] = useState(false);

  useEffect(() => {
    Promise.all([fetchHabitats(), fetchPoints(), fetchReportConditions()])
      .then(([habitats, points, reports]) => setLoaded({ habitats, points, reports }))
      .catch(() => setFailed(true));
    fetchAbout()
      .then(setAbout)
      .catch(() => setAboutFailed(true));
  }, []);

  useEffect(() => {
    setScenario(null);
    setScenarioFailed(false);
    if (selection.habitatId !== "custom" || !selection.custom) return;
    let current = true;
    fetchScenarioSnapshot(selection.custom)
      .then((result) => current && setScenario(result.snapshot))
      .catch(() => current && setScenarioFailed(true));
    return () => {
      current = false;
    };
  }, [selection]);

  const target: Habitat | null =
    selection.habitatId === "custom" && selection.custom
      ? { id: "custom", label: "Custom", kind: "point", o2_pct: selection.custom.o2, pressure_psi: selection.custom.psi, source: "Your input" }
      : (loaded?.habitats.find((h) => h.id === selection.habitatId) ?? null);

  const forced = needsFullRange(target);
  const view = showAll || forced ? "full" : "zoomed";
  const note = loaded ? viewNote(hiddenCounts(loaded.points, loaded.reports, view), view, forced) : "";

  useEffect(() => {
    let current = true;
    setSnapshot(null);
    setSummary(null);
    fetchMapSnapshot(selection, PRESSURE_VIEWS[view][1])
      .then((result) => {
        if (!current) return;
        setSnapshot(result.snapshot);
        setSummary(result.summary ?? null);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [selection, view]);

  return (
    <>
      <main className="page">
        <Hero />
        {failed && <p role="alert" className="error">Could not load the data. Is the API running?</p>}
        <ThreeLines />
        {loaded && (
          <section aria-labelledby="explore-heading" className="explore">
            <h2 id="explore-heading">Explore the tests</h2>
            <HabitatSelector
              habitats={loaded.habitats}
              selection={selection}
              onChange={setSelection}
              presets={presetsFrom(loaded.reports)}
            />
            <DataSaysCard summary={summary}>
              <MapSummary snapshot={snapshot} viewNote={note} />
              {selection.habitatId === "custom" && selection.custom && (
                <ScenarioPanel snapshot={scenario} failed={scenarioFailed} />
              )}
            </DataSaysCard>
            <section aria-labelledby="map-heading">
              <h3 id="map-heading">Atmosphere map</h3>
              <div className="view-control">
                <label>
                  <input
                    type="checkbox"
                    checked={view === "full"}
                    disabled={forced}
                    onChange={(e) => setShowAll(e.target.checked)}
                  />
                  Show the full pressure range
                </label>
                <span data-testid="view-note" className="view-note">{note}</span>
              </div>
              <AtmosphereMap
                points={loaded.points}
                reportConditions={loaded.reports}
                habitat={target}
                view={view}
                references={loaded.habitats}
                onSelect={setChosen}
              />
            </section>
            {chosen && <PointCard key={JSON.stringify(chosen)} request={chosen} onClose={() => setChosen(null)} />}
            <RankedList selection={selection} />
          </section>
        )}
        {loaded && <KnowDontKnow summary={summary} />}
      </main>
      <AboutFooter about={about} failed={aboutFailed}>
        {loaded && (
          <p data-testid="sources" className="sources">
            Sources: {loaded.points.length} test points from the PSI test tables (data/clean/test_points.json).{" "}
            {loaded.reports.length} report condition{loaded.reports.length === 1 ? "" : "s"} from{" "}
            {[...new Set(loaded.reports.map((r) => r.source.file))].join(", ")} (data/reference/report_conditions.json).
          </p>
        )}
      </AboutFooter>
    </>
  );
}

export default function App() {
  const route = useRoute();
  if (route.kind === "experiment") {
    return (
      <>
        <ExperimentPage id={route.id} />
        <AboutFooterLoader />
      </>
    );
  }
  if (route.kind === "experiments") {
    return (
      <>
        <ExperimentList />
        <AboutFooterLoader />
      </>
    );
  }
  return <Home />;
}
