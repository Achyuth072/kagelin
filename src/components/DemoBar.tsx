"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useClearGuestData } from "@/lib/hooks/useGuestStoreActions";
import { DeleteUserDataDialog } from "@/components/settings/DeleteUserDataDialog";
import {
  BANNER_SLOT_WRAPPER_CLASS,
  BANNER_SLOT_CARD_CLASS,
  useActiveBanner,
} from "@/components/bannerSlot";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/store/uiStore";
import { KeyHint } from "@/components/ui/key-hint";
import { NOTIFICATION_LINK_BUTTON_CLASS } from "@/components/ui/notification-link-button";

export function DemoBar() {
  const activeBanner = useActiveBanner();
  const clearGuestData = useClearGuestData();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const setShortcutsHelpOpen = useUiStore(
    (state) => state.setShortcutsHelpOpen,
  );

  if (activeBanner !== "demo") return null;

  return (
    <>
      <div data-testid="demo-bar" className={BANNER_SLOT_WRAPPER_CLASS}>
        <div
          className={cn(
            BANNER_SLOT_CARD_CLASS,
            "bg-card text-foreground border-border/80",
          )}
        >
          <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-[13px] font-medium tracking-[0.01em]">
            You&apos;re exploring with demo data
          </span>
          <button
            type="button"
            onClick={() => setShortcutsHelpOpen(true)}
            aria-keyshortcuts="?"
            className={cn(
              NOTIFICATION_LINK_BUTTON_CLASS,
              "hidden md:pointer-fine:inline-flex items-center gap-1.5",
            )}
          >
            Shortcuts
            <KeyHint aria-hidden="true" className="ml-0">
              ?
            </KeyHint>
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={cn(NOTIFICATION_LINK_BUTTON_CLASS, "text-brand")}
          >
            Start fresh
          </button>
        </div>
      </div>
      <DeleteUserDataDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={clearGuestData}
      />
    </>
  );
}
