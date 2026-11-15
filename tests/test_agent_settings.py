from pathlib import Path

from spark_data.agent.settings import Settings, load_settings

SECRET = "SECRET-KEY-do-not-print-123"


def test_the_defaults_are_ai_studio_and_a_flash_lite_model_with_function_calling():
    s = load_settings(env={}, dotenv=Path("does-not-exist.env"))
    assert (s.backend, s.model) == ("aistudio", "gemini-3.5-flash-lite")
    assert s.api_key is None
    assert s.configured() is False


def test_two_settings_choose_the_backend_and_the_model():
    s = load_settings(env={"SPARK_GEMINI_BACKEND": "vertex", "SPARK_GEMINI_MODEL": "some-model"}, dotenv=Path("none.env"))
    assert (s.backend, s.model) == ("vertex", "some-model")


def test_ai_studio_is_configured_by_a_key():
    s = load_settings(env={"GEMINI_API_KEY": SECRET}, dotenv=Path("none.env"))
    assert s.configured() is True
    assert s.api_key == SECRET


def test_vertex_is_configured_by_a_project_and_never_needs_a_key():
    env = {"SPARK_GEMINI_BACKEND": "vertex", "GOOGLE_CLOUD_PROJECT": "my-project"}
    s = load_settings(env=env, dotenv=Path("none.env"))
    assert s.configured() is True
    assert s.project == "my-project"
    assert s.location


def test_vertex_without_a_project_is_not_configured():
    s = load_settings(env={"SPARK_GEMINI_BACKEND": "vertex", "GEMINI_API_KEY": SECRET}, dotenv=Path("none.env"))
    assert s.configured() is False


def test_an_unknown_backend_is_not_configured():
    s = load_settings(env={"SPARK_GEMINI_BACKEND": "elsewhere", "GEMINI_API_KEY": SECRET}, dotenv=Path("none.env"))
    assert s.configured() is False


def test_the_dotenv_file_fills_what_the_environment_lacks(tmp_path):
    dotenv = tmp_path / ".env"
    dotenv.write_text(f'GEMINI_API_KEY="{SECRET}"\nSPARK_GEMINI_MODEL=from-file\n# a comment\n', encoding="utf-8")
    s = load_settings(env={}, dotenv=dotenv)
    assert s.api_key == SECRET
    assert s.model == "from-file"


def test_the_environment_wins_over_the_dotenv_file(tmp_path):
    dotenv = tmp_path / ".env"
    dotenv.write_text("SPARK_GEMINI_MODEL=from-file\n", encoding="utf-8")
    assert load_settings(env={"SPARK_GEMINI_MODEL": "from-env"}, dotenv=dotenv).model == "from-env"


def test_a_blank_key_in_the_dotenv_file_counts_as_no_key(tmp_path):
    dotenv = tmp_path / ".env"
    dotenv.write_text("GEMINI_API_KEY=\n", encoding="utf-8")
    assert load_settings(env={}, dotenv=dotenv).configured() is False


def test_describing_the_settings_never_includes_the_key():
    s = load_settings(env={"GEMINI_API_KEY": SECRET}, dotenv=Path("none.env"))
    assert SECRET not in str(s.describe())
    assert s.describe()["key_set"] is True
    assert SECRET not in repr(s)


def test_the_settings_are_a_plain_value():
    assert Settings(backend="aistudio", model="m", api_key=None, project=None, location="x").configured() is False
