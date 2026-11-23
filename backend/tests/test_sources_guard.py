"""A tracker is described once, in `domain/sources.py`; the rest of `api/` and `domain/` asks
the description instead of naming the tracker."""

import re
from pathlib import Path
from typing import get_args

from app.domain.sources import SOURCES
from app.domain.usage import Tracker

APP = Path(__file__).parents[1] / "app"

# The instance's own trackers: settings, JQL and the Jira URL are about them by design.
INSTANCE = {"jira", "demo"}

# Where a tracker's name belongs, and why.
ALLOWED = {
    "domain/sources.py": set(SOURCES) - INSTANCE,  # the descriptions
    "domain/tasks.py": {"github", "caldav", "linear"},  # source ids and key shapes
    "domain/caldav.py": {"caldav"},  # CalDAV's own module
    "domain/settings.py": {"caldav"},  # the CalDAV account, stored as one credential
    "domain/usage.py": {"github", "linear"},  # the names the stats collector accepts
    "api/deps.py": {"github", "linear"},  # the list that builds each request's providers
}


def named(text: str, source: str) -> bool:
    return bool(re.search(rf"\"{source}\"|'{source}'|\b{source.upper()}\b", text))


def test_no_tracker_is_named_outside_its_description():
    found = []
    for path in sorted((APP / "api").rglob("*.py")) + sorted((APP / "domain").rglob("*.py")):
        rel = path.relative_to(APP).as_posix()
        text = path.read_text()
        for source in set(SOURCES) - INSTANCE:
            if named(text, source) and source not in ALLOWED.get(rel, set()):
                found.append(f"{rel} names {source}")
    assert found == []


def test_the_guard_sees_a_named_tracker():
    assert named('if body.source == "github":', "github")
    assert named("found[GITHUB] = provider", "github")
    assert not named("github_key(ref)", "github")


def test_every_counted_tracker_has_a_name_the_collector_accepts():
    assert {s.usage for s in SOURCES.values() if s.usage} <= set(get_args(Tracker))
