"""Reminders that follow their element, and arrange that fits its frame (spec 054)."""

import pytest

from app.domain.batch import Arrange, Batch, Change, NewElement, _absolute, plan
from app.domain.errors import NotFound, ValidationFailed

DUE = "2030-01-01T09:00:00.000Z"


def frame(x: float, y: float, w: float = 480, h: float = 320) -> dict:
    return {
        "type": "frame",
        "place": {"x": x, "y": y},
        "size": {"width": w, "height": h},
        "order": 1,
        "data": {"title": "F"},
    }


def note(x: float, y: float, parent: str | None = None) -> dict:
    place = {"x": x, "y": y} | ({"parentId": parent} if parent else {})
    size = {"width": 200, "height": 200}
    return {"type": "sticky", "place": place, "size": size, "order": 2, "data": {"text": ""}}


def card(key: str, parent: str | None = None) -> dict:
    place = {"x": 0.0, "y": 0.0} | ({"parentId": parent} if parent else {})
    data = {"key": key, "source": "jira", "collapsed": False}
    return {"type": "task_card", "place": place, "size": {}, "order": 2, "data": data}


def timer(parent: str | None, watch: dict | None = None) -> dict:
    place = {"x": -46, "y": 0} | ({"parentId": parent} if parent else {})
    data = {"note": "", "dueAt": None if watch else DUE} | ({"watch": watch} if watch else {})
    return {"type": "timer", "place": place, "size": {"width": 40, "height": 40}, "order": 3} | {
        "data": data
    }


def board() -> dict:
    return {"f": frame(5000, 5000), "n": note(100, 100), "m": note(900, 100), "t": timer("n")}


@pytest.mark.parametrize("first", ["note", "reminder"])
def test_a_reminder_on_a_note_does_not_take_a_place_of_its_own(first):
    moves = [Change(id="n", frame="f", x=5100, y=5100), Change(id="t", x=5054, y=5100)]
    if first == "reminder":
        moves.reverse()
    with pytest.raises(ValidationFailed, match="moves with it"):
        plan(board(), {}, Batch(changes=moves, mine=["n", "t"]))


def test_a_reminder_goes_wherever_its_note_goes():
    moved, _, _ = plan(board(), {}, Batch(changes=[Change(id="n", frame="f", x=5100, y=5100)]))
    assert _absolute(moved, "t") == (5054, 5100)
    assert moved["t"]["place"]["parentId"] == "n"


def test_on_puts_a_reminder_on_another_element():
    moved, _, _ = plan(board(), {}, Batch(changes=[Change(id="t", on="m")]))
    assert moved["t"]["place"] == {"x": -46, "y": 0, "parentId": "m"}


def test_on_null_frees_a_reminder_where_it_stands():
    moved, _, _ = plan(board(), {}, Batch(changes=[Change(id="t", on=None)]))
    assert moved["t"]["place"] == {"x": 54, "y": 100}


def test_on_takes_an_element_a_reminder_can_sit_on():
    with pytest.raises(NotFound):
        plan(board(), {}, Batch(changes=[Change(id="t", on="f")]))
    with pytest.raises(ValidationFailed, match="not both"):
        plan(board(), {}, Batch(changes=[Change(id="t", on="m", x=1, y=1)]))
    with pytest.raises(ValidationFailed, match="only a reminder"):
        plan(board(), {}, Batch(changes=[Change(id="n", on="m")]))


def test_a_status_reminder_stays_on_its_task_card():
    watch = {"key": "DEMO-1", "source": "jira", "status": "To Do"}
    nodes = {"a": card("DEMO-1"), "b": card("DEMO-2"), "c": card("DEMO-1"), "n": note(0, 0)}
    nodes["t"] = timer("a", watch)
    for to in ("b", "n", None):
        with pytest.raises(ValidationFailed, match="task's card"):
            plan(nodes, {}, Batch(changes=[Change(id="t", on=to)]))
    moved, _, _ = plan(nodes, {}, Batch(changes=[Change(id="t", on="c")]))
    assert moved["t"]["place"]["parentId"] == "c"


