"use client";

import { Download, Share, X } from "lucide-react";
import { usePwaInstall } from "@/lib/hooks/usePwaInstall";
import { Button } from "@/components/ui/button";

export function PwaInstallHint() {
  const { isOpen, isIOS, promptInstall, dismiss } = usePwaInstall();

  if (!isOpen) return null;

  const Icon = isIOS ? Share : Download;
  const title = isIOS ? "Add Kagelin to your Home Screen" : "Install Kagelin";
  const description = isIOS
    ? "Tap Share, then Add to Home Screen. Also required for notifications."
    : "Works offline and launches straight from your home screen.";

  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 mx-4 md:mx-6 mt-4"
    >
      <div className="flex items-start gap-2 min-w-0">
        <Icon
          className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground"
          strokeWidth={2.25}
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {!isIOS && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-8"
              onClick={promptInstall}
            >
              Install
            </Button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
