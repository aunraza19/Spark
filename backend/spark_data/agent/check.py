import json
import re

PARTS = {"seeing": "What you are seeing", "fire_safety": "What it means for fire safety", "cannot_tell": "What the data cannot tell you"}
_ID = re.compile(r"PSI-\d+")
_NUMBER = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?![\w])")
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def _numbers(text: str) -> set[str]:
    """Numbers in a text, written the same way: 30.0 and 30 are one number. PSI ids are not numbers."""
    return {format(float(token), "g") for token in _NUMBER.findall(_ID.sub(" ", text))}


def check_answer(answer: dict, snapshot: dict, banned: list[str]) -> list[str]:
    if not isinstance(answer, dict):
        return ["The answer must be a JSON object with seeing, fire_safety, cannot_tell and sources."]
    reasons: list[str] = []
    texts: dict[str, str] = {}
    for field, label in PARTS.items():
        value = answer.get(field)
        if not isinstance(value, str) or not value.strip():
            reasons.append(f"The part {field} ({label}) is missing or empty.")
        else:
            texts[field] = value
    sources = answer.get("sources")
    if not isinstance(sources, list) or not all(isinstance(s, str) for s in sources):
        reasons.append("The part sources must be a list of PSI ids.")
        sources = []

    snapshot_text = json.dumps(snapshot, ensure_ascii=False)
    snapshot_ids = set(_ID.findall(snapshot_text))
    allowed = _numbers(snapshot_text)
    joined = " ".join(texts.values())

    for number in sorted({n for n in _numbers(joined) if n not in allowed}, key=float):
        reasons.append(f"The number {number} is not in the data. Use only numbers from the data, copied exactly.")
    for psi_id in sorted(set(_ID.findall(joined)) - snapshot_ids):
        reasons.append(f"{psi_id} is not in the data. Use only PSI ids from the data.")
    for source in sources:
        if not _ID.fullmatch(source):
            reasons.append(f"The source {source} is not a PSI id such as PSI-159.")
        elif source not in snapshot_ids:
            reasons.append(f"The source {source} is not in the data.")
    if len(sources) > 6:
        reasons.append("Name at most six sources: only the PSI ids your answer rests on, not every id in the data.")
    if snapshot_ids and not sources:
        reasons.append("Name at least one PSI id from the data in sources.")

    for text in texts.values():
        for sentence in filter(None, _SENTENCE.split(text.strip())):
            if len(sentence.split()) >= 20:
                reasons.append(f"Every sentence must have fewer than 20 words. This one is too long: {sentence[:60]}...")
    lowered = joined.lower()
    for phrase in banned:
        if re.search(rf"(?<!\w){re.escape(phrase.lower())}(?!\w)", lowered):
            reasons.append(f"Do not use the words {phrase}.")
    return reasons
