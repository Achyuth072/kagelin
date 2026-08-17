"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";

export function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  disabled,
  minLength,
  toggleLabel,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  minLength?: number;
  toggleLabel?: string;
  children?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <div className="relative">
        <Lock
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          strokeWidth={2.25}
        />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          placeholder="••••••••"
          className="pl-9 pr-9 h-11 text-base md:text-base"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          autoComplete="new-password"
          minLength={minLength}
          required
        />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
          label={toggleLabel}
        />
      </div>
      {children}
    </div>
  );
}
