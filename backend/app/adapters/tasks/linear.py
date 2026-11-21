"""Linear issues read over the Linear GraphQL API with a person's own API key."""

import math
import re
import time
from collections.abc import Callable
from typing import NoReturn

import httpx

from app.adapters.tasks.readers import PersonalReaders
from app.domain.errors import (
    TaskNotFound,
    TrackerRateLimited,
    TrackerUnavailable,
    TrackerUnreachable,
    ValidationFailed,
)
from app.domain.tasks import (
    LINEAR,
    StatusCategory,
    Task,
    TaskLabel,
    TaskRow,
    linear_url,
    now_iso,
    tracker_day,
)

API_URL = "https://api.linear.app/graphql"
# Linear's own page cap is 250; 100 keeps a page well under its 10,000-point query limit.
PAGE = 100
# A tenth of the person's hourly requests and points stays for their other tools.
KEEP = 0.1
# Cards on several open boards ask for the same issues; one answer serves them for this long.
FRESH_S = 25
# Identifiers the list filter missed are asked one by one, a few each poll.
SINGLES_PER_POLL = 5
# An identifier Linear does not know is not asked again for this long.
MISS_S = 600
# The person's workspace and teams are read again after this long.
VIEWER_S = 3600
DEFAULT_RETRY_AFTER_S = 60
REJECTED = "Linear rejected your key. Enter a new one in Settings → My tracker."

_ISSUE_FIELDS = """
  id identifier title url updatedAt priority priorityLabel dueDate estimate
  state { name type }
  assignee { name }
  project { name }
  cycle { name number }
  parent { identifier title }
  labels(first: 10) { nodes { name color } }
"""
_ISSUES = (
    "query($ids: [ID!], $first: Int) { issues(first: $first, includeArchived: true,"
    " filter: {id: {in: $ids}}) { nodes {" + _ISSUE_FIELDS + "} } }"
)
_ISSUE = "query($id: String!) { issue(id: $id) {" + _ISSUE_FIELDS + "} }"
_VIEWER = "{ viewer { name } organization { name urlKey previousUrlKeys } }"

_CATEGORY: dict[str, StatusCategory] = {
    "triage": "new",
    "backlog": "new",
    "unstarted": "new",
    "started": "indeterminate",
    "completed": "done",
    "canceled": "done",
    "duplicate": "done",
}
_HEX = re.compile(r"^#?([0-9a-fA-F]{6})$")


class LinearRejected(TrackerUnavailable):
    """Linear did not accept the person's API key; cards keep what they last showed."""

    code = "linear_rejected"


