"use client";
import React, { useEffect, useState } from "react";

import {
  MoreVertical,
  Timer,
  CheckCircle2,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter, usePathname } from "next/navigation";
import { useTimer } from "@/components/TimerProvider";
import { useCompletedTasks } from "@/components/CompletedTasksProvider";
import { useActiveTask } from "@/lib/hooks/useActiveTask";
import { useHaptic } from "@/lib/hooks/useHaptic";
import {
  prefetchChangelog,
  isNewerThan,
  fetchLatestVersion,
  RELEASE_CHANNEL,
} from "@/lib/changelog-cache";
import { useUiStore } from "@/lib/store/uiStore";
import { SyncIndicator } from "@/components/ui/SyncIndicator";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

const HeaderTimer = React.memo(function HeaderTimer() {
  const { state } = useTimer();
  const { trigger } = useHaptic();
  const router = useRouter();
  const { data: activeTask } = useActiveTask(state.activeTaskId);

  const minutes = Math.floor(state.remainingSeconds / 60);
  const seconds = state.remainingSeconds % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <button
      onPointerDown={() => trigger("toggle")}
      onClick={() => {
        router.push("/focus");
      }}
      className="flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-transparent hover:bg-accent/40 active:scale-95 transition-all outline-none min-w-0"
    >
      <Timer
        className={`h-5 w-5 shrink-0 ${
          state.isRunning
            ? "text-primary animate-pulse"
            : "text-muted-foreground"
        }`}
      />
      <div className="flex flex-col items-start text-left min-w-0">
        <span
          className={`text-base font-mono font-semibold tabular-nums leading-none ${
            state.isRunning ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {displayTime}
        </span>
        {activeTask && (
          <span className="text-xs text-muted-foreground truncate max-w-full">
            {activeTask.content}
          </span>
        )}
      </div>
    </button>
  );
});

interface HeaderProps {
  setCommandOpen: (open: boolean) => void;
}

export const Header = React.memo(function Header({
  setCommandOpen,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { openSheet } = useCompletedTasks();
  const { trigger } = useHaptic();
  const lastDismissedVersion = useUiStore((s) => s.lastDismissedVersion);
  const setChangelogOpen = useUiStore((s) => s.setChangelogOpen);
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  const isTasksPage = pathname === "/";

  useEffect(() => {
    prefetchChangelog();
    const check = async () => {
      try {
        const info = await fetchLatestVersion();
        if (!info) return;
        // Stable builds should not react to preview-only releases.
        if (RELEASE_CHANNEL === "stable" && info.channel !== "stable") return;
        setServerVersion((prev) => {
          if (prev !== info.version) return info.version;
          return prev;
        });
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const effectiveVersion = serverVersion || APP_VERSION;
  const hasNewVersion = isNewerThan(effectiveVersion, lastDismissedVersion);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-[calc(4rem+env(safe-area-inset-top,0px))] px-4 pt-[env(safe-area-inset-top,0px)] border-b bg-sidebar md:hidden">
      {/* Left group: Hamburger + What's New indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <SidebarTrigger className="h-9 w-9 active:scale-95 transition-all [&_svg]:stroke-[2.25px]" />
        {hasNewVersion && (
          <button
            type="button"
            onClick={() => setChangelogOpen(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-foreground/70 hover:bg-accent/40 active:scale-95 transition-all"
            aria-label="What's New — new version available"
          >
            <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          </button>
        )}
      </div>

      {/* Right: Focus Timer (flexible) + Sync indicator + More Menu */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        {/* Isolated Timer Component to prevent Header re-renders */}
        <HeaderTimer />

        <div className="flex items-center gap-2 shrink-0">
          <SyncIndicator />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 bg-transparent hover:bg-accent/40 active:scale-95 transition-all"
                onPointerDown={() => trigger("toggle")}
              >
                <MoreVertical className="h-5 w-5" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  trigger("toggle");
                  setCommandOpen(true);
                }}
              >
                <Search className="h-4 w-4 mr-2 text-foreground/70" />
                Search
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isTasksPage && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      trigger("toggle");
                      openSheet();
                    }}
                  >
                    <CheckCircle2
                      className="h-4 w-4 mr-2 text-foreground/70"
                      strokeWidth={2.5}
                    />
                    Completed Tasks
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => {
                  trigger("toggle");
                  router.push("/settings");
                }}
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
});
