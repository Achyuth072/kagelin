"use client";

import { useId, useLayoutEffect, useEffect } from "react";
import { useUiStore } from "@/lib/store/uiStore";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Registers open dialogs so state-derived checks disable DnD and hotkeys immediately on render.
export function useDialogActive(isOpen: boolean | undefined) {
  const registerOpenDialog = useUiStore((s) => s?.registerOpenDialog);
  const id = useId();

  useIsomorphicLayoutEffect(() => {
    registerOpenDialog?.(id, !!isOpen);
    return () => {
      registerOpenDialog?.(id, false);
    };
  }, [id, isOpen, registerOpenDialog]);
}
