# Codex Task Protocol

## Required Context

- Before any task, read:
  - `docs/EDIO_PROJECT_CONTEXT.md`
  - `docs/CODEX_TASK_PROTOCOL.md`
  - `docs/PROMPT_SYSTEM.md`

## Context Budget Mode

- Do not inspect the whole project.
- Inspect only files directly related to the current task.
- Prefer targeted `rg` searches and small file excerpts.
- Do not read old Task Specs unless explicitly requested.
- Open large files only when necessary.

## Execution Rules

- Apply the smallest safe change.
- Do not break existing routes or components.
- Do not delete routes or components.
- Do not change unrelated files.
- Do not print secrets or tokens.
- Do not save secrets in files.
- Browser tests must run inside Codex only.

## Fast Safe Update Mode

- Do not delete `.git`.
- Do not reinitialize repositories when `.git` already exists.
- Do not recreate the deploy repository from scratch unless strictly necessary.
- Do not deploy if build or safety checks fail.

## Checks By Task Size

- Small: typecheck and build.
- Medium: lint, typecheck, related tests, and build.
- Critical: targeted audits plus build/tests as needed.
