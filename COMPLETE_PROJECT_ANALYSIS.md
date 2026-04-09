# Complete Project Analysis (All Files)

Generated on: 2026-04-09  
Repository root: `d:\Rohit\hehe\worklenz`

## Coverage

- Total files analyzed: **1691**
- Inventory output: `repo_file_inventory.csv` (all files with extension, size, line count)
- Global scans generated:
  - `analysis_console_debug.txt`
  - `analysis_todo_fixme.txt`
  - `analysis_risky_api_usage.txt`

## Project Shape

- Frontend is the largest area and contains most complexity.
- Backend runtime path is currently `backend/server.js` -> `backend/src-new/*`.
- There are many one-off backend debug/fix scripts in `backend/` root.

### Top-level by file count

- `frontend`: 1516 files
- `backend`: 150 files
- `docs`: 6 files
- `ISSUE_TEMPLATE`: 5 files
- `nginx`: 2 files
- other root files/scripts: remaining

### File types

- `.tsx`: 551
- `.json`: 504
- `.ts`: 325
- `.js`: 145
- `.css`: 90

## Frontend Deep Map

- `frontend/src/components`: 318 files (largest UI surface)
- `frontend/src/pages`: 244 files
- `frontend/src/features`: 134 files
- `frontend/src/types`: 98 files
- `frontend/src/api`: 49 files
- `frontend/src/utils`: 48 files
- `frontend/src/hooks`: 24 files

Key signals:

- Parallel/legacy paths exist and are mixed in imports:
  - `projectView` and `project-view-1`
  - `schedule` and `schedule-old`
  - old or copy variants (`task-list-table-old`, `* copy.json`, `*.old.tsx`)
- Duplicate base filenames detected across areas: 36
- Frontend build succeeds (verified), but chunking is heavy:
  - `antd` chunk ~2.19 MB
  - Several large chunks > 1 MB warning threshold

## Backend Deep Map

- `backend/src-new/routes`: 34 files
- `backend/src-new/controllers`: 15 files
- `backend/src-new/models`: 22 files
- `backend/src-new/middlewares`: 4 files
- `backend/src-new/sockets`: 1 large file

Key signals:

- Runtime code has permissive behavior meant for development:
  - CORS callback currently allows non-whitelisted origins
  - rate limit max is very high in constants
- Sync file I/O exists in request/auth logging paths
- Default secret fallbacks exist in code (development-safe but risky in production if env missing)
- Hardcoded invite URL in projects controller (`localhost:5173`) should be env-driven

## Risk/Quality Scan Results

- Console/debugger matches: **1121**
  - many are in backend utility/debug scripts and some runtime files
- TODO/FIXME/HACK/XXX matches: **13**
- Risky API usage matches: **3**
  - `backend/src-new/app.js` uses `appendFileSync` for request log
  - `backend/src-new/controllers/auth.controller.js` uses `appendFileSync`
  - `backend/debug-teams.js` uses `writeFileSync`

## Build/Test Status

### Frontend

- `npm run build`:
  - first attempt in sandbox failed with `spawn EPERM`
  - rerun outside sandbox succeeded
  - additional warnings:
    - browserslist data outdated
    - unresolved runtime references: `/critical-image.webp`, `/fonts/inter-var.woff2`
    - large chunk warnings

### Backend

- `npm test -- --runInBand`:
  - no tests discovered
  - Jest haste collision due to two `package.json` files:
    - `backend/package.json`
    - `backend/src-new/package.json`

## Heaviest/Most Complex Files (Priority for manual review)

- `frontend/src/pages/projects/projectView/taskList/task-list-table/task-list-table.tsx`
- `frontend/src/components/task-management/task-row.tsx`
- `frontend/src/components/task-management/improved-task-filters.tsx`
- `frontend/src/components/task-management/task-list-board.tsx`
- `frontend/src/features/task-management/task-management.slice.ts`
- `frontend/src/hooks/useTaskSocketHandlers.ts`
- `backend/src-new/controllers/projects.controller.js`
- `backend/src-new/controllers/tasks.controller.js`
- `backend/src-new/controllers/reporting.controller.js`
- `backend/src-new/sockets/index.js`

## Immediate Fix Priorities (Recommended Order)

1. Normalize environment/config behavior
   - Replace hardcoded URLs with env-based config.
   - Remove production fallback secrets where possible.

2. Stabilize backend runtime safety
   - Replace sync FS logging with async/logger abstraction.
   - Tighten CORS behavior by environment.
   - Revisit permissive rate limits for production profile.

3. Remove architecture drift
   - Decide canonical paths for project view/schedule modules.
   - Decommission `old/copy` implementations gradually.

4. Improve delivery confidence
   - Add backend test baseline and avoid Jest package-name collision.
   - Add CI checks for build + lint + tests.

5. Performance hardening
   - Further split `antd` and project-insights heavy chunks.
   - Address unresolved runtime asset references.

## Existing Working Tree Note

This repository currently has many modified files before this analysis run.  
Those modifications were not reverted or altered by this report generation.
