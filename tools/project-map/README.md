# Project Map MVP — how to reuse

This is a small **source-checked record → SVG + evidence index** pipeline. It does not infer code behavior, inspect running software, or replace normal tests.

## Data to write

Create `.project-map/map.json` in the calling repository. See [the working sample](../../.project-map/map.json).

- `groups`: named lanes
- `nodes`: ID, group, kind, title, what it does, capabilities, verification status, optional source anchor
- `edges`: directed relationships and optional source anchor
- `annotations`: observations, attempts, decisions or questions, with evidence references separate from the main flow

A source anchor is `{"path":"client.js","needle":"const readSelection = () => {"}`. The builder locates the **unique** matching line in the checked-out caller repository. A commit reference is `{"kind":"commit","sha":"<full 40-char SHA>"}`; the commit must exist in the caller's fetched Git history.

The allowed `verification` values are `source-inspected` and `unverified`. Neither means runtime verified. Edges lacking sources are explicitly counted as *declared only*.

## Reuse from another repository

Add this file in the **calling repository** at `.github/workflows/project-map.yml`:

```yaml
name: Project Map
on:
  workflow_dispatch:
  pull_request:
    paths:
      - '.project-map/**'
jobs:
  map:
    permissions:
      contents: read
    uses: anqifox/dsh-inline-quote/.github/workflows/project-map.yml@main
    with:
      records: .project-map/map.json
      engine_ref: main
```

`@main` is convenient for a trial. For reproducibility, replace **both** `@main` and `engine_ref: main` with the **same full commit SHA** of the shared tool. GitHub Reusable Workflows are native; the caller's code is checked out and no project data is pushed to the tool repository.

## Acceptance and observation

GitHub Actions → **Project Map** → run → `validate-render`:

1. Positive validation checks every file/line anchor, commit existence, and graph ID.
2. Negative self-tests must print `EXPECTED_REJECTION` for five failure classes followed by `SELF_TEST_PASS`.
3. The build must print `BUILD_PASS`, and the run must succeed.
4. The job summary exposes counts. Artifact `project-map-evidence` contains:
   - `overview.svg` — main flow only, annotated with counts
   - `notes.md` — node abilities, provenance, attempts and issues
   - `report.json` — machine-readable validated anchors/counts/revision
   - `overview.dot` — deterministic Graphviz intermediate

**Limitations:** a resolved code anchor confirms the text exists at that location, not that a causal link is semantically proven. Full Git history is required to validate historic commit references. Cross-repository calling was designed into the workflow, but requires a separate live call to claim end-to-end portability. Graph generation is not an automatic full codebase discovery system.

The MVP currently runs on a feature branch until reviewed; its historical PR run and artifacts provide acceptance evidence.
