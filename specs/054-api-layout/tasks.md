---
description: "Task list for predictable layout for agents"
---

# Tasks: Predictable layout for agents

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Tests**: every person, board and task in fixtures is made-up.

## Phase 1: Slice `feat/api-layout`

- [x] T001 `batch.py`: reminders follow their element, `on`, free reminders in frames. Domain tests in `test_batch_layout.py`
- [x] T002 `batch.py`, `layout.py`: `columns`, `order`, `fit`. Domain tests
- [x] T003 `api_view.py`, `boards.py`: card size, filters, compact. API tests in `test_api_v1_read.py`
- [x] T004 MCP fields and descriptions; MCP test
- [x] T005 Contract `api-v1.md`, OpenAPI snapshot, guide `api.md`, `ai-agents.md`, CHANGELOG
- [x] T006 By hand against a local stack, recorded in the PR
