"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Calendar, BarChart3 } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "All Tasks", icon: CheckSquare, path: "/" },
  { label: "Calendar", icon: Calendar, path: "/calendar" },
  { label: "Stats", icon: BarChart3, path: "/stats" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { trigger, isPhone } = useHaptic();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-sidebar md:hidden nav-safe-bottom">
      <div className="flex items-stretch justify-around h-[var(--mobile-nav-content-height)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              prefetch={true}
              onPointerDown={() => trigger("toggle")} // Subtle vibration for nav
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-1 py-[var(--mobile-nav-item-pad)] transition-[color,transform] duration-150 cursor-pointer outline-none",
                isPhone && "active:scale-95",
                isActive
                  ? "text-brand-text"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
              <span className="text-xs font-medium leading-4">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
