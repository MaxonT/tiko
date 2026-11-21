"""Linear issues as cards: the adapter against a fake Linear, and the routes around it."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.adapters.tasks.linear import LinearApi, LinearProvider, to_task
from app.config import Settings
from app.domain.errors import LinearRejected, TaskNotFound, TrackerRateLimited, TrackerUnreachable
from app.domain.sources import valid_key
from app.domain.tasks import linear_key
from app.main import create_app
from tests.conftest import signed_in
from tests.linear_fake import KEY, FakeLinear, issue

LONG = "long-enough-password"


class Clock:
    def __init__(self) -> None:
        self.now = 1_800_000_000.0

    def __call__(self) -> float:
        return self.now


def provider(fake: FakeLinear, clock: Clock | None = None, key: str = KEY) -> LinearProvider:
    clock = clock or Clock()
    client = httpx.Client(transport=httpx.MockTransport(fake))
    return LinearProvider(LinearApi(client, key, clock), clock)


@pytest.mark.parametrize(
    ("ref", "key"),
    [
        ("https://linear.app/acme/issue/ENG-1/fix-the-thing", "acme/ENG-1"),
        ("https://linear.app/Acme/issue/eng-12", "acme/ENG-12"),
        ("https://linear.app/acme/issue/ENG-3#comment-1", "acme/ENG-3"),
        ("acme/ENG-4", "acme/ENG-4"),
        ("ENG-4", None),
        ("https://linear.app/acme/project/billing-1", None),
        ("https://linear.app/acme/issue/ENG-0", None),
    ],
)
def test_a_link_or_a_workspace_key_is_a_linear_key(ref, key):
    assert linear_key(ref) == key


def test_a_linear_key_carries_its_workspace():
    assert valid_key("linear", "acme/ENG-1")
    assert not valid_key("linear", "ENG-1")
    assert not valid_key("linear", "acme/eng-1")


def test_an_issue_reads_as_a_card():
    task = to_task(
        "acme/ENG-7",
        issue(
            "ENG-7",
            priority=0,
            priorityLabel="No priority",
            dueDate="2026-11-30",
            estimate=3.0,
            state={"name": "Done", "type": "completed"},
            project={"name": "Billing"},
            cycle={"name": None, "number": 12},
            parent={"identifier": "ENG-1", "title": "Checkout"},
            labels={"nodes": [{"name": "Bug", "color": "#EB5757"}, {"name": " ", "color": "#000"}]},
        ),
    )
    assert (task.status_name, task.status_category, task.type_name) == ("Done", "done", "Sub-issue")
    assert task.priority_name is None
    assert [(r.label, r.value) for r in task.rows] == [
        ("Project", "Billing"),
        ("Cycle", "Cycle 12"),
        ("Estimate", "3"),
        ("Parent", "ENG-1 Checkout"),
    ]
    assert [(label.name, label.color) for label in task.labels] == [("Bug", "eb5757")]
    assert (str(task.due), task.due_field) == ("2026-11-30", "dueDate")


@pytest.mark.parametrize(
    ("kind", "category"),
    [
        ("triage", "new"),
        ("backlog", "new"),
        ("unstarted", "new"),
        ("started", "indeterminate"),
        ("completed", "done"),
        ("canceled", "done"),
        ("duplicate", "done"),
    ],
)
def test_a_state_type_picks_the_category(kind, category):
    task = to_task("acme/ENG-1", issue("ENG-1", state={"name": "Any", "type": kind}))
    assert task.status_category == category


def test_resolve_and_poll_send_the_key_to_linear_only():
    fake = FakeLinear()
    reader = provider(fake)
    assert reader.resolve("acme/ENG-1").summary == "Title of ENG-1"
    assert [t.state for t in reader.poll(["acme/ENG-1", "acme/ENG-2"])] == ["ok", "ok"]
    assert {r.url.host for r in fake.requests} == {"api.linear.app"}
    assert {r.headers["authorization"] for r in fake.requests} == {KEY}


def test_a_poll_asks_once_for_many_cards():
    fake = FakeLinear()
    fake.issues |= {f"ENG-{n}": issue(f"ENG-{n}") for n in range(3, 150)}
    reader = provider(fake)
    reader.check()
    asked = len(fake.requests)
    tasks = reader.poll([f"acme/ENG-{n}" for n in range(1, 150)])
    assert all(t.state == "ok" for t in tasks)
    # Two pages of 100, nothing one by one.
    assert len(fake.requests) - asked == 2


def test_a_second_board_within_seconds_is_served_from_memory():
    fake = FakeLinear()
    clock = Clock()
    reader = provider(fake, clock)
    reader.poll(["acme/ENG-1"])
    asked = len(fake.requests)
    reader.poll(["acme/ENG-1"])
    assert len(fake.requests) == asked
    clock.now += 30
    reader.poll(["acme/ENG-1"])
    assert len(fake.requests) == asked + 1


def test_a_moved_issue_stays_on_its_card():
    fake = FakeLinear()
    fake.issues["OPS-9"] = issue("OPS-9", title="Moved")
    del fake.issues["ENG-2"]
    fake.moved["ENG-2"] = "OPS-9"
    [task] = provider(fake).poll(["acme/ENG-2"])
    assert (task.key, task.state, task.summary) == ("acme/ENG-2", "ok", "Moved")


def test_many_moved_issues_all_come_back_and_then_cost_one_request():
    fake = FakeLinear()
    clock = Clock()
    for n in range(10, 18):
        fake.issues[f"OPS-{n}"] = issue(f"OPS-{n}")
        fake.moved[f"ENG-{n}"] = f"OPS-{n}"
    reader = provider(fake, clock)
    keys = [f"acme/ENG-{n}" for n in range(10, 18)]
    reader.poll(keys)
    clock.now += 30
    assert all(t.state == "ok" for t in reader.poll(keys))
    clock.now += 30
    asked = len(fake.requests)
    reader.poll(keys)
    assert len(fake.requests) == asked + 1


def test_a_change_reaches_the_card_once_the_memory_is_old():
    fake = FakeLinear()
    clock = Clock()
    reader = provider(fake, clock)
    first = reader.poll(["acme/ENG-1"])[0]
    fake.issues["ENG-1"]["state"] = {"name": "Done", "type": "completed"}
    clock.now += 10
    again = reader.poll(["acme/ENG-1"])[0]
    assert (again.status_name, again.fetched_at) == ("In Progress", first.fetched_at)
    clock.now += 30
    assert reader.poll(["acme/ENG-1"])[0].status_name == "Done"


def test_a_deleted_issue_turns_not_found_and_is_not_asked_again_at_once():
    fake = FakeLinear()
    clock = Clock()
    reader = provider(fake, clock)
    assert reader.poll(["acme/ENG-1"])[0].state == "ok"
    del fake.issues["ENG-1"]
    clock.now += 30
    assert reader.poll(["acme/ENG-1"])[0].state == "not_found"
    clock.now += 30
    asked = len(fake.requests)
    assert reader.poll(["acme/ENG-1"])[0].state == "not_found"
    assert len(fake.requests) == asked


def test_an_issue_in_the_trash_is_not_found():
    fake = FakeLinear()
    clock = Clock()
    reader = provider(fake, clock)
    assert reader.poll(["acme/ENG-1"])[0].state == "ok"
    fake.issues["ENG-1"]["trashed"] = True
    clock.now += 30
    assert reader.poll(["acme/ENG-1"])[0].state == "not_found"
    with pytest.raises(TaskNotFound):
        reader.resolve("acme/ENG-1")


def test_another_workspace_is_not_found_without_a_request():
    fake = FakeLinear()
    reader = provider(fake)
    reader.check()
    asked = len(fake.requests)
    with pytest.raises(TaskNotFound, match="another Linear workspace"):
        reader.resolve("other/ENG-1")
    assert reader.poll(["other/ENG-1"])[0].state == "not_found"
    assert len(fake.requests) == asked
    assert reader.poll(["acme-old/ENG-1"])[0].state == "ok"


def test_check_names_the_person_and_the_workspace():
    assert provider(FakeLinear()).check() == "Ada Lovelace in Acme"


def test_a_rejected_key_keeps_the_cards():
    fake = FakeLinear()
    with pytest.raises(LinearRejected):
        provider(fake, key="wrong").poll(["acme/ENG-1"])


def test_it_stops_before_a_tenth_of_the_limit_is_left():
    fake = FakeLinear()
    clock = Clock()
    reset_ms = int((clock.now + 900) * 1000)
    headers = {
        "x-ratelimit-requests-limit": "2500",
        "x-ratelimit-requests-remaining": "250",
        "x-ratelimit-requests-reset": str(reset_ms),
        "x-ratelimit-complexity-limit": "3000000",
        "x-ratelimit-complexity-remaining": "2999000",
        "x-ratelimit-complexity-reset": str(reset_ms),
    }
    reader = provider(fake, clock)
    reader.check()
    reader.poll(["acme/ENG-1"])
    fake.headers = headers
    clock.now += 30
    # This answer is still served; the next request waits for the reset.
    assert reader.poll(["acme/ENG-1"])[0].state == "ok"
    clock.now += 30
    with pytest.raises(TrackerRateLimited) as limited:
        reader.poll(["acme/ENG-1"])
    assert 800 <= limited.value.retry_after <= 840
    clock.now += 900
    assert reader.poll(["acme/ENG-1"])[0].state == "ok"


def test_linear_saying_limited_waits():
    fake = FakeLinear()
    fake.status = 429
    with pytest.raises(TrackerRateLimited):
        provider(fake).poll(["acme/ENG-1"])


def test_no_network_is_unreachable():
    def down(request):
        raise httpx.ConnectError("no route")

    clock = Clock()
    client = httpx.Client(transport=httpx.MockTransport(down))
    with pytest.raises(TrackerUnreachable):
        LinearProvider(LinearApi(client, KEY, clock), clock).poll(["acme/ENG-1"])


@pytest.fixture
def team():
    fake = FakeLinear()
    settings = Settings(db_path=":memory:", tiko_secret_key="test-secret-key")
    app = create_app(settings, linear_transport=httpx.MockTransport(fake))
    admin = signed_in(app)
    url = admin.post("/api/invites", json={"role": "member"}).json()["url"]
    bob = TestClient(app)
    bob.post(
        f"/api/invites/{url.split('=', 1)[1]}/accept",
        json={"username": "bob", "name": "Bob", "password": LONG},
    )
    return admin, bob, fake


def test_my_linear_key(team):
    admin, _, _ = team
    refused = admin.put("/api/me/tracker", json={"token": "wrong", "source": "linear"})
    assert (refused.status_code, refused.json()["error"]["code"]) == (422, "validation_failed")
    saved = admin.put("/api/me/tracker", json={"token": f" {KEY}\n", "source": "linear"}).json()
    assert (saved["tokens"]["linear"], saved["connected_as"]) == ("set", "Ada Lovelace in Acme")
    assert KEY not in admin.get("/api/me/tracker").text
    assert admin.delete("/api/me/tracker", params={"source": "linear"}).status_code == 204
    assert admin.get("/api/me/tracker").json()["tokens"]["linear"] == "none"


def card(key: str) -> dict:
    data = {"key": key, "source": "linear", "collapsed": False}
    return {"id": key, "type": "task_card", "position": {"x": 0, "y": 0}, "data": data}


def test_a_link_is_a_live_card_for_its_owner_only(team):
    admin, bob, fake = team
    link = "https://linear.app/acme/issue/ENG-1/title-of-it"
    without = admin.post("/api/tasks/resolve", json={"ref": link})
    assert (without.status_code, without.json()["error"]["code"]) == (422, "validation_failed")
    admin.put("/api/me/tracker", json={"token": KEY, "source": "linear"})
    task = admin.post("/api/tasks/resolve", json={"ref": link}).json()["task"]
    assert (task["source"], task["key"], task["status_name"]) == (
        "linear",
        "acme/ENG-1",
        "In Progress",
    )

    board = admin.post("/api/boards", json={"name": "Cycle"}).json()["id"]
    doc = {"nodes": [card("acme/ENG-1")], "edges": []}
    assert admin.put(f"/api/boards/{board}", json={"version": 1, "doc": doc}).is_success
    assert admin.put(f"/api/boards/{board}/everyone", json={"role": "viewer"}).is_success
    mine = admin.post(f"/api/boards/{board}/refresh").json()
    assert mine["tasks"]["linear:acme/ENG-1"]["state"] == "ok"
    theirs = bob.post(f"/api/boards/{board}/refresh").json()["tasks"]["linear:acme/ENG-1"]
    assert (theirs["state"], theirs["summary"]) == ("no_token", "")
    assert "Title of ENG-1" not in bob.post(f"/api/boards/{board}/refresh").text


def test_a_guest_sees_the_key_and_the_link_only(team):
    admin, _, _ = team
    admin.put("/api/me/tracker", json={"token": KEY, "source": "linear"})
    board = admin.post("/api/boards", json={"name": "Cycle"}).json()["id"]
    doc = {"nodes": [card("acme/ENG-1")], "edges": []}
    admin.put(f"/api/boards/{board}", json={"version": 1, "doc": doc})
    admin.post(f"/api/boards/{board}/refresh")
    token = admin.put(f"/api/boards/{board}/public", json={"public": True}).json()["public_token"]
    guest = TestClient(admin.app)
    page = guest.get(f"/api/public/{token}")
    task = page.json()["tasks"]["linear:acme/ENG-1"]
    assert (task["state"], task["url"]) == ("private", "https://linear.app/acme/issue/ENG-1")
    assert "Title of ENG-1" not in page.text
