"use client";

import { Eye, EyeOff } from "lucide-react";

export function PasswordVisibilityToggle({
  visible,
  onToggle,
  label = "password",
}: {
  visible: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const Icon = visible ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}
