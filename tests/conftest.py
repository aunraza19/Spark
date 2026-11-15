import pytest


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tests use a fake model. Building a real Gemini client in a test is a mistake, so it fails loudly."""
    from google import genai

    def refuse(*args, **kwargs):
        raise AssertionError("a test tried to build a real Gemini client")

    monkeypatch.setattr(genai, "Client", refuse)
