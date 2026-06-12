"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendarStore } from "@/lib/calendar/store";
import type { CalendarView } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { ImportExportMenu } from "./ImportExportMenu";
import type { CalendarEventUI } from "@/lib/types/calendar-event";
import { runCalendarSync, formatSyncSummary } from "@/lib/sync/run-sync";
import { markAutoSync } from "@/lib/sync/sync-scheduler";
import { toast } from "sonner";

interface CalendarToolbarProps {
  onCreateEvent: () => void;
  className?: string;
  events?: CalendarEventUI[];
}

export function CalendarToolbar({
  onCreateEvent,
  className,
  events = [],
}: CalendarToolbarProps) {
  const { currentDate, view, setView, goToToday, next, prev } =
    useCalendarStore();
  const { trigger } = useHaptic();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    trigger("toggle");
    setIsSyncing(true);
    markAutoSync();
    const toastId = toast.loading("Syncing calendar…");
    try {
      const summary = await runCalendarSync();
      if (summary.configured === 0) {
        toast.info("No calendars configured yet. Connect a calendar first.", {
          id: toastId,
        });
      } else if (summary.errors.length) {
        toast.error(`Sync completed with errors: ${summary.errors[0]}`, {
          id: toastId,
        });
      } else {
        toast.success(formatSyncSummary(summary), { id: toastId });
        trigger("success");
      }
      // Refetch so pulled/pushed changes appear without a manual reload
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch {
      toast.error("Sync failed", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // We render all options and use CSS to hide desktop/mobile specific ones
  const availableViews: {
    value: CalendarView;
    label: string;
    className?: string;
  }[] = [
    { value: "year", label: "Year", className: "hidden md:flex" },
    { value: "month", label: "Month" },
    { value: "week", label: "Week", className: "hidden md:flex" },
    { value: "4day", label: "4-Day", className: "hidden md:flex" },
    { value: "3day", label: "3-Day", className: "flex md:hidden" },
    { value: "day", label: "Day" },
    { value: "schedule", label: "Schedule" },
  ];

  const renderDateLabel = () => {
    switch (view) {
      case "year":
        return format(currentDate, "yyyy");
      case "month":
        return (
          <>
            <span className="md:hidden">{format(currentDate, "MMM yyyy")}</span>
            <span className="hidden md:inline">
              {format(currentDate, "MMMM yyyy")}
            </span>
          </>
        );
      case "week":
      case "3day":
      case "4day":
        return format(currentDate, "MMM yyyy");
      case "day":
        return (
          <>
            <span className="md:hidden">{format(currentDate, "MMM d")}</span>
            <span className="hidden md:inline">
              {format(currentDate, "EEEE, MMMM d, yyyy")}
            </span>
          </>
        );
      case "schedule":
        return "Schedule";
      default:
        return format(currentDate, "MMMM yyyy");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-row items-center justify-between gap-1 px-4 py-3 border-b bg-background/60 backdrop-blur-xl sticky top-0 z-20 shadow-sm overflow-hidden overscroll-x-none",
        "h-[60px] md:h-[68px]",
        className,
      )}
    >
      {/* Left Cluster: Navigation on desktop / Nav Cluster on mobile */}
      <div
        className={cn("flex-initial lg:flex-1 flex items-center gap-2 min-w-0")}
      >
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="default"
            onClick={() => {
              trigger("tick");
              goToToday();
            }}
            className="h-9 bg-secondary/40 hover:bg-secondary/60 border border-border/50 shadow-none transition-seijaku-fast text-[13px] font-medium rounded-lg px-3 lg:px-3"
          >
            <CalendarIcon className="h-4 w-4 lg:mr-2" strokeWidth={2.25} />
            <span className="hidden lg:inline">Today</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous period"
              className="h-9 w-9 shadow-none transition-seijaku-fast rounded-full"
              onClick={() => {
                trigger("tick");
                prev();
              }}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next period"
              className="h-9 w-9 shadow-none transition-seijaku-fast rounded-full"
              onClick={() => {
                trigger("tick");
                next();
              }}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation - Only show Today button as swipe is enabled */}
        <div className="flex md:hidden items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go to today"
            className="h-9 w-9 bg-secondary/40 hover:bg-secondary/60 border border-border/50 shadow-none transition-seijaku-fast rounded-lg"
            onClick={() => {
              trigger("tick");
              goToToday();
            }}
          >
            <CalendarIcon className="h-4 w-4" strokeWidth={2.25} />
          </Button>
        </div>
      </div>

      {/* Middle: Date Label - Centered between clusters on mobile, absolute on desktop */}
      <div
        className={cn(
          "lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2",
          "flex-1 lg:flex-none flex items-center justify-center min-w-0 px-2 z-10 pointer-events-none",
        )}
      >
        <div
          className={cn(
            "font-semibold tracking-tight truncate",
            "text-base font-bold lg:text-[28px] lg:tracking-[-0.03em] lg:font-semibold",
          )}
        >
          {renderDateLabel()}
        </div>
      </div>

      {/* Right Cluster: View Select + Menu */}
      <div className="flex-initial lg:flex-1 flex items-center gap-1 md:gap-1.5 min-w-0 justify-end">
        <Select
          value={view}
          onValueChange={(v) => {
            trigger("toggle");
            setView(v as CalendarView);
          }}
        >
          <SelectTrigger
            className={cn(
              "h-9 text-[13px] px-2 md:px-3 font-medium bg-secondary/40 border-border/50 shadow-none hover:bg-secondary/60 transition-seijaku-fast shrink-0 rounded-lg",
              "w-[94px] md:w-[110px]",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0 shadow-none border-border/80">
            {availableViews.map((viewOption) => (
              <SelectItem
                key={viewOption.value}
                value={viewOption.value}
                className={cn("text-[13px] pr-6", viewOption.className)}
              >
                {viewOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Desktop Right Menu Items */}
        <div className="hidden md:flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            title="Sync calendars"
            className="h-9 w-9 p-0 items-center justify-center bg-secondary/40 hover:bg-secondary/60 border border-border/50 shadow-none rounded-lg"
          >
            <RefreshCw
              className={cn("h-4 w-4", isSyncing && "animate-spin")}
              strokeWidth={2.25}
            />
          </Button>

          <Button
            size="sm"
            onClick={() => {
              trigger("tick");
              onCreateEvent();
            }}
            className="h-9 items-center gap-2 px-4 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 border-none shadow-sm shadow-brand/10 transition-seijaku shrink-0 text-[13px] font-semibold"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            <span>New Event</span>
          </Button>
        </div>

        <ImportExportMenu events={events} />
      </div>
    </div>
  );
}
