"use client";

import { useMemo, useState } from "react";
import { isAndroidChrome } from "@/lib/utils/platform";
import {
  dismissAndroidBatteryHint,
  isAndroidBatteryHintDismissed,
} from "@/lib/utils/androidBatteryHint";

export function useAndroidBatteryHint() {
  const isAndroidChromeBrowser = useMemo(() => isAndroidChrome(), []);
  const [isOpen, setIsOpen] = useState(false);

  const promptIfDue = () => {
    if (isAndroidChromeBrowser && !isAndroidBatteryHintDismissed()) {
      setIsOpen(true);
    }
  };

  const dismiss = () => {
    dismissAndroidBatteryHint();
    setIsOpen(false);
  };

  const reopen = () => setIsOpen(true);

  return { isAndroidChromeBrowser, isOpen, promptIfDue, dismiss, reopen };
}
