from types import SimpleNamespace

from spark_data.agent.model import GeminiModel


class FakeStream:
    def __init__(self, chunks, seen):
        self.chunks = chunks
        self.seen = seen

    def generate_content_stream(self, model, contents, config):
        self.seen.append(config)
        return iter(self.chunks)


def part(text=None, thought=False):
    return SimpleNamespace(text=text, thought=thought, function_call=None)


def chunk(*parts):
    return SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=list(parts)))])


def model_with(chunks, thinking="medium"):
    seen = []
    model = GeminiModel.__new__(GeminiModel)
    model._client = SimpleNamespace(models=FakeStream(chunks, seen))
    model.model_id = "fake"
    model._thinking = thinking
    model._parts = {}
    return model, seen


def test_a_chat_turn_asks_for_medium_thinking_with_summaries_and_separates_them_from_the_answer():
    model, seen = model_with([chunk(part("Checking the zone.", thought=True)), chunk(part("Twenty tests."))])
    events = list(model.chat_turn("system", [{"role": "user", "text": "How many?"}], []))
    assert events == [{"type": "reasoning", "delta": "Checking the zone."}, {"type": "text", "delta": "Twenty tests."}]
    thinking = seen[0].thinking_config
    assert thinking.include_thoughts is True
    assert str(thinking.thinking_level.value).lower() == "medium"


def test_the_thinking_level_follows_the_setting():
    model, seen = model_with([chunk(part("Ok."))], thinking="low")
    list(model.chat_turn("system", [{"role": "user", "text": "Hi"}], []))
    assert str(seen[0].thinking_config.thinking_level.value).lower() == "low"
