export type StatsPeriod = "7d" | "30d" | "90d" | "1y" | "all";

export const PERIOD_DAY_COUNT: Record<Exclude<StatsPeriod, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export const STATS_PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];