def _number(value: object) -> str:
    """An estimate as Linear shows it: 3, not 3.0."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def to_task(key: str, issue: dict) -> Task:
    state = issue.get("state") or {}
    parent = issue.get("parent")
    rows = []
    if project := (issue.get("project") or {}).get("name"):
        rows.append(TaskRow(label="Project", value=project))
    if cycle := issue.get("cycle"):
        rows.append(TaskRow(label="Cycle", value=cycle.get("name") or f"Cycle {cycle['number']}"))
    if issue.get("estimate") is not None:
        rows.append(TaskRow(label="Estimate", value=_number(issue["estimate"])))
    if parent:
        rows.append(TaskRow(label="Parent", value=f"{parent['identifier']} {parent['title']}"))
    labels = []
    for label in (issue.get("labels") or {}).get("nodes") or []:
        name = (label.get("name") or "").strip()
        color = _HEX.match(label.get("color") or "")
        if name:
            labels.append(TaskLabel(name=name, color=color.group(1).lower() if color else ""))
    due = tracker_day(issue.get("dueDate"))
    return Task(
        source=LINEAR,
        key=key,
        summary=issue.get("title") or "",
        status_name=state.get("name") or "",
        status_category=_CATEGORY.get(state.get("type") or "", "new"),
        type_name="Sub-issue" if parent else "Issue",
        assignee_name=(issue.get("assignee") or {}).get("name"),
        priority_name=issue.get("priorityLabel") if issue.get("priority") else None,
        updated=issue.get("updatedAt"),
        url=issue.get("url") or linear_url(key),
        fetched_at=now_iso(),
        labels=labels,
        rows=rows,
        due=due,
        due_field="dueDate" if due else None,
    )


def _task(key: str, issue: dict) -> Task:
    try:
        return to_task(key, issue)
    except (KeyError, TypeError, AttributeError) as exc:
        raise TrackerUnavailable("Linear returned an issue in an unexpected format.") from exc


def _not_found(errors: list) -> bool:
    return bool(errors) and all(
        isinstance(e, dict)
        and (e.get("extensions") or {}).get("code") == "INPUT_ERROR"
        and "not found" in str(e.get("message", "")).lower()
        for e in errors
    )


class LinearApi:
    """GraphQL requests with one API key, kept inside the limits Linear reports."""

    def __init__(
        self, client: httpx.Client, key: str, clock: Callable[[], float] = time.time
    ) -> None:
        self._client = client
        self._key = key
        self._clock = clock
        self._blocked_until = 0.0

    def _limited(self, wait: float) -> NoReturn:
        raise TrackerRateLimited(
            "The request limit of your Linear account is nearly used up.", math.ceil(wait)
        )

    def _keep(self, response: httpx.Response, now: float) -> None:
        """Waits for the reset once a tenth of the requests or the points is left."""
        for kind in ("requests", "complexity"):
            limit = response.headers.get(f"x-ratelimit-{kind}-limit", "")
            left = response.headers.get(f"x-ratelimit-{kind}-remaining", "")
            reset = response.headers.get(f"x-ratelimit-{kind}-reset", "")
            readable = limit.isdigit() and left.isdigit() and reset.isdigit()
            if readable and int(left) <= int(limit) * KEEP:
                self._blocked_until = max(self._blocked_until, int(reset) / 1000)
        if self._blocked_until <= now:
            self._blocked_until = 0.0

    def query(self, text: str, variables: dict | None = None) -> tuple[dict | None, list]:
        """The answer's data and errors; raises on what no caller can use."""
        now = self._clock()
        if now < self._blocked_until:
            self._limited(self._blocked_until - now)
        try:
            response = self._client.post(
                API_URL,
                json={"query": text, "variables": variables or {}},
                headers={"Authorization": self._key, "User-Agent": "tiko"},
            )
        except httpx.TimeoutException as exc:
            raise TrackerUnreachable("Linear did not answer in time.") from exc
        except httpx.TransportError as exc:
            raise TrackerUnreachable("Linear is unreachable. Check your network.") from exc
        try:
            body = response.json()
        except ValueError:
            body = {}
        if not isinstance(body, dict):
            body = {}
        errors = body.get("errors") or []
        codes = {(e.get("extensions") or {}).get("code") for e in errors if isinstance(e, dict)}
        if response.status_code == 401 or "AUTHENTICATION_ERROR" in codes:
            raise LinearRejected(REJECTED)
        if response.status_code == 429 or "RATELIMITED" in codes:
            retry = response.headers.get("retry-after", "")
            wait = float(retry) if retry.isdigit() else DEFAULT_RETRY_AFTER_S
            self._blocked_until = now + wait
            self._limited(wait)
        if response.status_code >= 500:
            raise TrackerUnavailable(f"Linear returned {response.status_code}")
        self._keep(response, now)
        data = body.get("data")
        if data is None and not _not_found(errors):
            raise TrackerUnavailable("Linear returned an unexpected response.")
        return data, errors


