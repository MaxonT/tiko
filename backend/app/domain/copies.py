"""Copies of a board saved before a key with full access changes people's work (spec 055)."""

from typing import Any, Literal

from pydantic import BaseModel

from app.domain.boards import BoardDoc
from app.domain.live import from_board

KEEP = 20
KEEP_DAYS = 14
Reason = Literal["key", "restore"]
Stored = dict[str, dict[str, Any]]


class CopyInfo(BaseModel):
    id: str
    saved_at: str
    by_user_id: str | None
    by_name: str | None
    reason: Reason
    elements: int


class Copy(BaseModel):
    info: CopyInfo
    doc: BoardDoc


class Written(BaseModel):
    """People's elements and arrows as keys last wrote them since the newest copy: unchanged
    since, they need no copy of their own."""

    nodes: dict[str, Any] = {}
    edges: dict[str, Any] = {}


class Latest(BaseModel):
    id: str
    doc: BoardDoc
    written: Written = Written()


def _plain(node: dict[str, Any] | None) -> dict[str, Any] | None:
    # Stacking order is renumbered on every save; it is no part of what a person made.
    return None if node is None else {k: v for k, v in node.items() if k != "order"}


def holds(latest: Latest | None, nodes: Stored, edges: Stored, ids: list[str]) -> bool:
    """Whether each of these elements and arrows stands now as the newest copy has it, or as a
    key wrote it after that copy: then no work of people's is missing from every copy."""
    if latest is None:
        return False
    kept_nodes, kept_edges = from_board(latest.doc)
    written = latest.written
    for element_id in ids:
        if element_id in edges:
            now = edges[element_id]
            if now not in (kept_edges.get(element_id), written.edges.get(element_id)):
                return False
            continue
        now = _plain(nodes.get(element_id))
        if now not in (_plain(kept_nodes.get(element_id)), _plain(written.nodes.get(element_id))):
            return False
    return True


def written(nodes: Stored, edges: Stored, ids: list[str]) -> Written:
    """What a call left of the people's work it overwrote; removed ones are absent."""
    return Written(
        nodes={i: _plain(nodes[i]) for i in ids if nodes.get(i) is not None},
        edges={i: edges[i] for i in ids if i in edges},
    )


def same(latest: Latest | None, nodes: Stored, edges: Stored) -> bool:
    """Whether the newest copy is the board as it stands now."""
    if latest is None:
        return False
    kept_nodes, kept_edges = from_board(latest.doc)
    now = {k: _plain(v) for k, v in nodes.items() if v is not None}
    return {k: _plain(v) for k, v in kept_nodes.items()} == now and kept_edges == edges
