"use client";

import { notify } from "@/lib/notify";
import { useUiStore, type ShortcutTipAction } from "@/lib/store/uiStore";

export type { ShortcutTipAction };

export interface ShortcutTipDef {
  key: string;
  message: string;
}

export const SHORTCUT_TIP_ACTIONS: Record<ShortcutTipAction, ShortcutTipDef> = {
  newTask: {
    key: "N",
    message: "Tip: press N to do this from anywhere",
  },
  newHabit: {
    key: "H",
    message: "Tip: press H to do this from anywhere",
  },
  newEvent: {
    key: "E",
    message: "Tip: press E to do this from anywhere",
  },
  newProject: {
    key: "P",
    message: "Tip: press P to do this from anywhere",
  },
  logbook: {
    key: "C",
    message: "Tip: press C to do this from anywhere",
  },
};

export const MOUSE_ACTION_THRESHOLD = 3;

function isFinePointerDevice(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(pointer: fine)").matches ||
    window.matchMedia("(any-pointer: fine)").matches
  );
}

export function useShortcutTips() {
  const shortcutTipsEnabled = useUiStore((s) => s.shortcutTipsEnabled);

  const recordMouseAction = (action: ShortcutTipAction) => {
    if (!shortcutTipsEnabled) return;
    if (!isFinePointerDevice()) return;

    const shouldNotify = useUiStore
      .getState()
      .incrementShortcutMouseCount(action, MOUSE_ACTION_THRESHOLD);

    if (shouldNotify) {
      const tipDef = SHORTCUT_TIP_ACTIONS[action];
      if (tipDef) {
        notify(tipDef.message);
      }
    }
  };

  const recordKeyAction = (action: ShortcutTipAction) => {
    useUiStore.getState().markShortcutTipShown(action);
  };

  return {
    recordMouseAction,
    recordKeyAction,
  };
}
