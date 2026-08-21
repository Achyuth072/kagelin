import { useEffect, useRef, useCallback } from "react";

// Global stack to track open modals - only the topmost one should handle back
const modalStack: number[] = [];
let modalIdCounter = 0;

/**
 * Wires the mobile back button to close a modal/drawer. Uses a global stack
 * so a stray back press with several modals open only closes the topmost one.
 */
export function useBackNavigation(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const modalIdRef = useRef<number | null>(null);
  const historyPushedRef = useRef(false);
  const isClosingViaBackRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handlePopState = useCallback(() => {
    const myId = modalIdRef.current;

    // If we just landed ON this modal's history entry, don't close it.
    // This happens when a child modal closes programmatically and calls history.back()
    if (window.history.state?.modalId === myId) {
      return;
    }

    const topModalId = modalStack[modalStack.length - 1];

    if (
      myId === topModalId &&
      historyPushedRef.current &&
      !isClosingViaBackRef.current
    ) {
      isClosingViaBackRef.current = true;
      historyPushedRef.current = false;
      modalStack.pop();
      onCloseRef.current();

      // Deferred so a re-open in the same tick isn't mistaken for the old close.
      setTimeout(() => {
        isClosingViaBackRef.current = false;
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!historyPushedRef.current) {
        modalIdRef.current = ++modalIdCounter;
        modalStack.push(modalIdRef.current);
        window.history.pushState({ modalId: modalIdRef.current }, "");
        historyPushedRef.current = true;
      }

      window.addEventListener("popstate", handlePopState, { passive: true });

      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    } else {
      // Closed programmatically (not via back button) — clean up the history
      // entry we pushed.
      if (historyPushedRef.current && !isClosingViaBackRef.current) {
        historyPushedRef.current = false;

        const idx = modalStack.indexOf(modalIdRef.current!);
        if (idx !== -1) modalStack.splice(idx, 1);

        // Only go back if we are still on the entry we pushed
        // This prevents cancelling a concurrent forward navigation
        if (window.history.state?.modalId === modalIdRef.current) {
          window.history.back();
        }
      }
    }
  }, [isOpen, handlePopState]);
}