class LinearProvider:
    """A person's Linear workspace, read with their own API key."""

    source_id = LINEAR
    source_name = "Linear"
    source_note = None
    base_host = "linear.app"

    def __init__(self, api: LinearApi, clock: Callable[[], float] = time.time) -> None:
        self._api = api
        self._clock = clock
        # The workspace's slug and its old ones, with when they were read.
        self._workspaces: tuple[set[str], float] = (set(), 0.0)
        # By identifier: the last answer and when it came.
        self._seen: dict[str, tuple[dict, float]] = {}
        self._missing: dict[str, float] = {}

    def _viewer(self) -> dict:
        data, _ = self._api.query(_VIEWER)
        if not data or not data.get("viewer") or not data.get("organization"):
            raise TrackerUnavailable("Linear returned an unexpected response.")
        org = data["organization"]
        slugs = {org["urlKey"], *(org.get("previousUrlKeys") or [])}
        self._workspaces = ({s.lower() for s in slugs}, self._clock())
        return data

    def _mine(self, workspace: str) -> bool:
        slugs, read_at = self._workspaces
        if not slugs or self._clock() - read_at > VIEWER_S:
            self._viewer()
            slugs = self._workspaces[0]
        return workspace in slugs

    def check(self) -> str:
        data = self._viewer()
        return f"{data['viewer']['name']} in {data['organization']['name']}"

    def _single(self, identifier: str) -> dict | None:
        data, _ = self._api.query(_ISSUE, {"id": identifier})
        return (data or {}).get("issue")

    def resolve(self, key: str) -> Task:
        workspace, _, identifier = key.partition("/")
        if not self._mine(workspace):
            raise TaskNotFound("This issue is in another Linear workspace.")
        issue = self._single(identifier)
        if issue is None:
            raise TaskNotFound(f"Linear has no issue {identifier} that you can read.")
        self._seen[identifier] = (issue, self._clock())
        return _task(key, issue)

    def _fetch(self, identifiers: list[str]) -> None:
        now = self._clock()
        for start in range(0, len(identifiers), PAGE):
            page = identifiers[start : start + PAGE]
            data, _ = self._api.query(_ISSUES, {"ids": page, "first": PAGE})
            for issue in ((data or {}).get("issues") or {}).get("nodes") or []:
                self._seen[issue["identifier"]] = (issue, now)
        # An issue moved to another team answers under its new identifier; ask by the old one.
        asked = 0
        for identifier in identifiers:
            fresh = self._seen.get(identifier)
            if fresh and fresh[1] >= now:
                continue
            if asked == SINGLES_PER_POLL or now - self._missing.get(identifier, -MISS_S) < MISS_S:
                continue
            asked += 1
            if issue := self._single(identifier):
                self._seen[identifier] = (issue, now)
                self._missing.pop(identifier, None)
            else:
                self._missing[identifier] = now

    def poll(self, keys: list[str]) -> list[Task]:
        now = self._clock()
        mine = [k for k in keys if self._mine(k.partition("/")[0])]
        stale = [
            k.partition("/")[2]
            for k in mine
            if now - self._seen.get(k.partition("/")[2], ({}, -FRESH_S))[1] >= FRESH_S
        ]
        if stale:
            self._fetch(sorted(set(stale)))
        found = []
        for key in keys:
            seen = self._seen.get(key.partition("/")[2]) if key in mine else None
            if seen:
                found.append(_task(key, seen[0]))
            else:
                found.append(
                    Task(
                        source=LINEAR,
                        key=key,
                        state="not_found",
                        url=linear_url(key),
                        fetched_at=now_iso(),
                    )
                )
        return found

    def _no_query(self, *_: object) -> NoReturn:
        raise ValidationFailed("Linear has no query here yet: add a card by its link.")

    search = jql_vocabulary = jql_values = _no_query


class LinearReaders:
    """One provider per person, kept between requests so its answers and pace last."""

    def __init__(self, client: httpx.Client, clock: Callable[[], float] = time.time) -> None:
        self._client = client
        self._clock = clock
        self._own: PersonalReaders[LinearProvider] = PersonalReaders(clock)

    def of(self, user_id: str, key: str) -> LinearProvider:
        return self._own.of(user_id, key, lambda: self._provider(key))

    def _provider(self, key: str) -> LinearProvider:
        return LinearProvider(LinearApi(self._client, key, self._clock), self._clock)

    def login(self, key: str) -> str:
        """Who the key signs in as, asked before it is saved."""
        try:
            return self._provider(key).check()
        except LinearRejected as exc:
            raise ValidationFailed("token: Linear did not accept this key") from exc
