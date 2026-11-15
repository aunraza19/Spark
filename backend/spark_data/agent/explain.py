import hashlib
import json
import re
from pathlib import Path

from spark_data.agent.check import check_answer
from spark_data.agent.files import AgentFiles
from spark_data.agent.model import Model
from spark_data.snapshots import snapshot_key


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


class AnswerCache:
    """One file per (snapshot key, prompt version, model id). A file that cannot be read is a miss."""

    def __init__(self, directory: Path):
        self.directory = directory

    def _path(self, key: str, version: str, model_id: str) -> Path:
        name = hashlib.sha256(f"{key}|{version}|{model_id}".encode()).hexdigest()[:32]
        return self.directory / f"{name}.json"

    def get(self, key: str, version: str, model_id: str) -> dict | None:
        try:
            stored = json.loads(self._path(key, version, model_id).read_text(encoding="utf-8"))
            same = (stored["snapshot_key"], stored["prompt_version"], stored["model"]) == (key, version, model_id)
            return stored["answer"] if same and isinstance(stored["answer"], dict) else None
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def put(self, key: str, version: str, model_id: str, answer: dict) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        stored = {"snapshot_key": key, "prompt_version": version, "model": model_id, "answer": answer}
        self._path(key, version, model_id).write_text(json.dumps(stored, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _prompt(snapshot: dict, names: dict) -> str:
    return f"Experiment names:\n{canonical(names)}\n\nSnapshot:\n{canonical(snapshot)}"


def _parse(text: str) -> tuple[dict | None, list[str]]:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        answer = json.loads(cleaned)
    except ValueError:
        return None, ["The answer was not valid JSON. Answer with the JSON object only."]
    return answer, []


def explain(snapshot: dict, names: dict, model: Model, files: AgentFiles, cache: AnswerCache) -> dict:
    key = snapshot_key(snapshot)
    cached = cache.get(key, files.version, model.model_id)
    if cached is not None:
        return {"status": "ok", "answer": cached, "key": key, "model": model.model_id, "cached": True}
    prompt = _prompt(snapshot, names)
    problems: list[str] = []
    for _ in range(2):
        retry = "" if not problems else "\n\nYour last answer had these problems. Fix all of them:\n" + "\n".join(f"- {p}" for p in problems)
        answer, problems = _parse(model.one_shot(files.instructions(files.explain_prompt), prompt + retry))
        if answer is not None:
            problems = check_answer(answer, snapshot, files.banned)
        if not problems:
            cache.put(key, files.version, model.model_id, answer)
            return {"status": "ok", "answer": answer, "key": key, "model": model.model_id, "cached": False}
    return {"status": "unchecked", "reasons": problems, "key": key, "model": model.model_id}
