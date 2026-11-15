import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_guide_reference_matches_the_api():
    """The guide's API reference is built from a committed schema; `make openapi` refreshes it."""
    spec = importlib.util.spec_from_file_location("openapi", ROOT / "scripts" / "openapi.py")
    script = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(script)
    committed = json.loads((ROOT / "docs" / "guide" / "openapi.json").read_text())
    assert committed == script.schema(), "docs/guide/openapi.json is stale: run `make openapi`"
