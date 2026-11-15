import hashlib
from dataclasses import dataclass
from pathlib import Path

from spark_data.paths import REFERENCE_DIR


@dataclass(frozen=True)
class AgentFiles:
    explain_prompt: str
    chat_prompt: str
    banned: list[str]
    version: str

    def instructions(self, prompt: str) -> str:
        """A prompt with the banned phrases from the file spelled out, so the model knows what the check will reject."""
        return f"{prompt}\n\nNever use these words or phrases: {', '.join(self.banned)}."


def load_files(directory: Path = REFERENCE_DIR / "agent") -> AgentFiles:
    explain_prompt = (directory / "explain_prompt.txt").read_text(encoding="utf-8").strip()
    chat_prompt = (directory / "chat_prompt.txt").read_text(encoding="utf-8").strip()
    banned = [line.strip() for line in (directory / "banned_words.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
    digest = hashlib.sha256("\0".join([explain_prompt, chat_prompt, "\n".join(banned)]).encode("utf-8"))
    return AgentFiles(explain_prompt, chat_prompt, banned, digest.hexdigest()[:12])
