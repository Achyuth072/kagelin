"use client";

import { useState } from "react";
import { Download, FileDown, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHaptic } from "@/lib/hooks/useHaptic";
import type { StatsData } from "@/lib/hooks/useStats";
import type { StatsPeriod } from "@/lib/types/stats";
import {
  analyticsFilename,
  dailyRollupToCsv,
  statsToExportJson,
  triggerDownload,
} from "@/lib/utils/stats-export";

interface StatsExportMenuProps {
  stats: StatsData | undefined;
  period: StatsPeriod;
}

export function StatsExportMenu({ stats, period }: StatsExportMenuProps) {
  const { trigger } = useHaptic();
  const [isExporting, setIsExporting] = useState<null | "csv" | "json">(null);

  const noData = !stats || stats.dailyTrend.length === 0;

  const handleExportCsv = () => {
    if (!stats) return;
    trigger("toggle");
    setIsExporting("csv");
    try {
      const csv = dailyRollupToCsv(stats.dailyTrend);
      triggerDownload(
        analyticsFilename("stats", "csv", { period }),
        csv,
        "text/csv",
      );
      toast.success("Stats exported as CSV");
      trigger("success");
    } catch (err) {
      console.error("CSV export failed:", err);
      toast.error("Failed to export CSV");
      trigger("thud");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportJson = () => {
    if (!stats) return;
    trigger("toggle");
    setIsExporting("json");
    try {
      const payload = statsToExportJson(stats, { period });
      triggerDownload(
        analyticsFilename("stats", "json", { period }),
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      toast.success("Stats exported as JSON");
      trigger("success");
    } catch (err) {
      console.error("JSON export failed:", err);
      toast.error("Failed to export JSON");
      trigger("thud");
    } finally {
      setIsExporting(null);
    }
  };

  const busy = isExporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={noData || busy}
          className="gap-2 h-9 border-border/60 hover:bg-secondary/40 transition-all font-medium"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          ) : (
            <Download className="h-4 w-4" strokeWidth={2.25} />
          )}
          <span className="hidden sm:inline">Export</span>
          <span className="sr-only">Export statistics</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 shadow-lg border-border/40"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Export analytics
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleExportCsv}
          disabled={isExporting === "csv"}
          className="cursor-pointer gap-2 py-2"
        >
          <FileDown className="h-4 w-4 text-brand" />
          <span>
            {isExporting === "csv" ? "Exporting…" : "Daily rollup (CSV)"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportJson}
          disabled={isExporting === "json"}
          className="cursor-pointer gap-2 py-2"
        >
          <FileJson className="h-4 w-4 text-brand" />
          <span>
            {isExporting === "json" ? "Exporting…" : "Full stats (JSON)"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
