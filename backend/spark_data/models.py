from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class Experiment(BaseModel):
    """One PSI experiment record. All keys are required; null is allowed where marked."""

    model_config = ConfigDict(strict=True, extra="allow")

    psi_id: str
    name: str
    acronym: str | None
    approach: str
    conditions_note: str
    flow: str
    geometry: str
    gravity: str
    gravity_note: str
    hardware_note: str
    investigators_note: str
    managing_nasa_center: str
    objective: str
    research_area: str
    scenario_relevance: str
    space_benefits: str
    study_type: str
    doi: str | None
    earth_benefits: str | None
    end_date: str | None
    flight_platform: str | None
    fuel_state: str | None
    funding: str | None
    hardware: str | None
    hardware_link: str | None
    hypothesis: str | None
    principal_investigator: str | None
    project_scientist: str | None
    project_type: str | None
    public_release_date: str | None
    start_date: str | None
    sub_research_area: str | None
    additives: list[str] | None
    diluents: list[str] | None
    fuel: list[str] | None
    data_quality_notes: list[str]
    key_results: list[str]
    keywords: list[str]
    measured_or_computed_quantities: list[str]
    missing: list[str]
    related_investigations: list[str]
    safety_theme: list[str]
    sensors: list[str]
    sources: list[str]
    variables_between_tests: list[str]
    publications: list[dict[str, Any]]
    ambient_temperature_K: float | None
    o2_min_pct: float | None
    o2_max_pct: float | None
    pressure_min_psi: float | None
    pressure_max_psi: float | None
    test_summary: dict[str, Any]
    particle_size_table: dict[str, Any] | None = None


class ReferenceModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Habitat(ReferenceModel):
    id: str
    label: str
    kind: Literal["zone", "point", "note"]
    source: str
    short_name: str | None = None
    o2_pct_min: float | None = None
    pressure_psi_max: float | None = None
    o2_pct: float | None = None
    pressure_psi: float | None = None


class Report(ReferenceModel):
    file: str
    status: Literal["verified", "unverified"]
    note: str | None = None


class RegistryExperiment(ReferenceModel):
    psi_id: str
    kind: Literal["flight", "ground"]
    test_table: Literal["expected", "none"]
    reports: list[Report]


class GeneralDocument(ReferenceModel):
    file: str
    title: str
    status: Literal["verified", "unverified"]


class OutsideExperiment(ReferenceModel):
    label: str
    status: Literal["outside_psi"]


class OpenQuestion(ReferenceModel):
    experiment: str
    question: str


class Registry(ReferenceModel):
    experiments: list[RegistryExperiment]
    general_documents: list[GeneralDocument]
    outside_psi: list[OutsideExperiment]
    open_questions: list[OpenQuestion]


class Source(ReferenceModel):
    file: str
    page: int
    figure: str


class ReportCondition(ReferenceModel):
    experiment_id: str
    test_id: str
    o2_pct_min: float
    o2_pct_max: float
    pressure_psi_min: float
    pressure_psi_max: float
    fuel: str
    outcome: str
    source: Source
    outcome_words: str
    preset_label: str | None = None
    note: str | None = None


class Category(ReferenceModel):
    label: str
    weight: int


class RankingRules(ReferenceModel):
    version: str
    weighting_label: str
    categories: dict[str, Category]
    distance_rule: str
    atmosphere_rule: str
    material_rule: str
    sort_rule: str


class FuelCategory(ReferenceModel):
    psi_id: str
    category: str
    source: str
    note: str | None = None


class FuelPhrase(ReferenceModel):
    singular: str
    plural: str
    absent: str
    source: str


class WordsWithSource(ReferenceModel):
    words: str
    source: str


class OutcomeWords(ReferenceModel):
    experiment_id: str
    raw: str
    words: str
    source: str


class PlainWords(ReferenceModel):
    order: list[str]
    fuel_states: dict[str, FuelPhrase]
    no_outcome: WordsWithSource
    unmapped: WordsWithSource
    outcomes: list[OutcomeWords]
