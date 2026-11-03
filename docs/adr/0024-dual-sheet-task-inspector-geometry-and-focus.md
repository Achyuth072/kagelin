---
status: accepted
---

# Dual-sheet task inspector geometry, breakpoint, and focus model

On desktop List view, Kagelin previously mounted a permanent 40% side pane that rendered an empty placeholder when no task was selected, while stealing DOM focus into the title field on selection. On viewports below 1280px, the 40% pane became too narrow (253px usable width after cushion), clipping footer actions and project pickers.

## Decisions

- **Dynamic slide-in mounting at ≥1280px.** The root execution list occupies 100% of the screen by default. Selecting a task smoothly animates the side inspector into view using `--ease-seijaku` transitions matching the app sidebar (`transition-[width] duration-200`). Clicking the topbar, sidebar, empty canvas, or pressing `Escape` dismisses the pane back to 100% width.
- **Top edge aligned with task card baseline (`pt-2`).** The inspector container top padding is standardized to `pt-2` (8px), aligning pixel-perfect with the `first:mt-2` baseline of the task card stack and Kanban columns.
- **Board View uses an unblurred Overlay Drawer.** To preserve the horizontal integrity of multi-column Kanban boards without squeezing columns into a narrow horizontal scroll, the inspector in Board view mounts as a floating 440px overlay drawer with zero background blur. Background columns remain 100% sharp and readable.
- **Vim list navigation focus retention.** Docked inspection sets `autoFocusTitle: false` so that DOM focus remains on the list scroll container. Users can continuously navigate and toggle tasks (`j`, `k`, `x`, `d`) while inspecting details. Pressing `Enter` or `o` enters the editor; `Escape` exits.
- **Breakpoint threshold raised to ≥1280px.** Below 1280px, all viewports (mobile and tablet) route through the unified modal sheet (`TaskSheet`), eliminating redundant intermediate dialog implementations and button clipping.
- **URL reflection via `replaceState`.** Desktop docked inspection updates `?task=<id>` via `window.history.replaceState` without pushing browser history entries, surviving reload while keeping the browser back stack clean. Mobile modal inspection preserves ADR 0011 synthetic back anchors.

## Considered Options

- **Permanent 40% empty pane on desktop.** Rejected: personal daily task management is an execution flow, not a 500-ticket backlog. An empty box wastes 40% of screen real estate.
- **Squishing Kanban boards to 60% in Board View.** Rejected: Kanban boards are intrinsically horizontal. Compressing width to 60% cuts visible columns from 4+ to ~2, forcing awkward horizontal scrolling.
- **Auto-focusing title in docked side pane.** Rejected: steals DOM focus immediately upon selection, breaking `j`/`k`/`x`/`d` keyboard traversal and typing navigation keys into the task title.
- **Bento / Masonry Grid View.** Permanently rejected: tasks are homogeneous text records without variable aspect-ratio media; masonry breaks baseline scannability.

## Consequences

- `SplitViewLayout` as an outer wrapper in `HomeClient` is eliminated; a single task container manages layout switches internally without remounting the task tree.
- Desktop users gain full-width list scannability until inspection is needed.
- Board view retains full visibility of all columns during card inspection.
- Vim keyboard traversal remains unbroken when inspecting tasks.
