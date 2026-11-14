from typing import Any

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
