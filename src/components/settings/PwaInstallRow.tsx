"use client";

import { useState } from "react";
import { Download, Share } from "lucide-react";
import { usePwaInstall } from "@/lib/hooks/usePwaInstall";
import { Button } from "@/components/ui/button";

export function PwaInstallRow() {
  const { isIOS, canInstall, promptInstall, shouldShowRow } = usePwaInstall();
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  if (!shouldShowRow) return null;

  const Icon = isIOS ? Share : Download;
  const label = isIOS ? "Add to Home Screen" : "Install app";

  return (
    <div className="p-4 rounded-lg border border-border/50 bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-secondary/30">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{label}</p>
        </div>
        {isIOS ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIosInstructions((v) => !v)}
          >
            {showIosInstructions ? "Hide" : "Show me how"}
          </Button>
        ) : canInstall ? (
          <Button variant="outline" size="sm" onClick={promptInstall}>
            Install
          </Button>
        ) : null}
      </div>
      {isIOS && showIosInstructions && (
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
          Tap the Share icon, then select &quot;Add to Home Screen&quot;.
        </p>
      )}
      {!isIOS && !canInstall && (
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
          Use your browser&apos;s menu to install this app.
        </p>
      )}
    </div>
  );
}
