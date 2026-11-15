from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
INCOMING_DIR = REPO_ROOT / "data" / "incoming"
EXPERIMENTS_DIR = INCOMING_DIR / "experiments"
CLEAN_DIR = REPO_ROOT / "data" / "clean"
REFERENCE_DIR = REPO_ROOT / "data" / "reference"
WEB_DIST = REPO_ROOT / "web" / "dist"
AGENT_CACHE_DIR = REPO_ROOT / "data" / "agent_cache"
