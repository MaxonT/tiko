"""Print the public API v1 schema for the guide's reference (docs/guide/openapi.json)."""

import json
import re

from starlette.datastructures import State

from app.api.v1 import create

TAGS = {"key": "Key", "boards": "Boards", "writing": "Writing", "tasks": "Tasks", "planning": "Planning"}


def schema() -> dict:
    out = create(State()).openapi()
    out["info"]["description"] = (
        "Read and arrange your boards and search your tasks. "
        "Every call needs an API key from Settings → API keys in the `Authorization: Bearer` header."
    )
    # The reference names the scheme on every page; FastAPI's class name says nothing to a reader.
    schemes = out["components"]["securitySchemes"]
    schemes["API key"] = {
        **schemes.pop("HTTPBearer"),
        "description": (
            "Send an API key in the `Authorization` header of every call:\n\n"
            "```\nAuthorization: Bearer tiko_…\n```\n\n"
            "Make one in Settings → API keys, for all your boards or only the ones you pick. "
            "See [API keys](/api-keys/) for what a key may do and how long it lives."
        ),
    }
    for item in out["paths"].values():
        for op in item.values():
            op["security"] = [{"API key": []}]
    # Code samples need a host; this is where the README's quick start puts tiko.
    out["servers"] = [{"url": "http://localhost:3000/api/v1", "description": "Your tiko"}]
    # FastAPI names operations like read_board_boards__board_id__get; the reference puts ids in URLs.
    seen: set[str] = set()
    for item in out["paths"].values():
        for op in item.values():
            slug = re.sub(r"[^a-z0-9]+", "-", op["summary"].lower()).strip("-")
            if slug in seen:
                slug = f"{op['tags'][0]}-{slug}"
            seen.add(slug)
            op["operationId"] = slug
            op["tags"] = [TAGS.get(tag, tag.capitalize()) for tag in op["tags"]]
    return out


if __name__ == "__main__":
    print(json.dumps(schema(), indent=2, ensure_ascii=False))
