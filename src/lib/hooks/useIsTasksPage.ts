"use client";

import { usePathname } from "next/navigation";

// Shared by hotkey collision guards (board view vs habit `h`, task-list
// paste vs global New Project `p`) that only need to fire while the tasks
// page itself is mounted.
export function useIsTasksPage(): boolean {
  const pathname = usePathname();
  return pathname === "/" || pathname?.startsWith("/tasks") || false;
}
