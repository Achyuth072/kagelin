import { cn } from "@/lib/utils";

export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded-md bg-brand/10 text-brand text-[9px] font-bold uppercase tracking-widest border border-brand/20 leading-none",
        className,
      )}
    >
      Beta
    </span>
  );
}
