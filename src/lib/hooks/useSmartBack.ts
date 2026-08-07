"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Raw history.pushState doesn't work here — it desyncs App Router's history
// tracking, so a later router.push() silently no-ops. Must also run
// somewhere that survives its own replace() call — AppShell, not Template,
// which remounts every navigation.
let trapSettled: Promise<void> = Promise.resolve();
let resolveTrapSettled: (() => void) | null = null;

export function useColdOpenBackTrap() {
  const router = useRouter();
  const pathname = usePathname();
  // undefined = unchecked; null = idle/settled; string = pending push target.
  const trap = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (trap.current === undefined) {
      trap.current = pathname === "/" ? null : pathname + location.search;
      if (trap.current) {
        trapSettled = new Promise((resolve) => {
          resolveTrapSettled = resolve;
        });
        router.replace("/");
      }
      return;
    }
    if (trap.current && pathname === "/") {
      const target = trap.current;
      trap.current = null;
      router.push(target);
      resolveTrapSettled?.();
    }
  }, [pathname, router]);
}

// Waits for the trap to settle so back() doesn't fire into its replace()/push() gap.
export function useSmartBack() {
  const router = useRouter();
  return () => {
    trapSettled.then(() => router.back());
  };
}
