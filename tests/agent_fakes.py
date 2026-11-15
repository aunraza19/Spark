import json
import re

from spark_data.agent.files import AgentFiles


class FakeModel:
    """A scripted model. It records every call and never touches the network."""

    def __init__(self, replies=None, turns=None, model_id="fake-model-1", error=None):
        self.model_id = model_id
        self.replies = list(replies or [])
        self.turns = list(turns or [])
        self.error = error
        self.one_shot_calls: list[tuple[str, str]] = []
        self.chat_calls: list[tuple[str, list[dict], list[dict]]] = []

    def one_shot(self, system, prompt):
        self.one_shot_calls.append((system, prompt))
        if self.error:
            raise self.error
        return self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]

    def chat_turn(self, system, messages, tools):
        self.chat_calls.append((system, [dict(m) for m in messages], tools))
        if self.error:
            raise self.error
        yield from self.turns.pop(0)


FILES = AgentFiles(explain_prompt="EXPLAIN SYSTEM", chat_prompt="CHAT SYSTEM", banned=["will burn", "is safe"], version="v-test")


def psi_ids(snapshot) -> list[str]:
    return sorted(set(re.findall(r"PSI-\d+", json.dumps(snapshot))), key=lambda i: int(i[4:]))


def plain_answer(snapshot) -> dict:
    """A checked-style answer with no numbers, citing the first PSI id in the snapshot."""
    return {
        "seeing": "These are the tests closest to this atmosphere.",
        "fire_safety": "They show how flames behaved when gravity was almost zero.",
        "cannot_tell": "The data cannot show how a material would behave here.",
        "sources": psi_ids(snapshot)[:1],
    }


def reply(snapshot) -> str:
    return json.dumps(plain_answer(snapshot))
