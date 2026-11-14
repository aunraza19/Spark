from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
INCOMING_DIR = REPO_ROOT / "data" / "incoming"
EXPERIMENTS_DIR = INCOMING_DIR / "experiments"
CLEAN_DIR = REPO_ROOT / "data" / "clean"
REFERENCE_DIR = REPO_ROOT / "data" / "reference"
