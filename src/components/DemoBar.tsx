"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useClearGuestData } from "@/lib/hooks/useGuestStoreActions";
import { DeleteUserDataDialog } from "@/components/settings/DeleteUserDataDialog";
import {
  BANNER_SLOT_WRAPPER_CLASS,
  BANNER_SLOT_CARD_CLASS,
  useActiveBanner,
} from "@/components/bannerSlot";
import { useStatusPillOffset } from "@/lib/hooks/useStatusPillOffset";
import { cn } from "@/lib/utils";
import { DEMO_TUTORIAL_PROJECT_ID } from "@/lib/mock/mock-store";
import { NOTIFICATION_LINK_BUTTON_CLASS } from "@/components/ui/notification-link-button";

export function DemoBar() {
  const activeBanner = useActiveBanner();
  const clearGuestData = useClearGuestData();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible = activeBanner === "demo";

  useStatusPillOffset(cardRef, isVisible);

  if (!isVisible) return null;

  return (
    <>
      <div data-testid="demo-bar" className={BANNER_SLOT_WRAPPER_CLASS}>
        <div
          ref={cardRef}
          className={cn(
            BANNER_SLOT_CARD_CLASS,
            "bg-card text-foreground border-border/80",
          )}
        >
          <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-[13px] font-medium tracking-[0.01em] whitespace-nowrap">
            <span className="hidden sm:inline">
              You&apos;re exploring with demo data
            </span>
            <span className="sm:hidden">Demo data</span>
          </span>
          <Link
            href={`/?project=${DEMO_TUTORIAL_PROJECT_ID}`}
            className={cn(NOTIFICATION_LINK_BUTTON_CLASS, "ml-3 sm:ml-1")}
          >
            Meet Kagelin
          </Link>
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
