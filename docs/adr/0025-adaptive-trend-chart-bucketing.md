# 0025: Adaptive trend chart bucketing for long time horizons

## Context

When viewing the Focus & Task Trend chart on `/stats` with longer horizons (90 days, 1 year, All time), passing raw daily points (up to 365+ on 1Y) produced sub-pixel density (<1px per day on mobile), extreme high-frequency vertical noise ("seismograph effect" due to weekday/weekend cyclical variance), and made touch targets on mobile impossible to scrub accurately.

## Considered options

- **Downsample via uniform Nth-point skipping (decimation)** — rejected: drops critical activity spikes and produces misleading trends.
- **Continuous 7-day or 14-day rolling average spline on raw daily points** — rejected: while smoothing the visual line, touch targets on 365 daily points remained sub-pixel on mobile screens, and the hover tooltip still triggered across 50 data points per finger tap.
- **Bar chart for long periods** — rejected: clustered dual bars (hours + tasks) crowd horizontal space on mobile and break the consistent ComposedChart visual language.
- **Mutate `useStats` data layer** — rejected: `stats.dailyTrend` is relied upon by `ProjectionsCard`, CSV rollups, and existing daily tests.

## Decision

1. **Automatic adaptive granularity at the presentation layer**:
   - `7d` and `30d` remain **Daily** (~7–30 points).
   - `90d` aggregates into **Weekly** buckets (~13 points), aligned Monday–Sunday.
   - `1y` and `all` aggregate into **Monthly** buckets (~12–24 points).
2. **Cumulative sum aggregation**:
   - Each bucket sums focus hours and tasks completed, presenting cumulative accomplishments.
   - The current in-progress week or month is included at the right edge and labeled as current so recent activity is immediately visible.
3. **Pure utility seam**:
   - Kept `useStats.ts` untouched. Aggregation is handled purely by `src/lib/utils/chart-aggregation.ts`.
4. **Mobile touch scrubbing UX**:
   - Touching/scrubbing on mobile swaps the card header to display the active bucket's values (`"Week of Oct 12: 24.5h focus • 18 tasks"`) with haptic ticks, reverting after a 1.5s idle timeout, while suppressing obstructive floating popovers.
