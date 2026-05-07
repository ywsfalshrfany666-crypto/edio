# Prompt System

## Long Prompt Handling

- Do not execute a long prompt directly from chat only.
- Convert each long prompt into a Task Spec inside `docs/TASK_SPECS/`.
- The Task Spec should include:
  - Goal
  - Scope
  - Files allowed
  - Do not touch
  - Checks
  - Final report format

## Execution Brief

- Create an Execution Brief of 250 words or less before implementation.
- Update `docs/TASK_INDEX.md` with one line for the current Task Spec.
- Execute only from the three context files and the current Task Spec.

## Context Economy

- Reduce context usage aggressively.
- Use targeted `rg`/`grep` before opening files.
- Read only directly relevant files and small excerpts.
- Do not read all old Task Specs unless explicitly requested.
- Do not inspect the full project unless the task cannot be completed otherwise.
