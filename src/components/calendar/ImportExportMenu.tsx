"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MoreVertical,
  FileDown,
  FileUp,
  Loader2,
  RefreshCw,
  CalendarSync,
} from "lucide-react";
import { runCalendarSync, formatSyncSummary } from "@/lib/sync/run-sync";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConnectCalendarDialog } from "./ConnectCalendarDialog";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useCreateCalendarEvent } from "@/lib/hooks/useCalendarEventMutations";
import { parseICSFile } from "@/lib/utils/ics-parser";
import { downloadICS } from "@/lib/utils/ics-generator";
import type { CalendarEventUI } from "@/lib/types/calendar-event";
import { toast } from "sonner";

interface ImportExportMenuProps {
  events: CalendarEventUI[];
}

export function ImportExportMenu({ events }: ImportExportMenuProps) {
  const { trigger } = useHaptic();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createEvent = useCreateCalendarEvent();
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const handleSync = async () => {
    trigger("toggle");
    setIsSyncing(true);
    try {
      const summary = await runCalendarSync();
      if (summary.configured === 0) {
        toast.info("No calendars configured yet. Connect a calendar first.");
      } else if (summary.errors.length) {
        toast.error(`Sync completed with errors: ${summary.errors[0]}`);
      } else {
        toast.success(formatSyncSummary(summary));
        trigger("success");
      }
      // Refetch so pulled/pushed changes appear without a manual reload
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    trigger("thud");
    try {
      downloadICS(events);
      toast.success("Calendar exported to .ics");
      trigger("success");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export calendar");
      trigger("thud");
    }
  };

  const handleImportClick = () => {
    trigger("toggle");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    trigger("toggle");

    const loadingToastId = toast.loading(`Importing ${file.name}...`);

    try {
      const { events: parsedEvents, errors } = await parseICSFile(file);

      if (parsedEvents.length === 0 && errors.length > 0) {
        toast.error("Failed to parse ICS file", { id: loadingToastId });
        trigger("thud");
        return;
      }

      if (parsedEvents.length === 0) {
        toast.error("No valid events found in file", { id: loadingToastId });
        trigger("thud");
        return;
      }

      // Create each event sequentially
      let importedCount = 0;
      for (const eventInput of parsedEvents) {
        try {
          await createEvent.mutateAsync(eventInput);
          importedCount++;
        } catch (err) {
          console.error("Failed to import single event:", err);
        }
      }

      toast.success(`Successfully imported ${importedCount} events`, {
        id: loadingToastId,
      });
      trigger("success");

      if (errors.length > 0) {
        toast.warning(`${errors.length} events had parsing warnings.`);
      }
    } catch (err) {
      console.error("Failed to import ICS:", err);
      toast.error("Critical error during import", { id: loadingToastId });
      trigger("thud");
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,text/calendar"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Import ICS file"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 bg-transparent hover:bg-transparent border-none shadow-none transition-seijaku-fast"
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="sr-only">Calendar options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 shadow-lg border-border/40"
        >
          {/* Calendar Management & Sync */}
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sync & Settings
          </DropdownMenuLabel>

          <div className="md:hidden">
            <DropdownMenuItem
              onClick={handleSync}
              disabled={isSyncing}
              className="cursor-pointer gap-2 py-2"
            >
              <RefreshCw
                className={`h-4 w-4 text-brand${isSyncing ? " animate-spin" : ""}`}
              />
              <span>{isSyncing ? "Syncing…" : "Sync Now"}</span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuItem
            onClick={() => setManageOpen(true)}
            className="cursor-pointer gap-2 py-2"
          >
            <CalendarSync className="h-4 w-4 text-brand" />
            <span>Manage Calendars</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Calendar Data
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleImportClick}
            disabled={isImporting}
            className="cursor-pointer gap-2 py-2"
          >
            <FileUp className="h-4 w-4 text-brand" />
            <span>Import .ics file</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExport}
            disabled={events.length === 0 || isImporting}
            className="cursor-pointer gap-2 py-2"
          >
            <FileDown className="h-4 w-4 text-brand" />
            <span>Export to .ics</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConnectCalendarDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
}
