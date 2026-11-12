"use client";

import { useMemo, useRef, useLayoutEffect, useCallback } from "react";
import { ActivityCalendar, type Activity } from "react-activity-calendar";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHeatmapData } from "@/lib/hooks/useHeatmapData";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { cn } from "@/lib/utils";

const BRAND_SCALE = [
  "hsl(var(--secondary))",
  "hsl(var(--brand) / 0.25)",
  "hsl(var(--brand) / 0.5)",
  "hsl(var(--brand) / 0.75)",
  "hsl(var(--brand))",
];

const CALENDAR_LABELS = {
  months: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  legend: {
    less: "Less",
    more: "More",
  },
};

interface ActivityHeatmapProps {
  className?: string;
}

export function ActivityHeatmap({ className }: ActivityHeatmapProps) {
  const { data, isLoading, maxValue, activeDays } = useHeatmapData();
  const { resolvedTheme } = useTheme();

  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useHorizontalScroll();

  // Combine refs: useHorizontalScroll for desktop wheel, manual ref for mobile auto-scroll
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      if (!isMobile) {
        horizontalScrollRef(node);
      } else {
        horizontalScrollRef(null);
      }
      (
        scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = node;
    },
    [horizontalScrollRef, isMobile],
  );

  // Transform data to react-activity-calendar format
  const calendarData: Activity[] = useMemo(() => {
    // Ensure at least today is represented to prevent "Activity data must not be empty" crash
    const today = new Date().toISOString().split("T")[0];
    const rawData = data || [];

    // Map existing data points
    const heatmapMap = new Map<string, number>(
      rawData.map((d) => [d.date, d.combined]),
    );

    // Always anchor with today to ensure the chart has a latest date
    if (!heatmapMap.has(today)) {
      heatmapMap.set(today, 0);
    }

    const maxVal = maxValue?.combined || 1; // Prevent division by zero

    return Array.from(heatmapMap.entries())
      .map(([date, combined]) => ({
        date,
        count: combined,
        level:
          combined === 0
            ? 0
            : (Math.min(Math.ceil((combined / maxVal) * 4), 4) as
                0 | 1 | 2 | 3 | 4),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, maxValue?.combined]);

  // Auto-scroll to current date (right end) on mobile only
  // Using calendarData.length as dependency to avoid "changed size" errors
  // with certain dev-tooling/HMR scenarios, and to ensure it scrolls when data arrives.
  useLayoutEffect(() => {
    if (!isMobile) return;

    const frame = requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft =
          scrollContainerRef.current.scrollWidth;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [calendarData.length, isMobile, isLoading]);

  const theme = useMemo(
    () => ({
      dark: BRAND_SCALE,
      light: BRAND_SCALE,
    }),
    [],
  );

  // Custom tooltip render function
  const renderTooltip = (activity: Activity) => {
    const point = data.find((d) => d.date === activity.date);
    if (!point) return activity.date;
    return `${activity.date}: ${point.focus}h focus • ${point.tasks} tasks`;
  };

  if (isLoading) {
    return (
      <Card className={cn("p-4 sm:p-6 border-border/50", className)}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn("p-4 sm:p-6 border-border/50 overflow-hidden", className)}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Activity Heatmap
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeDays} active days in the past year
            </p>
          </div>
        </div>

        <div className="relative">
          <TooltipProvider delayDuration={100}>
            <div
              ref={setRefs}
              className="w-full overflow-x-auto pb-4 custom-scrollbar min-w-0"
            >
              <div className="w-max mx-auto">
                <ActivityCalendar
                  data={calendarData}
                  theme={theme}
                  colorScheme={(resolvedTheme as "light" | "dark") || "light"}
                  blockSize={15}
                  blockMargin={5}
                  blockRadius={2}
                  fontSize={13}
                  showColorLegend={true}
                  showMonthLabels={true}
                  showTotalCount={false}
                  labels={CALENDAR_LABELS}
                  renderBlock={(block, activity) => {
                    const tooltip = renderTooltip(activity);
                    return (
                      <Tooltip key={activity.date}>
                        <TooltipTrigger asChild>{block}</TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-popover text-popover-foreground border-border/60 text-[12px] font-medium px-2.5 py-1"
                        >
                          {tooltip}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }}
                />
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
}