def test_a_free_reminder_goes_into_a_frame_and_out():
    nodes = board() | {"t": timer(None)}
    moved, _, _ = plan(nodes, {}, Batch(changes=[Change(id="t", frame="f", x=5010, y=5020)]))
    assert moved["t"]["place"] == {"x": 10, "y": 20, "parentId": "f"}
    out, _, _ = plan(moved, {}, Batch(changes=[Change(id="t", frame=None)]))
    assert out["t"]["place"] == {"x": 5010, "y": 5020}


def test_a_new_free_reminder_takes_a_frame_and_a_place():
    add = NewElement(id="r", kind="timer", at=DUE, frame="f", x=5010, y=5020)
    made, _, _ = plan(board(), {}, Batch(adds=[add]))
    assert made["r"]["place"] == {"x": 10, "y": 20, "parentId": "f"}


def test_a_reminder_on_an_element_takes_no_place():
    with pytest.raises(ValueError, match="beside it"):
        NewElement(id="r", kind="timer", at=DUE, on="n", x=1, y=1)


def cards(n: int, parent: str | None = None) -> dict:
    return {f"c{i}": card(f"DEMO-{i}", parent) for i in range(1, n + 1)}


def arranged(nodes: dict, **request) -> dict:
    planned, _, _ = plan(nodes, {}, Batch(arrange=Arrange(**request)))
    return planned


def test_arrange_fits_columns_to_the_frame():
    nodes = {"f": frame(0, 0, w=1000)} | cards(5)
    planned = arranged(nodes, cards=list(cards(5)), frame_id="f")
    xs = sorted({planned[c]["place"]["x"] for c in cards(5)})
    assert xs == [24, 384]


def test_a_frame_narrower_than_a_card_gets_one_column():
    nodes = {"f": frame(0, 0, w=200)} | cards(3)
    planned = arranged(nodes, cards=list(cards(3)), frame_id="f")
    assert {planned[c]["place"]["x"] for c in cards(3)} == {24}


def test_columns_given_win():
    nodes = {"f": frame(0, 0, w=1000)} | cards(6)
    planned = arranged(nodes, cards=list(cards(6)), frame_id="f", columns=3)
    assert len({planned[c]["place"]["x"] for c in cards(6)}) == 3


def test_order_by_key_reads_numbers_as_numbers():
    nodes = {"a": card("DEMO-10"), "b": card("DEMO-9"), "c": card("ABC-2")}
    planned = arranged(nodes, cards=["a", "b", "c"], order="key", columns=1)
    by_y = sorted("abc", key=lambda c: planned[c]["place"]["y"])
    assert by_y == ["c", "b", "a"]


def test_order_by_status_then_key():
    nodes = {"a": card("DEMO-3"), "b": card("DEMO-1"), "c": card("DEMO-2")}
    statuses = {"a": (0, "To Do"), "b": (2, "Done"), "c": (0, "To Do")}
    planned = arranged(nodes, cards=["a", "b", "c"], order="status", columns=1, statuses=statuses)
    assert sorted("abc", key=lambda c: planned[c]["place"]["y"]) == ["c", "a", "b"]


def test_fit_shrinks_a_large_frame_and_grows_a_small_one():
    big = {"f": frame(0, 0, w=3000, h=3000)} | cards(2)
    planned = arranged(big, cards=list(cards(2)), frame_id="f", columns=2, fit=True)
    assert planned["f"]["size"] == {"width": 24 + 320 + 40 + 320 + 24, "height": 56 + 50 + 24}
    small = {"f": frame(0, 0, w=100, h=100)} | cards(4)
    planned = arranged(small, cards=list(cards(4)), frame_id="f", columns=4, fit=True)
    assert planned["f"]["size"]["width"] == 24 + 4 * 320 + 3 * 40 + 24


def test_fit_needs_a_frame():
    with pytest.raises(ValidationFailed, match="fit needs a frame"):
        arranged(cards(2), cards=list(cards(2)), fit=True)
