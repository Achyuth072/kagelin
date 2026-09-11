"use client";

import { Download } from "lucide-react";
import { DestructiveAlertBanner } from "@/components/ui/destructive-alert-banner";

interface MigrationStuckBannerProps {
  onExport: () => void;
}

export function MigrationStuckBanner({ onExport }: MigrationStuckBannerProps) {
  return (
    <DestructiveAlertBanner
      message={
        <>
          <span className="font-medium">
            We&apos;re having trouble syncing your data.
          </span>{" "}
          We&apos;ll keep retrying — you can export a backup in the meantime.
        </>
      }
      actionLabel="Export backup"
      actionIcon={Download}
      onAction={onExport}
    />
  );
}
