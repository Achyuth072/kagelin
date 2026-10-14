"use client";

import { Keyboard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";

export function ShortcutTipsRow() {
  const shortcutTipsEnabled = useUiStore((s) => s.shortcutTipsEnabled);
  const setShortcutTipsEnabled = useUiStore((s) => s.setShortcutTipsEnabled);
  const { trigger } = useHaptic();

  return (
    <div className="hidden md:flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-secondary/30">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Shortcut Tips</p>
          <p className="text-xs text-muted-foreground">
            Suggest keyboard shortcuts after repeated mouse use
          </p>
        </div>
      </div>
      <Switch
        aria-label="Shortcut Tips"
        checked={shortcutTipsEnabled}
        onCheckedChange={(checked) => {
          trigger("toggle");
          setShortcutTipsEnabled(checked);
        }}
      />
    </div>
  );
}
