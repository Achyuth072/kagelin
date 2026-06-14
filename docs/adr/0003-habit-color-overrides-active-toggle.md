# Habit surfaces fill with the habit's own color, not brand indigo

DESIGN_SYSTEM's default is that active/selected toggles use brand indigo. For
**habit** surfaces we deliberately override this: completed toggles and the
compact-view day-cells fill with `habit.color` (the per-habit Entity Palette
value), with a brand-indigo treatment reserved for non-entity controls.

We chose per-entity color over brand consistency because habits are
user-personalized — the color _is_ the habit's identity, the heatmap and the
existing `HabitCard` toggle already fill with it, and a wall of identical indigo
cells would erase the per-habit distinction the color exists to provide.

This is recorded because a reader of DESIGN_SYSTEM would otherwise see arbitrary
colored toggles as a violation and "fix" them back to indigo. The override is
intentional and scoped to habit entities; it does not generalize to tasks,
projects, or other toggles.
