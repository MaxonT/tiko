"""Every tracker tiko reads, described once.

A new tracker is an adapter, one `Source` here and one line where `api/deps.py` builds the
providers. Nothing else in `api/` or `domain/` asks which tracker a key belongs to.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from app.domain.errors import InvalidRef, ValidationFailed
from app.domain.ports import SnapshotRepo, TaskProvider
from app.domain.tasks import (
    CALDAV,
    GITHUB,
    GITHUB_KEY_RE,
    KEY_RE,
    Task,
    github_key,
    github_url,
    parse_ref,
    valid_uid,
)


def _jira_key(key: str) -> bool:
    return bool(KEY_RE.match(key))


def _no_link(key: str, base_url: str | None) -> str:
    return ""


def _jira_link(key: str, base_url: str | None) -> str:
    return f"{base_url}/browse/{key}" if base_url else ""


@dataclass(frozen=True)
class Source:
    id: str
    # The tracker's name inside a sentence: "GitHub has no search here".
    name: str
    # Whether a key, as stored on a card, has this tracker's shape.
    valid: Callable[[str], bool] = _jira_key
    # The key in a link or a typed ref that only this tracker uses, read on any instance;
    # None for the instance's own tracker, which takes whatever no other source claims.
    own_ref: Callable[[str], str | None] | None = None
    # The page a guest may follow for a task they cannot read; `base_url` is the instance's Jira.
    guest_link: Callable[[str, str | None], str] = _no_link
    # The kind a person's credential for it is stored under, when it needs one.
    credential: str | None = None
    # For a tracker read with one personal token: the only address the token is sent to.
    token_url: str | None = None
    # Its name in usage stats; None for a tracker the stats do not count.
    usage: str | None = None
    # False when the key is an id that means nothing to people, so a preview leaves it out.
    readable_key: bool = True
    # How a search reaches it: a query in the tracker's terms, words of the title, or not at all.
    search: Literal["query", "titles"] | None = "query"


SOURCES: dict[str, Source] = {
    source.id: source
    for source in (
        Source(
            id="jira",
            name="Jira",
            guest_link=_jira_link,
            credential="jira",
            usage="jira_dc",
        ),
        Source(id="demo", name="the demo tracker", usage="demo"),
        Source(
            id=CALDAV,
            name="CalDAV",
            valid=valid_uid,
            credential=CALDAV,
            readable_key=False,
            search="titles",
        ),
        Source(
            id=GITHUB,
            name="GitHub",
            valid=lambda key: bool(GITHUB_KEY_RE.match(key)),
            own_ref=github_key,
            guest_link=lambda key, _: github_url(key),
            credential=GITHUB,
            token_url="https://api.github.com",
            usage=GITHUB,
            search=None,
        ),
    )
}


def valid_key(source: str | None, key: str) -> bool:
    """Whether the key has the shape its tracker uses; a missing source is the instance's."""
    found = SOURCES.get(source or "")
    return found.valid(key) if found else bool(KEY_RE.match(key))


def readable_key(source: str | None) -> bool:
    found = SOURCES.get(source or "")
    return found.readable_key if found else True


def guest_link(source: str, key: str, base_url: str | None) -> str:
    found = SOURCES.get(source)
    return found.guest_link(key, base_url) if found else ""


def credential_kinds() -> list[str]:
    return [s.credential for s in SOURCES.values() if s.credential]


def token_source(source_id: str) -> Source:
    """A tracker a person reads with one token of their own; any other id is a mistake."""
    found = SOURCES.get(source_id)
    if found is None or found.token_url is None:
        raise ValidationFailed(f"source: {source_id} takes no token here")
    return found


def route_ref(ref: str, providers: dict[str, TaskProvider], default_source: str) -> tuple[str, str]:
    """The tracker and the key a typed ref or a link names: a link or key only one tracker
    uses goes to it on any instance, everything else to the instance's tracker."""
    for source in SOURCES.values():
        if source.own_ref and source.id in providers and (key := source.own_ref(ref)):
            return source.id, key
    if default_source not in providers:
        raise InvalidRef(f"This tiko does not read {default_source}.")
    return default_source, parse_ref(ref, providers[default_source].base_host)


def resolve_task(
    ref: str, providers: dict[str, TaskProvider], default_source: str, snapshots: SnapshotRepo
) -> Task:
    source, key = route_ref(ref, providers, default_source)
    task = providers[source].resolve(key)
    snapshots.put_many([task])
    return task
