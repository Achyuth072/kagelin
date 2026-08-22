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

export function DemoBar() {
  const activeBanner = useActiveBanner();
  const clearGuestData = useClearGuestData();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (activeBanner !== "demo") return null;

  return (
    <>
      <div data-testid="demo-bar" className={BANNER_SLOT_WRAPPER_CLASS}>
        <div
          className={cn(
            BANNER_SLOT_CARD_CLASS,
            "bg-brand/10 text-foreground border-brand/20",
          )}
        >
          <Sparkles className="w-4 h-4 text-brand shrink-0" />
          <span className="text-[13px] font-medium tracking-[0.01em]">
            You&apos;re exploring with demo data
          </span>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="text-[13px] font-semibold text-brand underline-offset-2 hover:underline shrink-0"
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
