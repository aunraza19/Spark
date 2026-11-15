import uuid
from collections.abc import Iterator
from typing import Protocol

from spark_data.agent.settings import Settings

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "seeing": {"type": "string"},
        "fire_safety": {"type": "string"},
        "cannot_tell": {"type": "string"},
        "sources": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["seeing", "fire_safety", "cannot_tell", "sources"],
}


class ModelError(Exception):
    pass


class Busy(ModelError):
    """A rate limit or an overloaded model. Safe to try again in a minute."""


class Unavailable(ModelError):
    """No model access is set up on this server."""


class Model(Protocol):
    model_id: str

    def one_shot(self, system: str, prompt: str) -> str: ...

    def chat_turn(self, system: str, messages: list[dict], tools: list[dict]) -> Iterator[dict]: ...


class NoModel:
    """Stands in when no model access is set up. Cached answers still work without a model."""

    def __init__(self, model_id: str):
        self.model_id = model_id

    def one_shot(self, system: str, prompt: str) -> str:
        raise Unavailable("no model access")

    def chat_turn(self, system: str, messages: list[dict], tools: list[dict]) -> Iterator[dict]:
        raise Unavailable("no model access")


class GeminiModel:
    """Gemini through AI Studio or Vertex AI. Errors are reduced to a code: no request details, no credentials."""

    def __init__(self, settings: Settings):
        from google import genai
        from google.genai import types

        if settings.backend == "vertex":
            self._client = genai.Client(vertexai=True, project=settings.project, location=settings.location)
        else:
            self._client = genai.Client(api_key=settings.api_key, http_options=types.HttpOptions(api_version="v1beta"))
        self.model_id = settings.model
        self._thinking = settings.thinking
        self._parts: dict[str, object] = {}

    def _fail(self, error: Exception) -> ModelError:
        code = getattr(error, "code", None)
        if code in (429, 500, 503, 504):
            return Busy(f"model answered {code}")
        return ModelError(f"model error {code or type(error).__name__}")

    def one_shot(self, system: str, prompt: str) -> str:
        from google.genai import errors, types

        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=ANSWER_SCHEMA,
            temperature=0,
        )
        try:
            return self._client.models.generate_content(model=self.model_id, contents=prompt, config=config).text or ""
        except errors.APIError as error:
            raise self._fail(error) from None

    def _contents(self, messages: list[dict]):
        from google.genai import types

        names: dict[str, str] = {}
        contents: list[types.Content] = []
        for m in messages:
            if m["role"] == "user":
                contents.append(types.Content(role="user", parts=[types.Part.from_text(text=m["text"])]))
            elif m["role"] == "assistant":
                parts = [types.Part.from_text(text=m["text"])] if m.get("text") else []
                for call in m.get("tool_calls", []):
                    names[call["id"]] = call["name"]
                    parts.append(self._parts.get(call["id"]) or types.Part.from_function_call(name=call["name"], args=call["args"]))
                if parts:
                    contents.append(types.Content(role="model", parts=parts))
            elif m["role"] == "tool":
                part = types.Part.from_function_response(name=names[m["tool_call_id"]], response={"result": m["content"]})
                if contents and contents[-1].role == "user" and contents[-1].parts[0].function_response:
                    contents[-1].parts.append(part)
                else:
                    contents.append(types.Content(role="user", parts=[part]))
        return contents

    def chat_turn(self, system: str, messages: list[dict], tools: list[dict]) -> Iterator[dict]:
        from google.genai import errors, types

        config = types.GenerateContentConfig(
            system_instruction=system,
            tools=[types.Tool(function_declarations=tools)],
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel(self._thinking.upper()), include_thoughts=True),
            temperature=0,
        )
        try:
            stream = self._client.models.generate_content_stream(model=self.model_id, contents=self._contents(messages), config=config)
            for chunk in stream:
                for part in (chunk.candidates[0].content.parts or []) if chunk.candidates else []:
                    if part.text and part.thought:
                        yield {"type": "reasoning", "delta": part.text}
                    elif part.text:
                        yield {"type": "text", "delta": part.text}
                    if part.function_call:
                        call_id = part.function_call.id or f"call_{uuid.uuid4().hex[:12]}"
                        self._parts[call_id] = part
                        yield {"type": "tool_call", "id": call_id, "name": part.function_call.name, "args": dict(part.function_call.args or {})}
        except errors.APIError as error:
            raise self._fail(error) from None
