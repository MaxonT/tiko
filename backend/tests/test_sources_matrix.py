"""What every tracker does with refs, keys, guests and tokens, pinned across the source refactor.

A change of a row here is a change of behaviour: it goes in its own commit, on purpose.
"""

import pytest

from app.api.v1.elements import _parse
from app.config import Settings
from app.domain.errors import HostMismatch, InvalidRef
from app.domain.public import guest_tasks
from app.domain.sources import resolve_task, valid_key
from app.domain.tasks import Task, now_iso
from app.main import create_app
from tests.conftest import signed_in


class Stub:
    """A tracker that answers every key it is asked for, and remembers what it was asked."""

    def __init__(self, source_id: str, base_host: str = "", known: set[str] | None = None):
        self.source_id = source_id
        self.base_host = base_host
        self.known = known
        self.asked: list[str] = []

    def resolve(self, key: str) -> Task:
        self.asked.append(key)
        return Task(source=self.source_id, key=key, url="", fetched_at=now_iso())

    def poll(self, keys: list[str]) -> list[Task]:
        return [self.resolve(key) for key in keys if self.known is None or key in self.known]


class Snapshots:
    def put_many(self, tasks: list[Task]) -> None:
        pass


def providers() -> dict[str, Stub]:
    return {
        "demo": Stub("demo"),
        "jira": Stub("jira", "jira.example.com"),
        "github": Stub("github"),
        "caldav": Stub("caldav"),
    }


ROUTES = [
    ("DEV-1", "jira", ("jira", "DEV-1")),
    ("dev-1", "jira", ("jira", "DEV-1")),
    (" DEV-1 ", "jira", ("jira", "DEV-1")),
    ("https://jira.example.com/browse/DEV-1", "jira", ("jira", "DEV-1")),
    (
        "https://jira.example.com/secure/RapidBoard.jspa?rapidView=1&selectedIssue=DEV-2",
        "jira",
        ("jira", "DEV-2"),
    ),
    ("DEMO-5", "demo", ("demo", "DEMO-5")),
    ("octo/widgets#12", "jira", ("github", "octo/widgets#12")),
    ("octo/widgets#12", "demo", ("github", "octo/widgets#12")),
    ("https://github.com/octo/widgets/pull/12/files", "jira", ("github", "octo/widgets#12")),
    (
        "https://www.github.com/octo/widgets/issues/7#issuecomment-1",
        "demo",
        ("github", "octo/widgets#7"),
    ),
]

REFUSED = [
    ("https://other.example.com/browse/DEV-1", "jira", HostMismatch),
    ("not a key", "jira", InvalidRef),
    ("https://github.com/octo/widgets", "jira", InvalidRef),
    ("https://example.com/whatever", "demo", InvalidRef),
]


@pytest.mark.parametrize(("ref", "tracker", "expected"), ROUTES)
def test_resolve_routes_a_ref_to_its_tracker(ref, tracker, expected):
    found = providers()
    task = resolve_task(ref, found, tracker, Snapshots())
    assert (task.source, task.key) == expected
    assert [s for s, p in found.items() if p.asked] == [expected[0]]


@pytest.mark.parametrize(("ref", "tracker", "error"), REFUSED)
def test_resolve_refuses_what_no_tracker_reads(ref, tracker, error):
    with pytest.raises(error):
        resolve_task(ref, providers(), tracker, Snapshots())


V1_ROUTES = [
    *[(ref, tracker, expected) for ref, tracker, expected in ROUTES],
    ("jira:DEV-3", "demo", ("jira", "DEV-3")),
    ("demo:DEMO-1", "jira", ("demo", "DEMO-1")),
    ("github:octo/widgets#3", "jira", ("github", "octo/widgets#3")),
    ("caldav:2f1e-uid@example.com", "jira", ("caldav", "2f1e-uid@example.com")),
]

V1_REFUSED = [
    *REFUSED,
    ("caldav:has space", "jira", InvalidRef),
    ("github:DEV-1", "jira", InvalidRef),
    ("other:DEV-1", "jira", InvalidRef),
]


@pytest.mark.parametrize(("ref", "tracker", "expected"), V1_ROUTES)
def test_api_v1_routes_a_ref_to_its_tracker(ref, tracker, expected):
    assert _parse(ref, providers(), tracker) == expected


@pytest.mark.parametrize(("ref", "tracker", "error"), V1_REFUSED)
def test_api_v1_refuses_what_no_tracker_reads(ref, tracker, error):
    with pytest.raises(error):
        _parse(ref, providers(), tracker)


def test_api_v1_refuses_a_tracker_the_instance_does_not_read():
    found = providers()
    del found["jira"]
    with pytest.raises(InvalidRef):
        _parse("jira:DEV-1", found, "demo")


KEYS = [
    (None, "DEV-1", True),
    (None, "dev-1", False),
    ("jira", "DEV-1", True),
    ("jira", "A-1", False),
    ("demo", "DEMO-1", True),
    ("github", "octo/widgets#1", True),
    ("github", "octo/widgets#0", False),
    ("github", "DEV-1", False),
    ("caldav", "2f1e-uid@example.com", True),
    ("caldav", "has space", False),
    ("caldav", "", False),
    ("something-new", "DEV-1", True),
    ("something-new", "octo/widgets#1", False),
]


@pytest.mark.parametrize(("source", "key", "valid"), KEYS)
def test_a_key_is_valid_by_its_tracker(source, key, valid):
    assert valid_key(source, key) is valid


def test_a_guest_gets_open_tasks_in_full_and_a_link_for_the_rest():
    open_sources = {"demo": Stub("demo", known={"DEMO-1"}), "github": Stub("github", known=set())}
    refs = [
        "demo:DEMO-1",
        "demo:DEMO-9",
        "jira:DEV-1",
        "github:octo/widgets#4",
        "caldav:2f1e-uid@example.com",
    ]
    tasks, failed = guest_tasks(refs, open_sources, "https://jira.example.com")
    assert failed == {}
    assert {ref: (t.state, t.url) for ref, t in tasks.items()} == {
        "demo:DEMO-1": ("ok", ""),
        "demo:DEMO-9": ("private", ""),
        "jira:DEV-1": ("private", "https://jira.example.com/browse/DEV-1"),
        "github:octo/widgets#4": ("private", "https://github.com/octo/widgets/issues/4"),
        "caldav:2f1e-uid@example.com": ("private", ""),
    }


def test_a_guest_without_a_jira_url_gets_no_jira_link():
    tasks, _ = guest_tasks(["jira:DEV-1", "caldav:uid-1"], {}, None)
    assert {ref: t.url for ref, t in tasks.items()} == {"jira:DEV-1": "", "caldav:uid-1": ""}


def test_every_personal_credential_has_a_stamp():
    app = create_app(Settings(db_path=":memory:", tiko_secret_key="test-secret-key"))
    assert set(app.state.settings.token_stamps("nobody")) == {"jira", "github", "caldav"}


def test_my_tracker_answers_the_state_of_each_token():
    client = signed_in(create_app(Settings(db_path=":memory:", tiko_secret_key="test-secret-key")))
    assert client.get("/api/me/tracker").json() == {
        "provider": "demo",
        "base_url": None,
        "kind": None,
        "email": None,
        "tokens": {"jira": "none", "caldav": "none", "github": "none"},
        "connected_as": None,
    }
