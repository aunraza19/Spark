import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

from spark_data.paths import REPO_ROOT

DEFAULT_MODEL = "gemini-3.5-flash-lite"
DEFAULT_LOCATION = "us-central1"


@dataclass(frozen=True)
class Settings:
    backend: str
    model: str
    api_key: str | None = field(repr=False)
    project: str | None
    location: str

    def configured(self) -> bool:
        if self.backend == "aistudio":
            return bool(self.api_key)
        if self.backend == "vertex":
            return bool(self.project)
        return False

    def describe(self) -> dict:
        return {
            "backend": self.backend,
            "model": self.model,
            "key_set": bool(self.api_key),
            "project_set": bool(self.project),
            "location": self.location,
        }


def _read_dotenv(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    found: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        found[name.removeprefix("export ").strip()] = value.strip().strip("\"'")
    return found


def load_settings(env: Mapping[str, str] | None = None, dotenv: Path | None = None) -> Settings:
    """The environment wins over the .env file. Nothing here is ever printed or logged."""
    env = os.environ if env is None else env
    file = _read_dotenv(REPO_ROOT / ".env" if dotenv is None else dotenv)

    def get(name: str) -> str | None:
        return env.get(name) or file.get(name) or None

    return Settings(
        backend=get("SPARK_GEMINI_BACKEND") or "aistudio",
        model=get("SPARK_GEMINI_MODEL") or DEFAULT_MODEL,
        api_key=get("GEMINI_API_KEY") or get("GOOGLE_API_KEY"),
        project=get("GOOGLE_CLOUD_PROJECT"),
        location=get("GOOGLE_CLOUD_LOCATION") or DEFAULT_LOCATION,
    )
