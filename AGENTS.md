# Repository Guidelines

## Project Structure & Module Organization
This repository is a single-page Three.js web game.

- `index.html`: main entry page and UI shell (HUD, buttons, layout).
- `src/main.js`: core game logic, scene setup, rendering loop, input, spawning, collision.
- `scripts/serve.ps1`: local static server helper.
- `scripts/smoke.ps1`: HTTP smoke test (and optional headless check).
- `CHANGELOG.md`: iteration history for gameplay and scene updates.
- `readme.md`: run instructions and feature overview.

Keep gameplay logic in `src/main.js` and avoid scattering runtime logic into HTML.

## Build, Test, and Development Commands
No build pipeline is configured; this is a static project.

- Run locally:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\serve.ps1 -Port 4180`
- Smoke test:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\smoke.ps1 -Port 4180`
- Optional browser log attempt:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\smoke.ps1 -Port 4180 -TryConsoleCheck`

If `-TryConsoleCheck` fails in locked Windows environments, treat HTTP smoke pass plus manual browser verification as the baseline.

## Coding Style & Naming Conventions
- Use 2-space indentation in HTML/CSS/JS.
- JavaScript uses semicolons, double quotes, and `camelCase` identifiers.
- Use `UPPER_SNAKE_CASE` for true constants (for example storage keys).
- Keep functions focused and descriptive (`spawnObstacle`, `updateHud`).
- Add comments only for non-obvious logic (physics constants, render tuning).

## Testing Guidelines
There is no unit-test framework yet. Before submitting changes:

1. Run `scripts/smoke.ps1`.
2. Manually verify: Start/Pause flow, lane movement (keyboard + touch), collision, score/difficulty growth, resize behavior.
3. Confirm browser console has no new errors.

If you add automated tests, place them under `tests/` and document the new command in `readme.md`.

## Commit & Pull Request Guidelines
Git history is minimal (`init`), so keep commits concise and imperative (for example: `improve car body shading`).

- One logical change per commit.
- PRs should include:
  - what changed and why,
  - commands executed (with pass/fail),
  - screenshots or short GIFs for visual/gameplay changes,
  - updates to `CHANGELOG.md` for user-visible behavior changes.
